import { Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { PopupBase } from './PopupBase';
import { ViewBase } from './ViewBase';

const SCALE_FROM = new Vec3(0.6, 0.6, 1);

function opacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
}

/** BigHero DeferredViewTransition / ScalePopupTransition / OpacityViewTransition on 3.x tween + UIOpacity. */
export function playShow(view: ViewBase<any>, done: () => void): void {
    view.node.active = true;
    const kind = view.meta.transition;
    if (kind === 'scale') {
        const popup = view as PopupBase<any>;
        const fade = opacity(popup.backdrop);
        Tween.stopAllByTarget(fade);
        Tween.stopAllByTarget(popup.content);
        fade.opacity = 0;
        tween(fade).to(0.15, { opacity: 255 }).start();
        popup.content.setScale(SCALE_FROM);
        tween(popup.content).to(0.25, { scale: Vec3.ONE }, { easing: 'backOut' }).call(done).start();
    } else if (kind === 'fade') {
        const fade = opacity(view.node);
        Tween.stopAllByTarget(fade);
        fade.opacity = 0;
        tween(fade).to(0.15, { opacity: 255 }).call(done).start();
    } else {
        done();
    }
}

export function playHide(view: ViewBase<any>, done: () => void): void {
    const kind = view.meta.transition;
    const finish = () => { view.node.active = false; done(); };
    if (kind === 'scale') {
        const popup = view as PopupBase<any>;
        tween(opacity(popup.backdrop)).to(0.12, { opacity: 0 }).start();
        tween(popup.content).to(0.12, { scale: SCALE_FROM }, { easing: 'backIn' }).call(finish).start();
    } else if (kind === 'fade') {
        tween(opacity(view.node)).to(0.12, { opacity: 0 }).call(finish).start();
    } else {
        finish();
    }
}
