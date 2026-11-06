import { instantiate, Node, NodePool, Sprite, Tween, tween, UITransform, Vec3 } from 'cc';
import { UILayer } from '../../framework/ui/UILayer';
import { services } from '../Services';

/**
 * Decorative animations (FX-02..FX-11). Every effect ends in the same state as without it, so
 * "reduce motion" (F047) simply skips the motion. Callers stop effects on their nodes in onClose via stopFx.
 */
export function reducedMotion(): boolean {
    return services.save.data.settings.reduceMotion;
}

/** Resting scale of nodes while a scale effect runs (flipped nodes keep their sign; pooled nodes change scale between uses). */
const baseScales = new WeakMap<Node, Vec3>();

function baseScale(node: Node): Vec3 {
    let base = baseScales.get(node);
    if (!base) {
        base = node.scale.clone();
        baseScales.set(node, base);
    }
    return base;
}

/** Stop effects on a node and put it back to its resting scale. */
export function stopFx(node: Node): void {
    Tween.stopAllByTarget(node);
    const base = baseScales.get(node);
    if (base) node.setScale(base);
    baseScales.delete(node);
}

const settle = (node: Node) => (): void => { baseScales.delete(node); };

/** Quick scale bounce (snap, upgrade, claim feedback). */
export function pop(node: Node, amount = 1.15, delay = 0): void {
    const base = baseScale(node);
    Tween.stopAllByTarget(node);
    node.setScale(base);
    if (reducedMotion()) {
        baseScales.delete(node);
        return;
    }
    const up = new Vec3(base.x * amount, base.y * amount, base.z);
    tween(node).delay(delay).to(0.1, { scale: up }, { easing: 'quadOut' }).to(0.16, { scale: base }, { easing: 'backOut' }).call(settle(node)).start();
}

/** Grow in from nothing (stars dropping in, combo words). */
export function popIn(node: Node, delay = 0, onLand?: () => void): void {
    const base = baseScale(node);
    Tween.stopAllByTarget(node);
    if (reducedMotion()) {
        node.setScale(base);
        baseScales.delete(node);
        if (onLand) onLand();
        return;
    }
    node.setScale(0, 0, base.z);
    tween(node).delay(delay).to(0.28, { scale: base }, { easing: 'backOut' }).call(() => {
        baseScales.delete(node);
        if (onLand) onLand();
    }).start();
}

/** Continuous rotation (watermill rotor, reward light rays). */
export function spin(node: Node, secondsPerTurn: number, clockwise = true): void {
    Tween.stopAllByTarget(node);
    node.angle = 0;
    if (reducedMotion()) return;
    tween(node).by(secondsPerTurn, { angle: clockwise ? -360 : 360 }).repeatForever().start();
}

/** Repeating tap pulse (guide finger). */
export function pulse(node: Node): void {
    const base = baseScale(node);
    Tween.stopAllByTarget(node);
    node.setScale(base);
    if (reducedMotion()) return;
    const down = new Vec3(base.x * 0.85, base.y * 0.85, base.z);
    tween(node).to(0.3, { scale: down }).to(0.3, { scale: base }).delay(0.3).union().repeatForever().start();
}

/** Repeating slide from the node's place by (dx, dy) (guide drag hint). */
export function slide(node: Node, dx: number, dy: number): void {
    Tween.stopAllByTarget(node);
    if (reducedMotion()) return;
    const from = node.position.clone();
    const to = new Vec3(from.x + dx, from.y + dy, from.z);
    tween(node).to(0.9, { position: to }, { easing: 'sineInOut' }).delay(0.3).set({ position: from }).delay(0.3).union().repeatForever().start();
}

const flyPool = new NodePool();
const FLY_COUNT = 6;

/**
 * FX-03: copies of `icon` fly from it to `target` on the toast layer, then `target` pops.
 * The reward is already saved; this only shows it arriving.
 */
export function flyTo(icon: Sprite, target: Node): void {
    if (reducedMotion() || !icon.node.activeInHierarchy || !target.activeInHierarchy) return;
    const layer = services.ui.layerRoot(UILayer.Toast);
    const layerTransform = layer.getComponent(UITransform)!;
    const from = layerTransform.convertToNodeSpaceAR(icon.node.worldPosition);
    const to = layerTransform.convertToNodeSpaceAR(target.worldPosition);
    const size = icon.node.getComponent(UITransform)!.contentSize;
    // The flight may outlive the popup that owns the icon frame: hold the frame until the last icon lands.
    const frame = icon.spriteFrame!;
    frame.addRef();
    for (let i = 0; i < FLY_COUNT; i++) {
        const node = flyPool.get() ?? instantiateIcon(icon);
        node.getComponent(Sprite)!.spriteFrame = frame;
        node.getComponent(UITransform)!.setContentSize(size.width * 0.5, size.height * 0.5);
        node.parent = layer;
        node.setScale(Vec3.ONE);
        const spread = new Vec3(from.x + (Math.random() - 0.5) * 120, from.y + (Math.random() - 0.5) * 80, 0);
        node.setPosition(from);
        tween(node)
            .delay(i * 0.06)
            .to(0.22, { position: spread }, { easing: 'quadOut' })
            .to(0.45, { position: to, scale: new Vec3(0.6, 0.6, 1) }, { easing: 'quadIn' })
            .call(() => {
                node.getComponent(Sprite)!.spriteFrame = null;
                flyPool.put(node);
                if (i !== FLY_COUNT - 1) return;
                frame.decRef();
                if (target.isValid) pop(target, 1.25);
            })
            .start();
    }
}

/** A bare sprite node with the icon's look (pooled; only its Sprite is used). */
function instantiateIcon(icon: Sprite): Node {
    const node = instantiate(icon.node);
    for (const child of node.children.slice()) child.destroy();
    return node;
}
