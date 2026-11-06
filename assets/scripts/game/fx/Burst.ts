import { Node, Tween, tween, Vec3 } from 'cc';
import { reducedMotion } from './Fx';

const FLIGHT = 0.9;
const SPREAD = 360;

/**
 * FX-01: celebration burst. The prefab places the particle sprites (R-21 art, hidden) at the burst center;
 * each flies out in its own direction while spinning and shrinks away, then hides again at the center.
 */
export function playBurst(particles: Node[]): void {
    if (reducedMotion()) return;
    particles.forEach((node, i) => {
        Tween.stopAllByTarget(node);
        const angle = (Math.PI * 2 * i) / particles.length + (Math.random() - 0.5) * 0.4;
        const distance = SPREAD * (0.6 + Math.random() * 0.4);
        const end = new Vec3(Math.cos(angle) * distance, Math.sin(angle) * distance - 80, 0);
        node.active = true;
        node.setPosition(Vec3.ZERO);
        node.setScale(0.4, 0.4, 1);
        node.angle = 0;
        tween(node)
            .delay(Math.random() * 0.15)
            .to(FLIGHT * 0.35, { position: new Vec3(end.x * 0.6, end.y * 0.6 + 60, 0), scale: new Vec3(1.2, 1.2, 1), angle: 180 }, { easing: 'quadOut' })
            .to(FLIGHT * 0.65, { position: end, scale: Vec3.ZERO, angle: 360 }, { easing: 'quadIn' })
            .call(() => { node.active = false; })
            .start();
    });
}

export function stopBurst(particles: Node[]): void {
    for (const node of particles) {
        Tween.stopAllByTarget(node);
        node.active = false;
    }
}
