package com.world.hexapuzzle.yzad;

import com.world.hexapuzzle.SDKHandleClass;
import org.json.JSONException;

/** Reflection entry points intentionally limited to the rewarded protocol. */
public final class ADCenter {
    private ADCenter() {}
    public static void initAd(String raw) {
        SDKHandleClass.dispatch(raw, (request, call, ads) -> {
            RewardJson.protocol(request);
            ads.initialize(call);
        });
    }
    public static void prepareVideo(String raw) {
        SDKHandleClass.dispatch(raw, (request, call, ads) -> ads.prepare(call));
    }
    public static void showVideo(String raw) {
        SDKHandleClass.dispatch(raw, (request, call, ads) -> ads.show(RewardJson.request(request), call));
    }
    public static String isVideoPrepared(String raw) {
        try {
            RewardJson.parseCall(raw);
            return SDKHandleClass.isReady() ? "{\"value\":true}" : "{\"value\":false}";
        } catch (JSONException | RuntimeException failure) { return "{\"success\":false,\"value\":false}"; }
    }
}
