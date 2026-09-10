package com.world.hexapuzzle;

import android.app.Activity;
import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.cocos.lib.CocosHelper;
import com.cocos.lib.CocosJavascriptJavaBridge;
import com.world.hexapuzzle.yzad.AdGoogleProvider;
import com.world.hexapuzzle.yzad.AndroidReceiptStorage;
import com.world.hexapuzzle.yzad.RewardJson;
import com.world.hexapuzzle.yzad.RewardLedger;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.lang.ref.WeakReference;

public final class SDKHandleClass {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static volatile int hostGeneration;
    private static volatile boolean hostAttached;
    private static WeakReference<Activity> attachedActivity = new WeakReference<>(null);
    // Process singleton holds application context; Activity references are weak.
    @SuppressLint("StaticFieldLeak")
    private static AdGoogleProvider provider;
    private static RewardLedger ledger;
    private static String startupError;

    private SDKHandleClass() {}

    public static void attach(Activity activity) {
        hostGeneration++;
        hostAttached = true;
        attachedActivity = new WeakReference<>(activity);
        // Keep bridge replies working, but do not construct or initialize the ad SDK.
        if (!BuildConfig.IAA_ADS_ENABLED) return;
        if (provider == null && startupError == null) {
            try {
                ledger = new RewardLedger(new AndroidReceiptStorage(activity.getApplicationContext()));
                if (!ledger.reconcileProcessRestart()) Log.w("HexaAds", "Process-restart reconciliation awaits storage retry");
                provider = new AdGoogleProvider(activity.getApplicationContext(), ledger);
            } catch (RuntimeException failure) { startupError = "receipt_storage_unreadable"; }
        }
        if (provider != null) provider.attach(activity);
    }

    public static void onResume(Activity activity) { if (provider != null) provider.resume(activity); }
    public static void onPause(Activity activity) { if (provider != null) provider.pause(activity); }
    public static void onDestroy(Activity activity) {
        if (provider != null) provider.destroy(activity);
        if (attachedActivity.get() == activity) {
            attachedActivity.clear();
            hostAttached = false;
            hostGeneration++;
        }
    }

    public interface Action { void run(JSONObject request, Call call, AdGoogleProvider ads) throws JSONException; }

    public static void dispatch(String raw, Action action) {
        onMain(() -> {
            JSONObject request;
            try { request = RewardJson.parseCall(raw); }
            catch (JSONException | RuntimeException failure) {
                Log.w("HexaAds", "Rejected malformed bridge request");
                return;
            }
            Call call = new Call(request.optString("callId"));
            if (!BuildConfig.IAA_ADS_ENABLED) { call.fail("ads_disabled"); return; }
            if (provider == null) { call.fail(startupError == null ? "activity_unavailable" : startupError); return; }
            try { action.run(request, call, provider); }
            catch (JSONException | IllegalArgumentException failure) { call.fail("invalid_request"); }
            catch (RuntimeException failure) { call.fail("native_error"); }
        });
    }

    public static void onMain(Runnable action) {
        if (Looper.myLooper() == Looper.getMainLooper()) action.run();
        else MAIN.post(action);
    }

    public static final class Call {
        private final String callId;
        private boolean answered;
        private Call(String callId) { this.callId = callId; }
        public void ok(Object value) { answer(true, value, null); }
        public void fail(String errorCode) { answer(false, null, errorCode); }
        public void answer(boolean success, Object value, String errorCode) {
            if (answered) return;
            answered = true;
            try {
                emit(new JSONObject().put("callId", callId).put("success", success)
                        .put("value", value).put("errorCode", errorCode));
            } catch (JSONException failure) { Log.e("HexaAds", "Cannot encode RPC response"); }
        }
    }

    public static void emit(JSONObject payload) {
        if (!hostAttached) return;
        final int generation = hostGeneration;
        final String argument = JSONObject.quote(payload.toString());
        CocosHelper.runOnGameThread(() -> {
            if (!hostAttached || generation != hostGeneration) return;
            CocosJavascriptJavaBridge.evalString("if (typeof window.nativeClientCall === 'function') { window.nativeClientCall(" + argument + "); }");
        });
    }

    public static void event(String requestId, String phase, boolean ended, RewardLedger.Receipt receipt, String error) {
        try {
            JSONObject event = new JSONObject().put("event", "rewarded_ad").put("requestId", requestId)
                    .put("phase", phase).put("presentationEnded", ended).put("errorCode", error);
            if (receipt != null) event.put("receipt", RewardJson.receipt(receipt));
            trace(phase, receipt == null ? new JSONObject().put("requestId", requestId)
                    .put("presentationEnded", ended) : RewardJson.receipt(receipt).put("presentationEnded", ended));
            emit(event);
        } catch (JSONException failure) { Log.e("HexaAds", "Cannot encode lifecycle event"); }
    }

    // Test builds log only validated game transaction fields, never SDK ad/user payloads.
    private static void trace(String phase, JSONObject fields) throws JSONException {
        if (BuildConfig.IAA_TEST_ADS) Log.i("HexaAds", fields.put("phase", phase).toString());
    }

    public static void getRewardReceipts(String raw) {
        dispatch(raw, (request, call, ads) -> {
            JSONArray receipts = new JSONArray();
            for (RewardLedger.Receipt receipt : ledger.pending()) {
                JSONObject value = RewardJson.receipt(receipt);
                trace("recover", new JSONObject(value.toString()));
                receipts.put(value);
            }
            call.ok(receipts);
        });
    }

    public static void acknowledgeReward(String raw) {
        dispatch(raw, (request, call, ads) -> {
            String disposition = request.getString("disposition");
            boolean committed = ledger.acknowledge(RewardJson.id(request, "requestId"),
                    RewardJson.id(request, "receiptId"), disposition);
            trace("ack", new JSONObject().put("requestId", RewardJson.id(request, "requestId"))
                    .put("receiptId", RewardJson.id(request, "receiptId")).put("committed", committed));
            call.answer(committed, committed, committed ? null : "ack_not_committed");
        });
    }

    public static void getPresentationState(String raw) {
        dispatch(raw, (request, call, ads) -> call.ok(RewardJson.presentation(
                ledger.presentation(RewardJson.id(request, "requestId")))));
    }

    public static void getPrivacyOptionsRequired(String raw) {
        dispatch(raw, (request, call, ads) -> call.ok(ads.privacyOptionsRequired()));
    }

    public static void showPrivacyOptions(String raw) {
        dispatch(raw, (request, call, ads) -> ads.showPrivacyOptions(call));
    }

    public static boolean isReady() { return provider != null && provider.isReadySnapshot(); }
}
