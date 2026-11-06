import { Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { PopupBase } from './PopupBase';
import { ViewBase } from './ViewBase';

const SCALE_FROM = new Vec3(0.6, 0.6, 1);

function opacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
}

/** Stop every transition tween of a view and restore its resting look (full opacity, scale 1). */
export function stopTransition(view: ViewBase<any>): void {
    const fade = opacity(view.node);
    Tween.stopAllByTarget(fade);
    fade.opacity = 255;
    if (view.meta.transition === 'scale') {
        const popup = view as PopupBase<any>;
        const backdrop = opacity(popup.backdrop);
        Tween.stopAllByTarget(backdrop);
        backdrop.opacity = 255;
        Tween.stopAllByTarget(popup.content);
        popup.content.setScale(Vec3.ONE);
    }
}

/**
 * BigHero DeferredViewTransition / ScalePopupTransition / OpacityViewTransition on 3.x tween + UIOpacity.
 * `done` is always called exactly once unless stopTransition() interrupts the tween first.
 */
export function playShow(view: ViewBase<any>, done: () => void): void {
    stopTransition(view);
    view.node.active = true;
    const kind = view.meta.transition;
    if (kind === 'scale') {
        const popup = view as PopupBase<any>;
        const fade = opacity(popup.backdrop);
        fade.opacity = 0;
        tween(fade).to(0.15, { opacity: 255 }).start();
        popup.content.setScale(SCALE_FROM);
        tween(popup.content).to(0.25, { scale: Vec3.ONE }, { easing: 'backOut' }).call(done).start();
    } else if (kind === 'fade') {
        const fade = opacity(view.node);
        fade.opacity = 0;
        tween(fade).to(0.15, { opacity: 255 }).call(done).start();
    } else {
        done();
    }
}

/** Hidden (inactive) views finish at once: Cocos pauses tweens on inactive nodes, so they would never complete. */
export function playHide(view: ViewBase<any>, done: () => void): void {
    stopTransition(view);
    const kind = view.meta.transition;
    const finish = (): void => { view.node.active = false; done(); };
    if (!view.node.activeInHierarchy || kind === 'none') {
        finish();
    } else if (kind === 'scale') {
        const popup = view as PopupBase<any>;
        tween(opacity(popup.backdrop)).to(0.12, { opacity: 0 }).start();
        tween(popup.content).to(0.12, { scale: SCALE_FROM }, { easing: 'backIn' }).call(finish).start();
    } else {
        tween(opacity(view.node)).to(0.12, { opacity: 0 }).call(finish).start();
    }
}
