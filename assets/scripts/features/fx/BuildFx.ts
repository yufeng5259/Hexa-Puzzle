import { _decorator, Color, Component, Node, ParticleSystem2D, Sprite, SpriteFrame, UIOpacity, UITransform, Vec2 } from 'cc';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
import { sampleSkeleton, sampleTrack, skeletonLength, type SkeletonData } from './FxTimeline';
const { ccclass } = _decorator;

export interface BuildFxData {
    duration: number;
    sprites: Record<string, { asset: string; size: [number, number]; opacity: number }>;
    clip: { tracks: Record<string, Record<string, number[][]>>; speed: number };
    particle: Record<string, unknown> & { node: string; asset: string };
    skeleton: SkeletonData;
}

/**
 * Plays the migrated build effect once on its node: the 2.x clip overlay (light burst,
 * smoke puffs), the spark particle and the hammer/saw skeleton drawn as plain sprites.
 * speed > 1 plays faster. Resolves `done` and destroys itself at the end.
 */
@ccclass('BuildFx')
export class BuildFx extends Component {
    public done: Promise<void> = Promise.resolve();
    private data: BuildFxData | null = null;
    private time = 0;
    private speed = 1;
    private finish: (() => void) | null = null;
    private readonly clipNodes = new Map<string, { node: Node; opacity: UIOpacity }>();
    private readonly slotNodes: { node: Node; sprite: Sprite; opacity: UIOpacity; asset: string | null }[] = [];
    private spark: { node: Node; system: ParticleSystem2D; on: boolean } | null = null;
    private scope: ResourceScope | null = null;

    /** Time (effect seconds, before speed) when the tools stop: the moment to reveal the new building. */
    public static revealTime(data: BuildFxData): number { return skeletonLength(data.skeleton) / data.skeleton.timeScale; }

    public play(data: BuildFxData, scope: ResourceScope, speed = 1): Promise<void> {
        this.data = data; this.scope = scope; this.speed = speed; this.time = 0;
        this.done = new Promise(resolve => { this.finish = resolve; });
        // Clip overlay first (drawn below), then the skeleton, as in the original prefab.
        for (const [name, s] of Object.entries(data.sprites)) {
            const node = this.child(name, s.size[0], s.size[1]), opacity = node.addComponent(UIOpacity);
            opacity.opacity = s.opacity;
            this.frame(node.addComponent(Sprite), s.asset);
            this.clipNodes.set(name, { node, opacity });
        }
        const sparkNode = this.child(data.particle.node, 0, 0), system = sparkNode.addComponent(ParticleSystem2D);
        this.configureParticle(system, data.particle);
        this.spark = { node: sparkNode, system, on: false };
        for (const slot of data.skeleton.slots) {
            const node = this.child(slot.name, 1, 1), sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.slotNodes.push({ node, sprite, opacity: node.addComponent(UIOpacity), asset: null });
        }
        this.step(0);
        return this.done;
    }

    protected update(dt: number): void { if (this.data) this.step(dt * this.speed); }

    private step(dt: number): void {
        const data = this.data!;
        this.time += dt;
        const t = this.time;
        for (const [name, tracks] of Object.entries(data.clip.tracks)) {
            const ct = t * data.clip.speed;
            if (name === data.particle.node) {
                const on = !!tracks.active && sampleTrack(tracks.active, ct)[0] >= 0.5;
                if (on && !this.spark!.on) { this.spark!.on = true; this.spark!.system.resetSystem(); }
                continue;
            }
            const entry = this.clipNodes.get(name);
            if (!entry) continue;
            if (tracks.opacity) entry.opacity.opacity = sampleTrack(tracks.opacity, ct)[0];
            if (tracks.position) { const [x, y] = sampleTrack(tracks.position, ct); entry.node.setPosition(x, y, 0); }
            if (tracks.scale) { const [x, y] = sampleTrack(tracks.scale, ct); entry.node.setScale(x, y, 1); }
            if (tracks.angle) entry.node.angle = sampleTrack(tracks.angle, ct)[0];
        }
        sampleSkeleton(data.skeleton, t).forEach((pose, i) => {
            const s = this.slotNodes[i];
            s.node.active = !!pose.asset && pose.color[3] > 0.003;
            if (!s.node.active) return;
            if (s.asset !== pose.asset) { s.asset = pose.asset; this.frame(s.sprite, pose.asset!); }
            s.node.getComponent(UITransform)!.setContentSize(pose.width, pose.height);
            s.node.setPosition(pose.x, pose.y, 0);
            s.node.angle = pose.angle;
            s.node.setScale(pose.scaleX, pose.scaleY, 1);
            s.sprite.color = new Color(pose.color[0] * 255, pose.color[1] * 255, pose.color[2] * 255, 255);
            s.opacity.opacity = pose.color[3] * 255;
        });
        if (t >= data.duration) { this.data = null; this.finish?.(); this.node.destroy(); }
    }

    private configureParticle(system: ParticleSystem2D, p: BuildFxData['particle']): void {
        const target = system as unknown as Record<string, unknown>;
        system.custom = true;
        system.playOnLoad = false;
        system.autoRemoveOnFinish = false;
        for (const [key, value] of Object.entries(p)) {
            if (key === 'node' || key === 'asset') continue;
            if (/Color/.test(key)) target[key] = new Color(...(value as [number, number, number, number]));
            else if (key === 'sourcePos' || key === 'posVar' || key === 'gravity') target[key] = new Vec2(...(value as [number, number]));
            else target[key] = value;
        }
        this.scope!.load(p.asset, SpriteFrame).then(f => { if (system.isValid) system.spriteFrame = f; }, error => console.error(error));
        system.stopSystem();
    }

    private child(name: string, w: number, h: number): Node {
        const node = new Node(name);
        node.layer = this.node.layer;
        node.parent = this.node;
        node.addComponent(UITransform).setContentSize(w, h);
        return node;
    }
    private frame(sprite: Sprite, asset: string): void {
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.scope!.load(asset, SpriteFrame).then(f => { if (sprite.isValid) sprite.spriteFrame = f; }, error => console.error(error));
    }
    protected onDestroy(): void { this.finish?.(); this.finish = null; this.data = null; }
}
