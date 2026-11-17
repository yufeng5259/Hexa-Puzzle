import { _decorator, Component, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3 } from 'cc';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
import { BEE_CANVAS, buildPose, CANVAS, CHIPS_PER_BUILDER, endSeconds, FEET, type BuildFxTiming, type FxSprite } from './BuildTimeline';
const { ccclass } = _decorator;

const seq = (dir: string, name: string, n: number) => Array.from({ length: n }, (_, i) => `${dir}/${name}_0${i + 1}.png`);
const ART = {
    scaffold: seq('UI/建造/fx_build_scaffold', 'fx_build_scaffold', 3),
    dust: seq('UI/建造/fx_build_dust', 'fx_build_dust', 5),
    sparkle: seq('UI/建造/fx_build_sparkle', 'fx_build_sparkle', 5),
    builder: seq('角色/bee_builder', 'bee_builder', 3),
    carrier: seq('角色/bee_carrier', 'bee_carrier', 2),
    plank: ['UI/建造/fx_build_plank.png'],
    brick: ['UI/建造/fx_build_brick.png'],
    chip: seq('UI/建造', 'fx_build_chip', 3),
    spark: ['UI/特效/build/fx_build_spark.png'],
    puff: ['UI/特效/build/fx_build_smoke.png'],
    glow: ['UI/特效/fx_glow_burst.png'],
};

interface Part {
    node: Node; opacity: UIOpacity; sprite: Sprite; frames: (SpriteFrame | null)[];
    /** width / height of the picture; byHeight: pose size is the height (bees). */
    aspect: number; byHeight: boolean;
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
 * chips, a dust cloud, then glow and sparkle. Placed by the owner at the building's feet.
 * Stops (destroys itself) when hidden.
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
        const { building } = options, ui = building.getComponent(UITransform)!;
        this.options = options; this.width = ui.width; this.time = options.start;
        this.base = building.position.clone();
        const feet = 1 - FEET / CANVAS;
        // Glow behind the building: a sibling just before it. The rest is drawn in this order on the effect node.
        this.glow = this.child(building.parent!, 'BuildGlow', 0.5);
        this.glow.setSiblingIndex(building.getSiblingIndex());
        const at = (name: string, anchorY = 0.5) => this.child(this.node, name, anchorY), bee = BEE_CANVAS[0] / BEE_CANVAS[1];
        this.parts.glow = [this.sprite(this.glow, ART.glow, 1)];
        this.parts.scaffold = [this.sprite(at('scaffold', feet), ART.scaffold, 1)];
        this.parts.materials = [this.sprite(at('plank'), ART.plank, 240 / 72), this.sprite(at('brick'), ART.brick, 128 / 112)];
        this.parts.builders = [0, 1].map(i => this.sprite(at('builder' + i, 0.05), ART.builder, bee, true));
        this.parts.carriers = [0, 1].map(i => this.sprite(at('carrier' + i), ART.carrier, bee, true));
        this.parts.chips = Array.from({ length: 2 * CHIPS_PER_BUILDER }, (_, i) => this.sprite(at('chip' + i), ART.chip, 1));
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
        const frame = part.frames[pose.frame % part.frames.length];
        if (frame && part.sprite.spriteFrame !== frame) part.sprite.spriteFrame = frame;
        const [w, h] = part.byHeight ? [pose.size * part.aspect, pose.size] : [pose.size, pose.size / part.aspect];
        node.getComponent(UITransform)!.setContentSize(w, h);
        node.setScale(pose.flip ? -1 : 1, 1, 1);
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
        const part: Part = { node, opacity: node.addComponent(UIOpacity), sprite, frames: ids.map(() => null), aspect, byHeight };
        ids.forEach((id, i) => this.options!.scope.load(id, SpriteFrame).then(f => { part.frames[i] = f; }, error => console.error(error)));
        return part;
    }

    protected onDisable(): void { if (this.options) this.node.destroy(); }
    protected onDestroy(): void {
        const building = this.options?.building;
        if (building?.isValid) building.setPosition(this.base);
        if (this.glow?.isValid) this.glow.destroy();
        this.options = null;
    }
}
