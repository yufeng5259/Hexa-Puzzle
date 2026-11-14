/****************************************************************************
Copyright (c) 2015-2016 Chukong Technologies Inc.
Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

http://www.cocos2d-x.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
****************************************************************************/
package com.cocos.game;

import android.os.Bundle;
import android.content.Intent;
import android.content.res.Configuration;
import android.provider.Settings;
import android.os.Build;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.view.WindowManager;

import com.cocos.service.SDKWrapper;
import com.cocos.lib.CocosActivity;
import com.hexa.block.puzzlegame.SDKHandleClass;

public class AppActivity extends CocosActivity {
    // Window brightness uses 0..1. Keep a readable baseline in dark environments.
    private static final float MIN_GAME_BRIGHTNESS = 0.3f;
    /** The engine surface is black until its first frame; this cover shows the loading look instead. */
    private static final long LAUNCH_COVER_TIMEOUT_MS = 10000;
    private static AppActivity sInstance;
    private View mLaunchCover;
    /** Same numbers as the game's layout (features/ui/FitMath.ts, S01 logo_title in docs/v2 layout). */
    private static final float DESIGN_W = 853f, DESIGN_H = 1844f;
    private static final float[] LOGO_RECT = { 200f, 55f, 454f, 248f };
    /** Same boundary as FitMath.TABLET_MIN_DP: tablets keep the design ratio with black sides. */
    private static final int TABLET_MIN_DP = 600;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The engine asks for short edges only; waterfall / curved screens put their insets on the
        // long edges, which would stay black. Draw everywhere; the game keeps its UI in the safe area.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
            getWindow().setAttributes(lp);
        }
        // Keep the screen awake while the game window is visible.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        sInstance = this;
        showLaunchCover();
        // DO OTHER INITIALIZATION BELOW
        SDKWrapper.shared().init(this);
        SDKHandleClass.attach(this);

    }

    @Override
    protected void onResume() {
        super.onResume();
        applyGameBrightness();
        SDKWrapper.shared().onResume();
        SDKHandleClass.onResume(this);
    }

    @Override
    protected void onPause() {
        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        attributes.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
        getWindow().setAttributes(attributes);
        SDKHandleClass.onPause(this);
        super.onPause();
        SDKWrapper.shared().onPause();
    }

    /**
     * Gradient + logo while the engine starts. The logo is placed with the game's own fit
     * (design area scaled into the safe area, centred), so the loading screen that replaces
     * it shows the logo at exactly the same spot. On tablets the gradient is limited to the
     * design-ratio frame with black sides, matching the game.
     */
    private void showLaunchCover() {
        int background = getResources().getIdentifier("launch_background", "drawable", getPackageName());
        int logo = getResources().getIdentifier("launch_logo", "drawable", getPackageName());
        if (background == 0) return;
        final FrameLayout cover = new FrameLayout(this);
        cover.setBackgroundColor(0xFF000000);
        final View gradientView = new View(this);
        gradientView.setBackgroundResource(background);
        cover.addView(gradientView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        final ImageView logoView = new ImageView(this);
        if (logo != 0) {
            logoView.setImageResource(logo);
            logoView.setScaleType(ImageView.ScaleType.FIT_XY);
            logoView.setVisibility(View.INVISIBLE);
            cover.addView(logoView, new FrameLayout.LayoutParams(1, 1, Gravity.TOP | Gravity.START));
        }
        mLaunchCover = cover;
        addContentView(cover, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        cover.post(() -> placeLaunchLogo(cover, gradientView, logoView));
        // Never keep it forever, even if the script side fails before calling hideLaunchCover().
        cover.postDelayed(this::removeLaunchCover, LAUNCH_COVER_TIMEOUT_MS);
    }

    private void placeLaunchLogo(View cover, View gradientView, ImageView logoView) {
        int w = cover.getWidth(), h = cover.getHeight();
        if (w == 0 || h == 0) return;
        int top = 0, bottom = 0, left = 0, right = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowInsets insets = cover.getRootWindowInsets();
            DisplayCutout cutout = insets == null ? null : insets.getDisplayCutout();
            if (cutout != null) { top = cutout.getSafeInsetTop(); bottom = cutout.getSafeInsetBottom(); left = cutout.getSafeInsetLeft(); right = cutout.getSafeInsetRight(); }
        }
        float safeW = w - left - right, safeH = h - top - bottom;
        float scale = Math.min(safeW / DESIGN_W, safeH / DESIGN_H);
        float cx = left + safeW / 2f, cy = top + safeH / 2f;
        // Tablets: gradient only across the design-ratio frame (full height), black sides, like the game.
        if (getResources().getConfiguration().smallestScreenWidthDp >= TABLET_MIN_DP) {
            int frameW = Math.round(DESIGN_W * scale);
            FrameLayout.LayoutParams frame = new FrameLayout.LayoutParams(frameW, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.TOP | Gravity.START);
            frame.leftMargin = Math.round(cx - frameW / 2f);
            gradientView.setLayoutParams(frame);
        }
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(Math.round(LOGO_RECT[2] * scale), Math.round(LOGO_RECT[3] * scale), Gravity.TOP | Gravity.START);
        params.leftMargin = Math.round(cx + (LOGO_RECT[0] - DESIGN_W / 2f) * scale);
        params.topMargin = Math.round(cy + (LOGO_RECT[1] - DESIGN_H / 2f) * scale);
        logoView.setLayoutParams(params);
        logoView.setVisibility(View.VISIBLE);
    }

    /** Smallest screen width in dp: Android's phone/tablet boundary is 600 (tablets, unfolded foldables). */
    public static int getSmallestWidthDp() {
        final AppActivity activity = sInstance;
        return activity == null ? 0 : activity.getResources().getConfiguration().smallestScreenWidthDp;
    }

    private void removeLaunchCover() {
        final View cover = mLaunchCover;
        if (cover == null) return;
        mLaunchCover = null;
        cover.animate().alpha(0f).setDuration(200).withEndAction(() -> {
            if (cover.getParent() instanceof ViewGroup) ((ViewGroup) cover.getParent()).removeView(cover);
        }).start();
    }

    /** Called from script (GameBoot) once the loading screen has been drawn by the engine. */
    public static void hideLaunchCover() {
        final AppActivity activity = sInstance;
        if (activity != null) activity.runOnUiThread(activity::removeLaunchCover);
    }

    private void applyGameBrightness() {
        float brightness = MIN_GAME_BRIGHTNESS;
        try {
            int configured = Settings.System.getInt(getContentResolver(),
                    Settings.System.SCREEN_BRIGHTNESS, Math.round(MIN_GAME_BRIGHTNESS * 255));
            brightness = Math.max(MIN_GAME_BRIGHTNESS, Math.min(1.0f, configured / 255.0f));
        } catch (SecurityException ignored) {
            // Reading system brightness can be restricted; only override this game window.
        }
        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        attributes.screenBrightness = brightness;
        getWindow().setAttributes(attributes);
    }

    @Override
    protected void onDestroy() {
        if (sInstance == this) sInstance = null;
        SDKHandleClass.onDestroy(this);
        super.onDestroy();
        // Workaround in https://stackoverflow.com/questions/16283079/re-launch-of-activity-on-home-button-but-only-the-first-time/16447508
        if (!isTaskRoot()) {
            return;
        }
        SDKWrapper.shared().onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        SDKWrapper.shared().onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        SDKWrapper.shared().onNewIntent(intent);
    }

    @Override
    protected void onRestart() {
        super.onRestart();
        SDKWrapper.shared().onRestart();
    }

    @Override
    protected void onStop() {
        super.onStop();
        SDKWrapper.shared().onStop();
    }

    @Override
    public void onBackPressed() {
        SDKWrapper.shared().onBackPressed();
        super.onBackPressed();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        SDKWrapper.shared().onConfigurationChanged(newConfig);
        super.onConfigurationChanged(newConfig);
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        SDKWrapper.shared().onRestoreInstanceState(savedInstanceState);
        super.onRestoreInstanceState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        SDKWrapper.shared().onSaveInstanceState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onStart() {
        SDKWrapper.shared().onStart();
        super.onStart();
    }

    @Override
    public void onLowMemory() {
        SDKWrapper.shared().onLowMemory();
        super.onLowMemory();
    }
}
