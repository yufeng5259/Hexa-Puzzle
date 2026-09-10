package com.world.hexapuzzle.yzad;

import android.app.Activity;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.world.hexapuzzle.BuildConfig;
import com.world.hexapuzzle.R;
import com.world.hexapuzzle.SDKHandleClass;
import org.json.JSONException;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

/** Main-thread owner for the Google-only rewarded SDK integration. */
public final class AdGoogleProvider {
    private static final long CACHE_LIFETIME_MS = 60 * 60 * 1000L;
    private static final long[] RETRY_MS = {5000, 15000, 60000};
    private static final String TEST_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917";
    private final Context context;
    private final RewardLedger ledger;
    private final ConsentInformation consent;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<SDKHandleClass.Call> initWaiters = new ArrayList<>();
    private final List<SDKHandleClass.Call> loadWaiters = new ArrayList<>();
    private WeakReference<Activity> activity = new WeakReference<>(null);
    private enum InitPhase { IDLE, INFO, FORM, SDK }
    private InitPhase initPhase = InitPhase.IDLE;
    private int generation, initToken, loadToken, retryAttempt;
    private boolean foreground, consentResolved, sdkInitialized, loading, privacyShowing;
    private RewardedAd rewarded;
    private volatile boolean readySnapshot;
    private volatile long loadedAt;
    private Runnable retryTask, loadTimeout, initTimeout;
    private SDKHandleClass.Call privacyCall;

    public AdGoogleProvider(Context context, RewardLedger ledger) {
        this.context = context.getApplicationContext();
        this.ledger = ledger;
        consent = UserMessagingPlatform.getConsentInformation(this.context);
    }

    public void attach(Activity next) {
        invalidate("activity_replaced");
        activity = new WeakReference<>(next);
        generation++;
        foreground = false;
        consentResolved = false;
    }

    public void resume(Activity resumed) {
        if (activity.get() != resumed) return;
        foreground = true;
        refreshReady();
        ledger.pending();
    }

    public void pause(Activity paused) {
        if (activity.get() != paused) return;
        foreground = false;
        readySnapshot = false;
        cancelRetry();
    }

    public void destroy(Activity destroyed) {
        if (activity.get() != destroyed) return;
        invalidate("activity_destroyed");
        activity.clear();
        foreground = false;
        consentResolved = false;
        generation++;
    }

    private void invalidate(String error) {
        cancelRetry();
        clearLoad();
        rewarded = null;
        readySnapshot = false;
        initPhase = InitPhase.IDLE;
        initToken++;
        if (initTimeout != null) main.removeCallbacks(initTimeout);
        initTimeout = null;
        finish(initWaiters, false, error);
        finish(loadWaiters, false, error);
        if (privacyCall != null) privacyCall.fail(error);
        privacyCall = null;
        privacyShowing = false;
    }

    private Activity usableActivity() {
        Activity value = activity.get();
        return value != null && !value.isFinishing() && !value.isDestroyed() ? value : null;
    }

    private boolean current(int expected) { return generation == expected && usableActivity() != null; }
    private boolean currentInitialization(int expected, int token) {
        return current(expected) && token == initToken && initPhase != InitPhase.IDLE;
    }
    private boolean allowed() { return consentResolved && consent.canRequestAds() && !privacyShowing; }
    private boolean usable() { return foreground && usableActivity() != null && allowed() && sdkInitialized; }

    private boolean online() {
        try {
            ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network active = manager == null ? null : manager.getActiveNetwork();
            NetworkCapabilities capabilities = active == null ? null : manager.getNetworkCapabilities(active);
            return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (RuntimeException failure) { return false; }
    }

    public void initialize(SDKHandleClass.Call call) {
        if (usable()) { call.ok(true); return; }
        if (!foreground || usableActivity() == null) { call.fail("activity_unavailable"); return; }
        if (privacyShowing) { call.fail("privacy_busy"); return; }
        if (initPhase != InitPhase.IDLE && initTimeout == null) { call.fail("consent_pending"); return; }
        initWaiters.add(call);
        if (initPhase != InitPhase.IDLE) return;
        initPhase = InitPhase.INFO;
        consentResolved = false;
        readySnapshot = false;
        int expected = generation;
        int token = ++initToken;
        armInitTimeout(expected, token);
        Activity owner = usableActivity();
        try {
            consent.requestConsentInfoUpdate(owner, new ConsentRequestParameters.Builder().build(),
                    () -> SDKHandleClass.onMain(() -> {
                        if (!currentInitialization(expected, token)) return;
                        Activity formOwner = usableActivity();
                        if (!foreground || formOwner == null) { completeInit("activity_unavailable"); return; }
                        initPhase = InitPhase.FORM;
                        UserMessagingPlatform.loadAndShowConsentFormIfRequired(formOwner,
                                error -> SDKHandleClass.onMain(() -> {
                                    if (!currentInitialization(expected, token)) return;
                                    consentResolved = true;
                                    afterConsent(expected, token, error == null ? null : "consent_form_error");
                                }));
                    }), error -> SDKHandleClass.onMain(() -> {
                        if (!currentInitialization(expected, token)) return;
                        consentResolved = true;
                        afterConsent(expected, token, "consent_update_error");
                    }));
        } catch (RuntimeException failure) { completeInit("consent_error"); }
    }

    private void armInitTimeout(int expected, int token) {
        if (initTimeout != null) main.removeCallbacks(initTimeout);
        initTimeout = () -> {
            if (!currentInitialization(expected, token)) return;
            initTimeout = null;
            if (initPhase == InitPhase.FORM) {
                // A timed-out observer cannot prove that the consent form has closed.
                finish(initWaiters, false, "consent_timeout");
            } else {
                completeInit(initPhase == InitPhase.SDK ? "sdk_timeout" : "consent_timeout");
            }
        };
        main.postDelayed(initTimeout, 14000);
    }

    private void afterConsent(int expected, int token, String consentError) {
        if (!currentInitialization(expected, token)) return;
        if (!allowed()) { completeInit(consentError == null ? "consent_unavailable" : consentError); return; }
        if (!foreground) { completeInit("activity_unavailable"); return; }
        if (sdkInitialized) { completeInit(null); return; }
        initPhase = InitPhase.SDK;
        armInitTimeout(expected, token);
        try {
            MobileAds.initialize(context, status -> SDKHandleClass.onMain(() -> {
                if (!currentInitialization(expected, token)) return;
                sdkInitialized = true;
                completeInit(usable() ? null : "consent_unavailable");
            }));
        } catch (RuntimeException failure) { completeInit("sdk_init_error"); }
    }

    private void completeInit(String error) {
        initPhase = InitPhase.IDLE;
        initToken++;
        if (initTimeout != null) main.removeCallbacks(initTimeout);
        initTimeout = null;
        finish(initWaiters, error == null, error);
        refreshReady();
    }

    private void refreshReady() {
        if (rewarded != null && SystemClock.elapsedRealtime() - loadedAt >= CACHE_LIFETIME_MS) rewarded = null;
        readySnapshot = usable() && rewarded != null && !ledger.hasActivePresentation();
    }

    public boolean isReadySnapshot() {
        return readySnapshot && SystemClock.elapsedRealtime() - loadedAt < CACHE_LIFETIME_MS;
    }

    public void prepare(SDKHandleClass.Call call) {
        refreshReady();
        if (!usable()) { call.fail(allowed() ? "activity_unavailable" : "consent_unavailable"); return; }
        if (ledger.hasActivePresentation()) { call.fail("presentation_busy"); return; }
        if (readySnapshot) { call.ok("ready"); return; }
        if (!online()) { cancelRetry(); call.fail("offline"); return; }
        loadWaiters.add(call);
        if (!loading) { cancelRetry(); retryAttempt = 0; load(); }
    }

    private void load() {
        if (!usable() || !online() || ledger.hasActivePresentation()) {
            finish(loadWaiters, false, "ads_unavailable");
            return;
        }
        String unitId = context.getString(R.string.rewarded_ad_unit_id);
        if (unitId.isEmpty() || (BuildConfig.IAA_TEST_ADS && !TEST_REWARDED_ID.equals(unitId))) {
            finish(loadWaiters, false, "ad_configuration_error");
            return;
        }
        loading = true;
        int expectedGeneration = generation;
        int token = ++loadToken;
        loadTimeout = () -> {
            if (current(expectedGeneration) && token == loadToken && loading) failLoad("load_timeout");
        };
        main.postDelayed(loadTimeout, 14000);
        try {
            RewardedAd.load(context, unitId, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                @Override public void onAdLoaded(RewardedAd ad) {
                    SDKHandleClass.onMain(() -> {
                        if (!current(expectedGeneration) || token != loadToken) return;
                        clearLoad();
                        if (!allowed()) { finish(loadWaiters, false, "consent_unavailable"); return; }
                        rewarded = ad;
                        loadedAt = SystemClock.elapsedRealtime();
                        retryAttempt = 0;
                        refreshReady();
                        finish(loadWaiters, usable(), usable() ? null : "activity_unavailable");
                    });
                }
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    SDKHandleClass.onMain(() -> {
                        if (current(expectedGeneration) && token == loadToken) failLoad("load_" + error.getCode());
                    });
                }
            });
        } catch (RuntimeException failure) { failLoad("load_error"); }
    }

    private void clearLoad() {
        loading = false;
        loadToken++;
        if (loadTimeout != null) main.removeCallbacks(loadTimeout);
        loadTimeout = null;
    }

    private void failLoad(String error) {
        clearLoad();
        rewarded = null;
        readySnapshot = false;
        finish(loadWaiters, false, error);
        if (usable() && online() && retryAttempt < RETRY_MS.length) {
            retryTask = () -> { retryTask = null; if (usable() && online()) load(); };
            main.postDelayed(retryTask, RETRY_MS[retryAttempt++]);
        }
    }

    private void cancelRetry() {
        if (retryTask != null) main.removeCallbacks(retryTask);
        retryTask = null;
    }

    public void show(RewardLedger.Request request, SDKHandleClass.Call call) throws JSONException {
        String admission = ledger.begin(request);
        if (admission != null) {
            RewardLedger.Presentation state = "duplicate_request".equals(admission)
                    ? ledger.presentation(request.requestId) : ledger.decline(request, admission);
            call.answer(false, RewardJson.presentation(state), admission);
            return;
        }
        refreshReady();
        String error = !usable() ? (allowed() ? "activity_unavailable" : "consent_unavailable")
                : !online() ? "offline" : rewarded == null ? "not_ready" : null;
        if (error != null) { failBeforeShow(request, call, error); return; }
        RewardedAd ad = rewarded;
        boolean googleOrdered = ad.getResponseInfo() != null
                && "com.google.ads.mediation.admob.AdMobAdapter".equals(ad.getResponseInfo().getMediationAdapterClassName());
        rewarded = null;
        readySnapshot = false;
        cancelRetry();
        try {
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdShowedFullScreenContent() {
                    SDKHandleClass.onMain(() -> {
                        ledger.showing(request.requestId);
                        if (!ledger.presentation(request.requestId).presentationEnded) {
                            SDKHandleClass.event(request.requestId, "showing", false, null, null);
                        }
                    });
                }
                @Override public void onAdDismissedFullScreenContent() {
                    SDKHandleClass.onMain(() -> {
                        // Google-served earned callbacks precede dismiss; the ledger also checks persisted/unsaved earned evidence.
                        RewardLedger.Receipt receipt = ledger.end(request.requestId, false, googleOrdered, null);
                        SDKHandleClass.event(request.requestId, "dismissed", true, receipt, null);
                        refreshReady();
                    });
                }
                @Override public void onAdFailedToShowFullScreenContent(AdError error) {
                    SDKHandleClass.onMain(() -> {
                        String code = "show_" + error.getCode();
                        RewardLedger.Receipt receipt = ledger.end(request.requestId, true, false, code);
                        SDKHandleClass.event(request.requestId, "failed", true, receipt, code);
                        refreshReady();
                    });
                }
            });
            ad.show(usableActivity(), reward -> SDKHandleClass.onMain(() -> {
                RewardLedger.Receipt receipt = ledger.earned(request.requestId);
                if (receipt != null) SDKHandleClass.event(request.requestId, "earned",
                        ledger.presentation(request.requestId).presentationEnded, receipt, null);
                else SDKHandleClass.event(request.requestId, "failed",
                        ledger.presentation(request.requestId).presentationEnded, null, "receipt_storage_error");
            }));
            call.ok(RewardJson.presentation(ledger.presentation(request.requestId)));
        } catch (RuntimeException failure) {
            // An exception crossing show() cannot prove that fullscreen presentation never began.
            call.answer(false, RewardJson.presentation(ledger.presentation(request.requestId)), "show_exception");
        }
    }

    private void failBeforeShow(RewardLedger.Request request, SDKHandleClass.Call call, String error) throws JSONException {
        RewardLedger.Receipt receipt = ledger.end(request.requestId, true, false, error);
        call.answer(false, RewardJson.presentation(ledger.presentation(request.requestId)), error);
        SDKHandleClass.event(request.requestId, "failed", true, receipt, error);
    }

    public boolean privacyOptionsRequired() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    public void showPrivacyOptions(SDKHandleClass.Call call) {
        if (!foreground || usableActivity() == null) { call.fail("activity_unavailable"); return; }
        if (privacyShowing || initPhase != InitPhase.IDLE || ledger.hasActivePresentation()) { call.fail("presentation_busy"); return; }
        if (!privacyOptionsRequired()) { call.fail("privacy_options_not_required"); return; }
        cancelRetry();
        clearLoad();
        rewarded = null;
        readySnapshot = false;
        finish(loadWaiters, false, "privacy_busy");
        privacyShowing = true;
        privacyCall = call;
        int expected = generation;
        try {
            UserMessagingPlatform.showPrivacyOptionsForm(usableActivity(), error -> SDKHandleClass.onMain(() -> {
                if (!current(expected)) return;
                privacyShowing = false;
                privacyCall = null;
                refreshReady();
                if (error == null) call.ok(true); else call.fail("privacy_form_error");
            }));
        } catch (RuntimeException failure) {
            privacyShowing = false;
            privacyCall = null;
            call.fail("privacy_form_error");
        }
    }

    private void finish(List<SDKHandleClass.Call> waiters, boolean success, String error) {
        List<SDKHandleClass.Call> snapshot = new ArrayList<>(waiters);
        waiters.clear();
        for (SDKHandleClass.Call call : snapshot) {
            if (success) call.ok(waiters == loadWaiters ? "ready" : true);
            else call.fail(error);
        }
    }
}
