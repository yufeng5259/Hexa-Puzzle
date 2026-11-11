import { _decorator, Button, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform, isValid } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
import type { MetaManager } from '../../config/MetaManager';
import type { GameState } from '../../progression/GameStateStore';
import { EnergyHud } from '../../common/ui/EnergyHud';
const { ccclass, property } = _decorator;
type Mode = 'home' | 'build';
const MODE_SWITCH_SECONDS = .26;
const ease = (value: number): number => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

@ccclass('HomeBuildView')
export class HomeBuildView extends BaseView {
    @property(Node) public mapRoot: Node | null = null;
    @property(Sprite) public background: Sprite | null = null;
    @property(Node) public homeBottom: Node | null = null;
    @property(Node) public buildBottom: Node | null = null;
    @property(Node) public upgradeRoot: Node | null = null;
    @property(UIOpacity) public homeBottomOpacity: UIOpacity | null = null;
    @property(UIOpacity) public buildBottomOpacity: UIOpacity | null = null;
    @property(UIOpacity) public mapNameOpacity: UIOpacity | null = null;
    @property([UIOpacity]) public upgradeOpacities: UIOpacity[] = [];
    @property(Label) public coinLabel: Label | null = null;
    @property(Label) public levelLabel: Label | null = null;
    @property(Label) public progressLabel: Label | null = null;
    @property(Label) public mapNameLabel: Label | null = null;
    @property(Node) public progressFill: Node | null = null;
    @property(EnergyHud) public energyHud: EnergyHud | null = null;
    @property(Button) public playButton: Button | null = null;
    @property(Button) public buildButton: Button | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Button) public settingsButton: Button | null = null;
    @property(Button) public claimButton: Button | null = null;
    @property([Sprite]) public buildingSprites: Sprite[] = [];
    @property([Sprite]) public rotorSprites: Sprite[] = [];
    @property([Button]) public upgradeButtons: Button[] = [];
    @property([Label]) public costLabels: Label[] = [];
    @property([Label]) public stageLabels: Label[] = [];
    @property([Sprite]) public stageSprites: Sprite[] = [];
    private mode: Mode = 'home';
    private modeMotion: {
        target: Mode; elapsed: number; resolve: (finished: boolean) => void;
        tracks: { opacity: UIOpacity; y: number }[];
    } | null = null;
    private generation = 0;
    private imageIds = new Map<Sprite, string>();
    public validateBindings(): void {
        super.validateBindings();
        for (const key of ['mapRoot','background','homeBottom','buildBottom','upgradeRoot','homeBottomOpacity','buildBottomOpacity','mapNameOpacity','coinLabel','levelLabel','progressLabel','mapNameLabel','progressFill','energyHud','playButton','buildButton','backButton','settingsButton','claimButton'] as const)
            requireBinding('HomeBuildView', key, this[key]);
        for (const key of ['buildingSprites','rotorSprites','upgradeButtons','upgradeOpacities','costLabels','stageLabels'] as const)
            if (this[key].length !== 5 || this[key].some(value => !value)) throw new Error(`HomeBuildView.${key}: five bindings required`);
        if (this.stageSprites.length !== 25 || this.stageSprites.some(value => !value)) throw new Error('HomeBuildView.stageSprites: 25 bindings required');
    }
    public setMode(mode: Mode): void {
        this.finishModeMotion(false);
        this.showMode(mode);
    }
    private showMode(mode: Mode): void {
        this.mode = mode;
        this.homeBottom!.active = mode === 'home'; this.buildBottom!.active = mode === 'build';
        this.upgradeRoot!.active = mode === 'build'; this.mapNameLabel!.node.active = mode === 'build';
    }
    public get currentMode(): Mode { return this.mode; }
    public get modeSwitching(): boolean { return this.modeMotion !== null; }
    public animateMode(mode: Mode): Promise<boolean> {
        if (this.modeSwitching || !this.isShown) return Promise.resolve(false);
        if (mode === this.mode) return Promise.resolve(true);
        return new Promise(resolve => {
            const tracks = [this.homeBottomOpacity!, this.buildBottomOpacity!, this.mapNameOpacity!, ...this.upgradeOpacities]
                .map(opacity => ({ opacity, y: opacity.node.position.y }));
            this.modeMotion = { target: mode, elapsed: 0, tracks, resolve };
            this.update(0);
            // Set the initial poses before enabling the incoming controls.
            this.homeBottom!.active = this.buildBottom!.active = this.upgradeRoot!.active = this.mapNameLabel!.node.active = true;
        });
    }
    public update(dt: number): void {
        const motion = this.modeMotion;
        if (!motion) return;
        motion.elapsed += Math.max(0, dt);
        const t = Math.min(1, motion.elapsed / MODE_SWITCH_SECONDS);
        const p = motion.target === 'build' ? t : 1 - t;
        this.pose(motion.tracks[0], 1 - ease(p / .54), -54);
        this.pose(motion.tracks[1], ease((p - .27) / .64), -54);
        this.pose(motion.tracks[2], ease((p - .22) / .56), 18);
        motion.tracks.slice(3).forEach((track, index) => this.pose(track, ease((p - .27 - index * .06) / .49), -24));
        if (t === 1) this.finishModeMotion(true);
    }
    private pose(track: { opacity: UIOpacity; y: number }, visibility: number, offset: number): void {
        const { opacity, y } = track, node = opacity.node;
        opacity.opacity = Math.round(255 * visibility);
        node.setPosition(node.position.x, y + offset * (1 - visibility), node.position.z);
    }
    private finishModeMotion(completed: boolean): void {
        const motion = this.modeMotion;
        if (!motion) return;
        this.modeMotion = null;
        this.showMode(completed ? motion.target : this.mode);
        for (const track of motion.tracks) this.pose(track, 1, 0);
        motion.resolve(completed);
    }
    public async setData(meta: MetaManager, state: Readonly<GameState>): Promise<void> {
        const generation = ++this.generation;
        const map = meta.getMap(state.currentMapId), slots = meta.getMapBuildings(map.id);
        this.coinLabel!.string = state.coins.toLocaleString();
        const complete = state.currentLevelNo > meta.getMainlineCount();
        this.levelLabel!.string = complete ? '✓' : String(state.currentLevelNo);
        this.playButton!.interactable = !complete;
        this.mapNameLabel!.string = map.nameKey === 'map.garden1' || map.nameKey === 'map.garden-1' ? '向阳蜂谷' : map.nameKey;
        this.refreshEnergy(meta, state);
        let progress = 0, maximum = 0;
        const loads: Promise<void>[] = [this.setImage(this.background!, map.backgroundAssetId, generation)];
        slots.forEach((slot, i) => {
            const level = state.buildings[map.id]?.[String(slot.slotId)] ?? 0, max = meta.getMaxStage(slot.buildingId);
            progress += level; maximum += max;
            const image = this.buildingSprites[i], ui = image.node.getComponent(UITransform)!;
            ui.setAnchorPoint(slot.anchorX, slot.anchorY);
            image.node.setPosition(slot.x, slot.y); image.node.setScale(slot.scale, slot.scale, 1);
            image.node.setSiblingIndex(Math.max(1, slot.zOrder + 1));
            const anchor = this.upgradeButtons[i].node;
            anchor.setPosition(slot.x + slot.upgradeOffsetX, slot.y + slot.upgradeOffsetY);
            this.upgradeButtons[i].interactable = level < max;
            this.costLabels[i].string = level < max ? String(meta.getBuildingStage(slot.buildingId, level + 1).cost) : '✓';
            this.stageLabels[i].string = `${level}/${max}`;
            for (let dot = 0; dot < 5; dot++) loads.push(this.setImage(this.stageSprites[i * 5 + dot], dot < level ? 'firstrelease.ui.stage-green' : 'firstrelease.ui.stage-gray', generation));
            const assetId = meta.getBuildingStage(slot.buildingId, level).bodyAssetId;
            loads.push(this.setImage(image, assetId, generation));
            const rotor = this.rotorSprites[i];
            rotor.node.active = assetId.indexOf('building.watermill.') === 0 && level > 0;
            if (rotor.node.active) loads.push(this.setImage(rotor, `building.watermill.rotor.stage${level}`, generation));
        });
        this.upgradeRoot!.setSiblingIndex(this.mapRoot!.children.length - 1);
        this.progressLabel!.string = `${progress}/${maximum}`;
        this.progressFill!.setScale(maximum ? progress / maximum : 0, 1, 1);
        this.claimButton!.interactable = progress === maximum && !state.receipts[`map-reward:${map.id}`];
        await Promise.all(loads);
    }
    public refreshEnergy(meta: MetaManager, state: Readonly<GameState>, now = Date.now()): void {
        this.energyHud!.setEnergy(state.energy, meta.getConstant<number>('energyMax'), state.nextEnergyAt === null ? 0 : (state.nextEnergyAt - Math.max(now, state.lastSeenAt)) / 1000);
    }
    private async setImage(sprite: Sprite, id: string, generation: number): Promise<void> {
        if (this.imageIds.get(sprite) === id) return;
        const image = await this.resourceScope.load(id, SpriteFrame);
        if (generation !== this.generation || this.isClosed || !isValid(sprite, true)) return;
        sprite.spriteFrame = image; this.imageIds.set(sprite, id);
    }
    public getTarget(id: string): Node | null {
        if (id === 'home.play') return this.playButton!.node;
        if (id === 'home.build') return this.buildButton!.node;
        const slot = /^building\.slot([1-5])\.upgrade$/.exec(id);
        return slot && this.mode === 'build' ? this.upgradeButtons[Number(slot[1]) - 1].node : null;
    }
    protected onHidden(): void { this.finishModeMotion(false); }
    protected onClosed(): void { this.generation++; this.imageIds.clear(); }
}
