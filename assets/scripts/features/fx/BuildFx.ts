import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3 } from 'cc';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
import { BEE_CANVAS, buildPose, CANVAS, CHIPS_PER_BUILDER, endSeconds, FEET, SIZE, type BuildFxTiming, type FxSprite } from './BuildTimeline';
const { ccclass } = _decorator;

const seq = (dir: string, name: string, n: number) => Array.from({ length: n }, (_, i) => `${dir}/${name}_0${i + 1}.png`);
const ART = {
    scaffold: seq('UI/建造/fx_build_scaffold', 'fx_build_scaffold', 3),
    dust: seq('UI/建造/fx_build_dust', 'fx_build_dust', 5),
    sparkle: seq('UI/建造/fx_build_sparkle', 'fx_build_sparkle', 5),
    builder: seq('角色/bee_builder', 'bee_builder', 3),
    carrier: seq('角色/bee_carrier', 'bee_carrier', 2),
    /** Until P2-8 delivers bee_carrier. */
    carrierPlaceholder: ['角色/bee_fly.png'],
    plank: ['UI/建造/fx_build_plank.png'],
    brick: ['UI/建造/fx_build_brick.png'],
    chip: seq('UI/建造', 'fx_build_chip', 3),
    spark: ['UI/特效/build/fx_build_spark.png'],
    puff: ['UI/特效/build/fx_build_smoke.png'],
    glow: ['UI/特效/fx_glow_burst.png'],
};

interface Part {
    node: Node; opacity: UIOpacity;
    /** Sprite sequence, or null for a drawn placeholder (scaled from its drawn size). */
    sprite: Sprite | null; frames: (SpriteFrame | null)[];
    /** width / height of the picture; byHeight: pose size is the height (bees). */
    aspect: number; byHeight: boolean; drawn: number;
}
export interface BuildFxOptions {
    /** The old building picture: the effect shares its 576 canvas, the glow goes behind it, it jolts on strikes. */
    readonly building: Node;
    readonly seconds: number;
    readonly timing: BuildFxTiming;
    readonly scope: ResourceScope;
    /** Effect time to begin at (a resumed build plays a short finish). */
    readonly start: number;
}

/**
 * "Bee building crew" construction (docs/v2/13 §2) drawn from BuildTimeline poses: scaffold and
 * dust, two carriers dropping a plank and a wax brick, two builders hammering with sparks and wood
 * chips, a dust cloud, then glow and sparkle. Placed by the owner at the building's feet. Missing
 * P2-8 art falls back to bee_fly and drawn blocks. Stops (destroys itself) when hidden.
 */
@ccclass('BuildFx')
export class BuildFx extends Component {
    public time = 0;
    private options: BuildFxOptions | null = null;
    private width = 0;
    private base = new Vec3();
    private glow: Node | null = null;
    private parts: Record<string, Part[]> = {};

    public play(options: BuildFxOptions): void {
        const { building, scope } = options, ui = building.getComponent(UITransform)!;
        this.options = options; this.width = ui.width; this.time = options.start;
        this.base = building.position.clone();
        const W = this.width, feet = 1 - FEET / CANVAS, art = (ids: string[], fallback?: string[]) => fallback && !scope.has(ids[0]) ? fallback : ids;
        // Glow behind the building: a sibling just before it. The rest is drawn in this order on the effect node.
        this.glow = this.child(building.parent!, 'BuildGlow', 0.5);
        this.glow.setSiblingIndex(building.getSiblingIndex());
        const at = (name: string, anchorY = 0.5) => this.child(this.node, name, anchorY), bee = BEE_CANVAS[0] / BEE_CANVAS[1];
        this.parts.glow = [this.sprite(this.glow, ART.glow, 1)];
        this.parts.scaffold = [this.sprite(at('scaffold', feet), ART.scaffold, 1)];
        this.parts.materials = [
            scope.has(ART.plank[0]) ? this.sprite(at('plank'), ART.plank, 240 / 72) : this.block(at('plank'), SIZE.plank * W, n => this.plank(n, SIZE.plank * W)),
            scope.has(ART.brick[0]) ? this.sprite(at('brick'), ART.brick, 128 / 112) : this.block(at('brick'), SIZE.brick * W, n => this.brick(n, SIZE.brick * W)),
        ];
        this.parts.builders = [0, 1].map(i => this.sprite(at('builder' + i, 0.05), ART.builder, bee, true));
        this.parts.carriers = [0, 1].map(i => this.sprite(at('carrier' + i), art(ART.carrier, ART.carrierPlaceholder), bee, true));
        const chipArt = scope.has(ART.chip[0]);
        this.parts.chips = Array.from({ length: 2 * CHIPS_PER_BUILDER }, (_, i) => chipArt
            ? this.sprite(at('chip' + i), ART.chip, 1)
            : this.block(at('chip' + i), SIZE.chip * W, n => this.chips(n, SIZE.chip * W)));
        this.parts.sparks = [0, 1].map(i => this.sprite(at('spark' + i), ART.spark, 91 / 87));
        this.parts.puffs = Array.from({ length: 9 }, (_, i) => this.sprite(at('puff' + i), ART.puff, 169 / 160));
        this.parts.dust = [this.sprite(at('dust', feet), ART.dust, 1)];
        this.parts.sparkle = [this.sprite(at('sparkle', feet), ART.sparkle, 1)];
        this.step(0);
    }

    protected update(dt: number): void { if (this.options) this.step(dt); }

    private step(dt: number): void {
        const o = this.options!;
        this.time += dt;
        const p = buildPose(this.time, o.seconds, o.timing, this.width);
        // The glow node is a sibling of the effect node, so its pose is offset by the effect's position.
        this.apply(this.parts.glow[0], { ...p.glow, x: this.node.position.x + p.glow.x, y: this.node.position.y + p.glow.y });
        for (const k of ['scaffold', 'dust', 'sparkle'] as const) this.apply(this.parts[k][0], p[k]);
        p.materials.forEach((m, i) => this.apply(this.parts.materials[i], m));
        p.builders.forEach((m, i) => this.apply(this.parts.builders[i], m));
        p.carriers.forEach((m, i) => this.apply(this.parts.carriers[i], m));
        p.chips.forEach((m, i) => this.apply(this.parts.chips[i], m));
        p.sparks.forEach((m, i) => this.apply(this.parts.sparks[i], m));
        p.puffs.forEach((m, i) => this.apply(this.parts.puffs[i], m));
        if (o.building.isValid) o.building.setPosition(this.base.x + p.shake, this.base.y, this.base.z);
        if (this.time >= endSeconds(o.seconds, o.timing)) this.node.destroy();
    }

    private apply(part: Part, pose: FxSprite): void {
        const node = part.node;
        node.active = pose.visible && pose.opacity > 0.003;
        if (!node.active) return;
        node.setPosition(pose.x, pose.y, 0);
        node.angle = pose.flip ? -pose.angle : pose.angle;
        part.opacity.opacity = Math.round(pose.opacity * 255);
        const flip = pose.flip ? -1 : 1;
        if (part.sprite) {
            const frame = part.frames[pose.frame % part.frames.length];
            if (frame && part.sprite.spriteFrame !== frame) part.sprite.spriteFrame = frame;
            const [w, h] = part.byHeight ? [pose.size * part.aspect, pose.size] : [pose.size, pose.size / part.aspect];
            node.getComponent(UITransform)!.setContentSize(w, h);
            node.setScale(flip, 1, 1);
        } else {
            const k = pose.size / part.drawn;
            node.setScale(flip * k, k, 1);
            // Drawn chips: one child per shape, the pose frame picks which.
            node.children.forEach((c, i) => { c.active = i === pose.frame % node.children.length; });
        }
    }

    private child(parent: Node, name: string, anchorY: number): Node {
        const node = new Node(name);
        node.layer = this.node.layer;
        node.parent = parent;
        node.addComponent(UITransform).setAnchorPoint(0.5, anchorY);
        node.active = false;
        return node;
    }
    private sprite(node: Node, ids: string[], aspect: number, byHeight = false): Part {
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const part: Part = { node, opacity: node.addComponent(UIOpacity), sprite, frames: ids.map(() => null), aspect, byHeight, drawn: 1 };
        ids.forEach((id, i) => this.options!.scope.load(id, SpriteFrame).then(f => { part.frames[i] = f; }, error => console.error(error)));
        return part;
    }
    /** Drawn placeholder at a fixed size; the pose scales it. */
    private block(node: Node, drawn: number, draw: (node: Node) => void): Part {
        draw(node);
        return { node, opacity: node.addComponent(UIOpacity), sprite: null, frames: [], aspect: 1, byHeight: false, drawn };
    }
    private plank(node: Node, w: number): void {
        const g = node.addComponent(Graphics), h = w * 0.3;
        g.fillColor = new Color(176, 112, 52); g.strokeColor = new Color(122, 70, 28); g.lineWidth = Math.max(1.5, w * 0.03);
        g.roundRect(-w / 2, -h / 2, w, h, h * 0.25); g.fill(); g.stroke();
        g.strokeColor = new Color(214, 160, 96); g.lineWidth = Math.max(1, w * 0.015);
        g.moveTo(-w * 0.4, 0); g.lineTo(w * 0.35, h * 0.05); g.stroke();
    }
    private brick(node: Node, w: number): void {
        const g = node.addComponent(Graphics), r = w / 2;
        g.fillColor = new Color(240, 178, 40); g.strokeColor = new Color(170, 104, 20); g.lineWidth = Math.max(1.5, w * 0.05);
        for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; i ? g.lineTo(r * Math.cos(a), r * 0.85 * Math.sin(a)) : g.moveTo(r, 0); }
        g.close(); g.fill(); g.stroke();
        g.fillColor = new Color(255, 222, 120);
        g.ellipse(-r * 0.15, r * 0.2, r * 0.45, r * 0.25); g.fill();
    }
    /** Three chip shapes as children (selected per pose frame). */
    private chips(node: Node, w: number): void {
        const shapes = [[[-0.5, -0.3], [0.5, -0.4], [0.3, 0.4], [-0.4, 0.3]], [[-0.5, 0], [0, -0.5], [0.5, 0.2], [0, 0.4]], [[-0.4, -0.4], [0.5, -0.1], [-0.2, 0.5]]];
        for (const pts of shapes) {
            const c = this.child(node, 'shape', 0.5), g = c.addComponent(Graphics);
            g.fillColor = new Color(190, 128, 64); g.strokeColor = new Color(232, 186, 120); g.lineWidth = Math.max(1, w * 0.06);
            pts.forEach(([x, y], i) => i ? g.lineTo(x * w, y * w) : g.moveTo(x * w, y * w));
            g.close(); g.fill(); g.stroke();
        }
    }

    protected onDisable(): void { if (this.options) this.node.destroy(); }
    protected onDestroy(): void {
        const building = this.options?.building;
        if (building?.isValid) building.setPosition(this.base);
        if (this.glow?.isValid) this.glow.destroy();
        this.options = null;
    }
}
