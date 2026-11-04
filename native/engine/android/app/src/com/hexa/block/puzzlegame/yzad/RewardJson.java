package com.hexa.block.puzzlegame.yzad;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.ArrayList;
import java.util.List;

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
        long version = integer(value, "protocolVersion");
        if (version != 1 && version != 2) throw new JSONException("unsupported_protocol");
    }

    private static long integer(JSONObject value, String key) throws JSONException {
        long result = signedInteger(value, key);
        if (result < 0) throw new JSONException("invalid_" + key);
        return result;
    }
    private static long signedInteger(JSONObject value, String key) throws JSONException {
        Object field = value.get(key);
        if (!(field instanceof Number)) throw new JSONException("invalid_" + key);
        double number = ((Number) field).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number) || Math.floor(number) != number
                || number > RewardLedger.MAX_SAFE_INTEGER || number < -RewardLedger.MAX_SAFE_INTEGER) {
            throw new JSONException("invalid_" + key);
        }
        return ((Number) field).longValue();
    }

    public static RewardLedger.Request request(JSONObject value) throws JSONException {
        protocol(value);
        if (integer(value, "protocolVersion") == 2) return gardenRequest(value);
        if (value.has("requestVersion") && integer(value, "requestVersion") != 1) throw new JSONException("unsupported_request_version");
        nativeOwner(value, false);
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
        if (request.requestVersion == 2) return gardenRequest(request);
        JSONObject spec = new JSONObject();
        if ("hint_refill".equals(request.placementId)) spec.put("kind", "hints").put("amount", 1);
        else spec.put("kind", "continue").put("bonusMoves", 3);
        return new JSONObject().put("protocolVersion", 1).put("requestId", request.requestId)
                .put("placementId", request.placementId).put("attemptId", request.attemptId)
                .put("mapId", request.mapId).put("levelId", request.levelId)
                .put("contentVersion", request.contentVersion).put("rewardSpec", spec);
    }

    private static void nativeOwner(JSONObject value, boolean required) throws JSONException {
        if ((required || value.has("ownerProfile")) && !"prod".equals(value.get("ownerProfile"))) throw new JSONException("reward_profile_mismatch");
        if ((required || value.has("source")) && !"native".equals(value.get("source"))) throw new JSONException("reward_profile_mismatch");
    }
    /** Optional ownership fields on legacy bridge control calls may never select dev/simulation. */
    public static void requireNativeOwner(JSONObject value) throws JSONException { nativeOwner(value, false); }
    private static void fields(JSONObject value, String... names) throws JSONException {
        if (value.length() != names.length) throw new JSONException("unknown_or_missing_fields");
        for (String name : names) if (!value.has(name)) throw new JSONException("unknown_or_missing_fields");
    }
    private static JSONObject object(JSONObject value, String key) throws JSONException {
        Object field = value.get(key);
        if (!(field instanceof JSONObject)) throw new JSONException("invalid_" + key);
        return (JSONObject) field;
    }
    private static String text(JSONObject value, String key) throws JSONException {
        Object field = value.get(key);
        if (!(field instanceof String)) throw new JSONException("invalid_" + key);
        return (String) field;
    }
    private static RewardLedger.Request gardenRequest(JSONObject value) throws JSONException {
        // RPC adds callId; stored immutable requests have precisely the other fields.
        int expected = value.has("callId") ? 13 : 12;
        if (value.length() != expected) throw new JSONException("unknown_or_missing_fields");
        for (String key : new String[] { "requestVersion", "requestId", "ownerProfile", "source", "placementId", "target",
                "benefitKey", "benefitSlot", "createdAtMs", "createdDay", "rewardSpec", "protocolVersion" }) {
            if (!value.has(key)) throw new JSONException("unknown_or_missing_fields");
        }
        if (value.has("callId")) id(value, "callId");
        if (integer(value, "requestVersion") != 2) throw new JSONException("unsupported_request_version");
        nativeOwner(value, true);
        try {
            JSONObject rawTarget = object(value, "target");
            String kind = text(rawTarget, "kind");
            RewardLedger.Target target;
            if ("puzzle".equals(kind)) {
                fields(rawTarget, "kind", "attemptId", "mapId", "levelId", "contentVersion");
                target = RewardLedger.Target.puzzle(id(rawTarget, "attemptId"), id(rawTarget, "mapId"), id(rawTarget, "levelId"), integer(rawTarget, "contentVersion"));
            } else if ("endless".equals(kind)) {
                fields(rawTarget, "kind", "runId"); target = RewardLedger.Target.endless(id(rawTarget, "runId"));
            } else if ("settlement".equals(kind)) {
                fields(rawTarget, "kind", "settlementId"); target = RewardLedger.Target.settlement(id(rawTarget, "settlementId"));
            } else if ("supply".equals(kind)) {
                fields(rawTarget, "kind", "dayKey"); target = RewardLedger.Target.supply(text(rawTarget, "dayKey"));
            } else throw new JSONException("invalid_target");
            JSONObject rawReward = object(value, "rewardSpec");
            String rewardKind = text(rawReward, "kind");
            RewardLedger.Reward reward;
            if ("hints".equals(rewardKind)) {
                fields(rawReward, "kind", "amount");
                if (integer(rawReward, "amount") != 1) throw new JSONException("invalid_reward");
                reward = RewardLedger.Reward.hints();
            } else if ("continue".equals(rewardKind)) {
                fields(rawReward, "kind", "bonusMoves");
                if (integer(rawReward, "bonusMoves") != 3) throw new JSONException("invalid_reward");
                reward = RewardLedger.Reward.continuation();
            } else if ("honey".equals(rewardKind)) {
                fields(rawReward, "kind", "amount"); reward = RewardLedger.Reward.honey(integer(rawReward, "amount"));
            } else if ("endless-revive".equals(rewardKind)) {
                fields(rawReward, "kind", "clearCells");
                Object rawCells = rawReward.get("clearCells");
                if (!(rawCells instanceof JSONArray)) throw new JSONException("invalid_clear_cells");
                JSONArray cells = (JSONArray) rawCells;
                if (cells.length() < 1 || cells.length() > 37) throw new JSONException("invalid_clear_cells");
                List<RewardLedger.Cell> parsed = new ArrayList<>();
                for (int i = 0; i < cells.length(); i++) {
                    JSONObject cell = cells.getJSONObject(i); fields(cell, "q", "r");
                    long q = signedInteger(cell, "q"), r = signedInteger(cell, "r");
                    if (Math.abs(q) > 3 || Math.abs(r) > 3) throw new JSONException("invalid_clear_cell");
                    parsed.add(new RewardLedger.Cell((int) q, (int) r));
                }
                reward = RewardLedger.Reward.revive(parsed);
            } else throw new JSONException("invalid_reward");
            long slot = integer(value, "benefitSlot");
            if (slot > 1) throw new JSONException("invalid_benefit_slot");
            return new RewardLedger.Request(id(value, "requestId"), id(value, "placementId"), "prod", "native",
                    target, id(value, "benefitKey"), (int) slot, signedInteger(value, "createdAtMs"), text(value, "createdDay"), reward);
        } catch (IllegalArgumentException | ClassCastException failure) { throw new JSONException("invalid_request"); }
    }
    private static JSONObject gardenRequest(RewardLedger.Request request) throws JSONException {
        RewardLedger.Target target = request.target;
        JSONObject targetValue = new JSONObject().put("kind", target.kind);
        if ("puzzle".equals(target.kind)) targetValue.put("attemptId", target.attemptId).put("mapId", target.mapId)
                .put("levelId", target.levelId).put("contentVersion", target.contentVersion);
        else if ("endless".equals(target.kind)) targetValue.put("runId", target.runId);
        else if ("settlement".equals(target.kind)) targetValue.put("settlementId", target.settlementId);
        else targetValue.put("dayKey", target.dayKey);
        RewardLedger.Reward reward = request.rewardSpec;
        JSONObject spec = new JSONObject().put("kind", reward.kind);
        if ("continue".equals(reward.kind)) spec.put("bonusMoves", reward.bonusMoves);
        else if ("endless-revive".equals(reward.kind)) {
            JSONArray cells = new JSONArray();
            for (RewardLedger.Cell cell : reward.clearCells) cells.put(new JSONObject().put("q", cell.q).put("r", cell.r));
            spec.put("clearCells", cells);
        } else spec.put("amount", reward.amount);
        return new JSONObject().put("protocolVersion", 2).put("requestVersion", 2).put("requestId", request.requestId)
                .put("ownerProfile", request.ownerProfile).put("source", request.source).put("placementId", request.placementId)
                .put("target", targetValue).put("benefitKey", request.benefitKey).put("benefitSlot", request.benefitSlot)
                .put("createdAtMs", request.createdAtMs).put("createdDay", request.createdDay).put("rewardSpec", spec);
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
