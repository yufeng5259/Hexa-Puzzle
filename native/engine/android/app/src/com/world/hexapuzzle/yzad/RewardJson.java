package com.world.hexapuzzle.yzad;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

public final class RewardJson {
    private RewardJson() {}
    public static final int MAX_REQUEST_CHARS = 8192;

    public static JSONObject parseCall(String text) throws JSONException {
        if (text == null || text.length() > MAX_REQUEST_CHARS) throw new JSONException("invalid_json");
        JSONTokener tokens = new JSONTokener(text);
        JSONObject value = new JSONObject(tokens);
        if (tokens.nextClean() != 0) throw new JSONException("invalid_json");
        id(value, "callId");
        if (value.has("event")) throw new JSONException("invalid_rpc");
        return value;
    }

    public static String id(JSONObject value, String key) throws JSONException {
        Object field = value.get(key);
        if (!(field instanceof String) || !RewardLedger.validId((String) field)) throw new JSONException("invalid_" + key);
        return (String) field;
    }

    public static void protocol(JSONObject value) throws JSONException {
        if (integer(value, "protocolVersion") != 1) throw new JSONException("unsupported_protocol");
    }

    private static long integer(JSONObject value, String key) throws JSONException {
        Object field = value.get(key);
        if (!(field instanceof Number)) throw new JSONException("invalid_" + key);
        double number = ((Number) field).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number) || Math.floor(number) != number || number > 9007199254740991L || number < 0) {
            throw new JSONException("invalid_" + key);
        }
        return ((Number) field).longValue();
    }

    public static RewardLedger.Request request(JSONObject value) throws JSONException {
        protocol(value);
        String placement = id(value, "placementId");
        JSONObject spec = value.getJSONObject("rewardSpec");
        if (spec.length() != 2) throw new JSONException("invalid_reward");
        if ("hint_refill".equals(placement)) {
            if (!"hints".equals(spec.get("kind")) || integer(spec, "amount") != 1) throw new JSONException("invalid_reward");
        } else if ("challenge_continue".equals(placement)) {
            if (!"continue".equals(spec.get("kind")) || integer(spec, "bonusMoves") != 3) throw new JSONException("invalid_reward");
        } else throw new JSONException("invalid_placement");
        try {
            return new RewardLedger.Request(id(value, "requestId"), placement, id(value, "attemptId"),
                    id(value, "mapId"), id(value, "levelId"), integer(value, "contentVersion"));
        } catch (IllegalArgumentException failure) { throw new JSONException("invalid_request"); }
    }

    public static JSONObject request(RewardLedger.Request request) throws JSONException {
        JSONObject spec = new JSONObject();
        if ("hint_refill".equals(request.placementId)) spec.put("kind", "hints").put("amount", 1);
        else spec.put("kind", "continue").put("bonusMoves", 3);
        return new JSONObject().put("protocolVersion", 1).put("requestId", request.requestId)
                .put("placementId", request.placementId).put("attemptId", request.attemptId)
                .put("mapId", request.mapId).put("levelId", request.levelId)
                .put("contentVersion", request.contentVersion).put("rewardSpec", spec);
    }

    public static JSONObject receipt(RewardLedger.Receipt receipt) throws JSONException {
        return request(receipt.request).put("receiptId", receipt.receiptId).put("outcome", receipt.outcome)
                .put("errorCode", receipt.errorCode);
    }

    public static JSONObject presentation(RewardLedger.Presentation state) throws JSONException {
        JSONObject result = new JSONObject().put("requestId", state.requestId).put("showing", state.showing)
                .put("presentationEnded", state.presentationEnded);
        if (state.receipt != null) result.put("receipt", receipt(state.receipt));
        return result;
    }
}
