package com.world.hexapuzzle.yzad;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public final class AndroidReceiptStorage implements RewardLedger.Storage {
    private final SharedPreferences preferences;
    private boolean readable = true;
    public AndroidReceiptStorage(Context context) {
        preferences = context.getSharedPreferences("hexa_reward_receipts_v1", Context.MODE_PRIVATE);
    }

    @Override public List<RewardLedger.Entry> read() {
        List<RewardLedger.Entry> result = new ArrayList<>();
        try {
            JSONObject root = new JSONObject(preferences.getString("ledger", "{\"version\":1,\"entries\":[]}"));
            if (root.getInt("version") != 1) throw new JSONException("unsupported_storage");
            JSONArray rows = root.getJSONArray("entries");
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                RewardLedger.Entry entry = new RewardLedger.Entry(RewardJson.request(row.getJSONObject("request")));
                entry.ended = row.getBoolean("ended");
                entry.earnedSeen = row.getBoolean("earnedSeen");
                JSONArray receipts = row.getJSONArray("receipts");
                for (int j = 0; j < receipts.length(); j++) {
                    JSONObject receipt = receipts.getJSONObject(j);
                    entry.receipts.add(new RewardLedger.Receipt(entry.request, RewardJson.id(receipt, "receiptId"),
                            receipt.getString("outcome"), receipt.optString("errorCode", null)));
                }
                JSONObject acknowledgements = row.getJSONObject("acknowledgements");
                Iterator<String> keys = acknowledgements.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    String disposition = acknowledgements.getString(key);
                    if (!RewardLedger.validId(key) || !("settled".equals(disposition) || "quarantined".equals(disposition))) {
                        throw new JSONException("invalid_ack");
                    }
                    entry.acknowledgements.put(key, disposition);
                }
                result.add(entry);
            }
        } catch (JSONException | RuntimeException failure) {
            // Protect the original bytes from overwrite; do not silently replace an unreadable ledger.
            readable = false;
            throw new IllegalStateException("receipt_storage_unreadable", failure);
        }
        return result;
    }

    @Override public boolean commit(List<RewardLedger.Entry> entries) {
        if (!readable) return false;
        try {
            JSONArray rows = new JSONArray();
            for (RewardLedger.Entry entry : entries) {
                JSONArray receipts = new JSONArray();
                for (RewardLedger.Receipt receipt : entry.receipts) receipts.put(RewardJson.receipt(receipt));
                rows.put(new JSONObject().put("request", RewardJson.request(entry.request)).put("ended", entry.ended)
                        .put("earnedSeen", entry.earnedSeen).put("receipts", receipts)
                        .put("acknowledgements", new JSONObject(entry.acknowledgements)));
            }
            String snapshot = new JSONObject().put("version", 1).put("entries", rows).toString();
            return preferences.edit().putString("ledger", snapshot).commit();
        } catch (JSONException | RuntimeException failure) { return false; }
    }
}
