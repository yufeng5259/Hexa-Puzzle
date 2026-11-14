import { EventTarget, native, ResolutionPolicy, screen, sys, view } from 'cc';
import { computeFit, DESIGN, isTablet, type Fit, type Insets } from './FitMath';

/**
 * Runtime side of FitMath: reads the screen, the system safe area and the device class,
 * sets the engine resolution so the design area sits inside the safe area, and tells every
 * page (ScreenFit.events 'changed'). Called at boot and on every window resize (rotation,
 * folding, split screen).
 */
export class ScreenFit {
    public static current: Fit = computeFit(DESIGN, { top: 0, bottom: 0, left: 0, right: 0 }, false);
    public static readonly events = new EventTarget();
    /** Debug only: extra insets in screen pixels (e.g. a simulated Dynamic Island). */
    public static debugInsets: Insets | null = null;

    public static apply(): Fit {
        const win = screen.windowSize, insets = ScreenFit.insets(win);
        const fit = computeFit(win, insets, isTablet(ScreenFit.smallestWidthDp(), win));
        view.setDesignResolutionSize(fit.visible.width, fit.visible.height, ResolutionPolicy.SHOW_ALL);
        ScreenFit.current = fit;
        ScreenFit.events.emit('changed', fit);
        return fit;
    }

    /** Safe-area insets in window pixels, measured against the engine's current visible area. */
    private static insets(win: { width: number; height: number }): Insets {
        const size = view.getVisibleSize(), origin = view.getVisibleOrigin(), safe = sys.getSafeAreaRect(false);
        const kx = win.width / size.width, ky = win.height / size.height;
        const base = {
            top: Math.max(0, (origin.y + size.height - (safe.y + safe.height)) * ky), bottom: Math.max(0, (safe.y - origin.y) * ky),
            left: Math.max(0, (safe.x - origin.x) * kx), right: Math.max(0, (origin.x + size.width - (safe.x + safe.width)) * kx),
        };
        const extra = ScreenFit.debugInsets;
        return extra ? { top: Math.max(base.top, extra.top), bottom: Math.max(base.bottom, extra.bottom), left: Math.max(base.left, extra.left), right: Math.max(base.right, extra.right) } : base;
    }

    /** Android reports the system smallest width (dp); elsewhere null (browser: decided by aspect). */
    private static smallestWidthDp(): number | null {
        if (!sys.isNative || sys.os !== sys.OS.ANDROID) return null;
        try {
            const dp = native.reflection.callStaticMethod('com/cocos/game/AppActivity', 'getSmallestWidthDp', '()I') as unknown as number;
            return dp > 0 ? dp : null;
        } catch (error) { console.warn('smallest width', error); return null; }
    }
}
