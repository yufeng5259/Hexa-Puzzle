package com.world.hexapuzzle.yzad;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.util.Log;
import com.world.hexapuzzle.SDKHandleClass;
import org.json.JSONException;
import org.json.JSONObject;
import java.lang.ref.WeakReference;

/** Simulation-only rewarded provider. It never loads third-party ad or consent SDKs. */
public final class AdGoogleProvider {
    private static final String TAG = "HexaAds";
    private static final String SIMULATION_CASE_EXTRA = "iaa_simulation_case";
    private static final String CASE_LOAD_FAILED = "load_failed";

    private final RewardLedger ledger;
    private final Handler main = new Handler(Looper.getMainLooper());
    private WeakReference<Activity> activity = new WeakReference<>(null);
    private AlertDialog dialog;
    private AlertDialog casesDialog;
    private String dialogRequestId;
    private int generation;
    private boolean foreground, initialized, prepared;
    private volatile boolean readySnapshot;

    public AdGoogleProvider(Context context, RewardLedger ledger) {
        this.ledger = ledger;
    }

    public void attach(Activity next) {
        invalidate("activity_replaced");
        activity = new WeakReference<>(next);
        generation++;
        foreground = false;
        initialized = false;
        prepared = false;
    }

    public void resume(Activity resumed) {
        if (activity.get() != resumed) return;
        foreground = true;
        ledger.pending();
        refreshReady();
    }

    public void pause(Activity paused) {
        if (activity.get() != paused) return;
        foreground = false;
        readySnapshot = false;
        cancelDialog("activity_unavailable");
    }

    public void destroy(Activity destroyed) {
        if (activity.get() != destroyed) return;
        invalidate("activity_destroyed");
        activity.clear();
        foreground = false;
        initialized = false;
        prepared = false;
        generation++;
    }

    private void invalidate(String reason) {
        prepared = false;
        readySnapshot = false;
        cancelDialog(reason);
    }

    private Activity usableActivity() {
        Activity value = activity.get();
        return value != null && !value.isFinishing() && !value.isDestroyed() ? value : null;
    }

    private boolean usable() {
        return foreground && usableActivity() != null && initialized;
    }

    private boolean loadFailedCase(Activity owner) {
        try {
            return CASE_LOAD_FAILED.equals(owner.getIntent().getStringExtra(SIMULATION_CASE_EXTRA));
        } catch (RuntimeException failure) {
            return false;
        }
    }

    public void initialize(SDKHandleClass.Call call) {
        if (!foreground || usableActivity() == null) {
            call.fail("activity_unavailable");
            return;
        }
        initialized = true;
        refreshReady();
        call.ok(true);
    }

    private void refreshReady() {
        Activity owner = usableActivity();
        readySnapshot = usable() && prepared && owner != null && !loadFailedCase(owner)
                && !ledger.hasActivePresentation() && dialog == null;
    }

    public boolean isReadySnapshot() {
        return readySnapshot;
    }

    public void prepare(SDKHandleClass.Call call) {
        Activity owner = usableActivity();
        if (!foreground || owner == null || !initialized) {
            call.fail("activity_unavailable");
            return;
        }
        if (ledger.hasActivePresentation() || dialog != null) {
            call.fail("presentation_busy");
            return;
        }
        if (loadFailedCase(owner)) {
            prepared = false;
            readySnapshot = false;
            call.fail("load_failed");
            return;
        }
        prepared = true;
        readySnapshot = true;
        call.ok("ready");
    }

    public void show(RewardLedger.Request request, SDKHandleClass.Call call) throws JSONException {
        String admission = ledger.begin(request);
        if (admission != null) {
            RewardLedger.Presentation state = "duplicate_request".equals(admission)
                    ? ledger.presentation(request.requestId) : ledger.decline(request, admission);
            call.answer(false, RewardJson.presentation(state), admission);
            return;
        }

        Activity owner = usableActivity();
        String error = !foreground || owner == null || !initialized ? "activity_unavailable"
                : !readySnapshot ? "not_ready"
                : dialog != null ? "presentation_busy"
                : loadFailedCase(owner) ? "load_failed"
                : null;
        if (error != null) {
            failBeforeShow(request, call, error);
            return;
        }

        prepared = false;
        readySnapshot = false;
        int expectedGeneration = generation;
        DialogSession session = new DialogSession(request, expectedGeneration);
        try {
            dialog = new AlertDialog.Builder(owner)
                    .setTitle("模拟激励广告")
                    .setMessage("Simulation mode")
                    .setPositiveButton("Earn + close", null)
                    .setNegativeButton("Close no reward", null)
                    .setNeutralButton("More cases", null)
                    .create();
            dialogRequestId = request.requestId;
            dialog.setOnCancelListener(ignored -> session.dismissWithTrustedNoReward());
            dialog.setOnDismissListener(ignored -> session.cleanup());
            dialog.show();
            dialog.getButton(DialogInterface.BUTTON_POSITIVE).setOnClickListener(view -> session.earnAndClose());
            dialog.getButton(DialogInterface.BUTTON_NEGATIVE).setOnClickListener(view -> session.dismissWithTrustedNoReward());
            dialog.getButton(DialogInterface.BUTTON_NEUTRAL).setOnClickListener(view -> session.showCases());
            ledger.showing(request.requestId);
            SDKHandleClass.event(request.requestId, "showing", false, null, null);
            call.ok(RewardJson.presentation(ledger.presentation(request.requestId)));
        } catch (RuntimeException failure) {
            dialog = null;
            dialogRequestId = null;
            RewardLedger.Receipt receipt = ledger.end(request.requestId, true, false, "show_exception");
            call.answer(false, RewardJson.presentation(ledger.presentation(request.requestId)), "show_exception");
            SDKHandleClass.event(request.requestId, "failed", true, receipt, "show_exception");
            refreshReady();
        }
    }

    private void failBeforeShow(RewardLedger.Request request, SDKHandleClass.Call call, String error) throws JSONException {
        RewardLedger.Receipt receipt = ledger.end(request.requestId, true, false, error);
        call.answer(false, RewardJson.presentation(ledger.presentation(request.requestId)), error);
        SDKHandleClass.event(request.requestId, "failed", true, receipt, error);
        refreshReady();
    }

    public boolean privacyOptionsRequired() {
        return false;
    }

    public void showPrivacyOptions(SDKHandleClass.Call call) {
        call.fail("privacy_options_unsupported");
    }

    private void cancelDialog(String reason) {
        AlertDialog currentCases = casesDialog;
        AlertDialog current = dialog;
        String requestId = dialogRequestId;
        casesDialog = null;
        dialog = null;
        dialogRequestId = null;
        if (requestId != null) {
            RewardLedger.Receipt receipt = ledger.end(requestId, false, false, reason);
            SDKHandleClass.event(requestId, "failed", true, receipt, reason);
        }
        if (currentCases != null) currentCases.dismiss();
        if (current != null) current.dismiss();
        refreshReady();
    }

    private void clearDialog(String requestId) {
        if (requestId.equals(dialogRequestId)) {
            dialog = null;
            dialogRequestId = null;
        }
        refreshReady();
    }

    private void traceProcessStop(RewardLedger.Receipt receipt) {
        try {
            JSONObject fields = RewardJson.receipt(receipt)
                    .put("phase", "simulation_process_stop_after_earned")
                    .put("reason", "persisted_before_emit");
            Log.i(TAG, fields.toString());
        } catch (JSONException failure) {
            Log.i(TAG, "{\"phase\":\"simulation_process_stop_after_earned\",\"reason\":\"persisted_before_emit\"}");
        }
    }

    private void traceSimulationCase(String requestId, String simulationCase) {
        try {
            Log.i(TAG, new JSONObject().put("simulation_case", simulationCase)
                    .put("requestId", requestId).toString());
        } catch (JSONException failure) {
            Log.i(TAG, "{\"simulation_case\":\"trace_encode_error\"}");
        }
    }

    private final class DialogSession {
        private final RewardLedger.Request request;
        private final int expectedGeneration;
        private boolean ended;

        DialogSession(RewardLedger.Request request, int expectedGeneration) {
            this.request = request;
            this.expectedGeneration = expectedGeneration;
        }

        void earnAndClose() {
            traceSimulationCase(request.requestId, "earn_and_close");
            earn();
            dismiss(false);
        }

        void showCases() {
            Activity owner = usableActivity();
            if (!current(owner)) return;
            AlertDialog previous = casesDialog;
            if (previous != null) previous.dismiss();
            casesDialog = new AlertDialog.Builder(owner)
                    .setTitle("模拟激励广告")
                    .setItems(new CharSequence[] {
                            "Duplicate earned",
                            "Late earned (10s)",
                            "Persist then kill"
                    }, (selected, which) -> {
                        if (which == 0) duplicateEarned();
                        else if (which == 1) lateEarnedAfterClose();
                        else if (which == 2) persistEarnedThenStop();
                    })
                    .create();
            casesDialog.setOnDismissListener(ignored -> casesDialog = null);
            casesDialog.show();
        }

        void duplicateEarned() {
            traceSimulationCase(request.requestId, "duplicate_earned");
            earn();
            earn();
            dismiss(false);
        }

        void lateEarnedAfterClose() {
            traceSimulationCase(request.requestId, "late_earned_after_closed");
            dismiss(true);
            main.postDelayed(this::earnAfterClosed, 10000);
        }

        void persistEarnedThenStop() {
            if (!current(usableActivity())) return;
            traceSimulationCase(request.requestId, "persist_earned_then_process_stop");
            RewardLedger.Receipt receipt = ledger.earned(request.requestId);
            if (receipt == null) {
                SDKHandleClass.event(request.requestId, "failed",
                        ledger.presentation(request.requestId).presentationEnded, null, "receipt_storage_error");
                return;
            }
            traceProcessStop(receipt);
            Process.killProcess(Process.myPid());
        }

        void earn() {
            if (!current(usableActivity())) return;
            emitEarned();
        }

        void earnAfterClosed() {
            if (generation != expectedGeneration || !foreground || usableActivity() == null) return;
            emitEarned();
        }

        void emitEarned() {
            RewardLedger.Receipt receipt = ledger.earned(request.requestId);
            boolean presentationEnded = ledger.presentation(request.requestId).presentationEnded;
            if (receipt != null) {
                SDKHandleClass.event(request.requestId, "earned", presentationEnded, receipt, null);
            } else {
                SDKHandleClass.event(request.requestId, "failed", presentationEnded, null, "receipt_storage_error");
            }
        }

        void dismissWithTrustedNoReward() {
            traceSimulationCase(request.requestId, "closed_no_reward");
            dismiss(true);
        }

        void dismiss(boolean trustedNoReward) {
            if (ended) return;
            ended = true;
            RewardLedger.Receipt receipt = ledger.end(request.requestId, false, trustedNoReward, null);
            SDKHandleClass.event(request.requestId, "dismissed", true, receipt, null);
            AlertDialog current = dialog;
            AlertDialog currentCases = casesDialog;
            clearDialog(request.requestId);
            if (currentCases != null) currentCases.dismiss();
            if (current != null) current.dismiss();
        }

        void cleanup() {
            if (!ended && request.requestId.equals(dialogRequestId)) dismissWithTrustedNoReward();
            clearDialog(request.requestId);
        }

        private boolean current(Activity owner) {
            return generation == expectedGeneration && foreground && owner != null
                    && request.requestId.equals(dialogRequestId);
        }
    }
}
