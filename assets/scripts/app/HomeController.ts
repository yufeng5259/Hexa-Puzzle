import { Node, Sprite, SpriteFrame, UITransform } from 'cc';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { MapView } from '../core/Config';
import type { Game } from '../core/Game';
import { secondsToNextEnergy } from '../core/Energy';
import { finishBuild, mapProgress, startBuild, upgradeCost } from '../core/Progress';
import { guideAllowsBuild } from '../core/Guide';
import { mainlineFinished } from '../core/Mainline';
import { RuleError } from '../core/Rules';
import { buildingLevel } from '../core/State';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';

const W = 853, H = 1844;
const SCAFFOLD = [1, 2, 3].map(i => `UI/建造/fx_build_scaffold/fx_build_scaffold_0${i}.png`);

/**
 * S02 home and S03 build mode. Both share one map instance: the map lives in the
 * S02 page, build mode is the S03 page pushed above it with its own map mount empty.
 */
export class HomeController {
    public onPlay: (() => void) | null = null;
    private home: LayoutView | null = null;
    private build: LayoutView | null = null;
    private readonly scope: ResourceScope;
    private readonly buildings = new Map<string, Sprite>();
    private readonly anchors = new Map<string, LayoutView>();
    private construction: { buildId: string; buildingId: string; elapsed: number; frame: number; overlay: Sprite } | null = null;
    private unsubscribe: (() => void) | null = null;
    private readonly rewards: RewardPresenter;
    private mapId = '';
    private lastTick = 0;

    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.render());
    }

    public async enter(): Promise<void> {
        this.home = await this.nav.replacePage('S02', id => this.onHomeAction(id));
        this.build = null; this.anchors.clear(); this.buildings.clear(); this.mapId = '';
        this.unsubscribe?.();
        this.unsubscribe = this.game.subscribe(() => this.render());
        await this.renderMap();
        this.render();
        // A build paid for before a crash finishes without charging again.
        const pending = this.game.state.pendingBuild;
        if (pending) { await this.openBuild(); this.beginConstruction(pending.buildId, pending.buildingId); }
        else this.rewards.drain();
    }

    public update(): void {
        const now = this.game.now();
        if (now - this.lastTick >= 1000) { this.lastTick = now; try { this.game.tick(); } catch (error) { console.error(error); } this.renderEnergy(); }
        if (this.construction) this.stepConstruction(1 / 60);
    }

    public dispose(): void { this.unsubscribe?.(); this.scope.release(); }

    private get map(): MapView { return this.game.config.maps.find(m => m.id === this.game.state.maps.currentMapId)!; }

    private async renderMap(): Promise<void> {
        const home = this.home!, map = this.map, mount = home.element('MapMount');
        if (this.mapId === map.id) return;
        this.mapId = map.id;
        mount.removeAllChildren();
        this.buildings.clear();
        this.sprite(mount, 'background', map.backgroundAssetId, W, H, 0.5, 0.5, 0, 0);
        for (const b of [...map.buildings].sort((x, y) => x.zIndex - y.zIndex)) {
            const size = b.widthFraction * W, level = buildingLevel(this.game.state, map.id, b.id);
            const sprite = this.sprite(mount, b.id, b.assetIds[level], size, size, b.anchorX, 1 - b.anchorY, (b.feetX - 0.5) * W, (0.5 - b.feetY) * H);
            if (b.flipX) sprite.node.setScale(-1, 1, 1);
            this.buildings.set(b.id, sprite);
        }
    }
    private sprite(parent: Node, name: string, assetId: string, w: number, h: number, ax: number, ay: number, x: number, y: number): Sprite {
        const node = new Node(name);
        node.parent = parent;
        node.layer = parent.layer;
        const ui = node.addComponent(UITransform);
        ui.setContentSize(w, h); ui.setAnchorPoint(ax, ay);
        node.setPosition(x, y, 0);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.setFrame(sprite, assetId);
        return sprite;
    }
    private setFrame(sprite: Sprite, assetId: string): void {
        this.scope.load(assetId, SpriteFrame).then(frame => { if (sprite.isValid) sprite.spriteFrame = frame; }, error => console.error(error));
    }

    private render(): void {
        if (!this.home?.isValid) return;
        void this.renderMap();
        const s = this.game.state, rules = this.game.rules, map = this.map;
        const level = rules.levels[Math.min(s.player.level - 1, rules.levels.length - 1)];
        for (const view of [this.home, this.build]) {
            if (!view?.isValid) continue;
            view.setText('player_level', s.player.level);
            view.setText('coin_value', s.wallet.coins.toLocaleString('en-US'));
            view.setText('map_name', map.name);
            const fill = view.element('bar_fill_green').getComponent(UITransform)!, full = view.element('bar_bg').getComponent(UITransform)!.width;
            fill.width = Math.max(8, full * Math.min(1, s.player.exp / level.expToNext));
        }
        this.home.setText('play_level', mainlineFinished(s, rules) ? '复玩' : s.mainline.nextLevelNo);
        if (!this.construction) for (const b of map.buildings) this.buildings.get(b.id)?.isValid && this.setFrame(this.buildings.get(b.id)!, b.assetIds[buildingLevel(s, map.id, b.id)]);
        if (this.build?.isValid) this.renderBuild();
        this.renderEnergy();
    }
    private renderEnergy(): void {
        const s = this.game.state, max = this.game.rules.energy.max, left = secondsToNextEnergy(s, this.game.rules, this.game.now());
        const text = left === null ? `${s.energy.value}/${max}` : `${s.energy.value}/${max} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        for (const view of [this.home, this.build]) if (view?.isValid) view.setText('energy_value', text);
    }

    private async openBuild(): Promise<void> {
        if (this.build?.isValid) return;
        this.build = await this.nav.pushPage('S03', id => this.onBuildAction(id));
        // Only the operation layer changes: hide S02 controls, keep its map.
        for (const id of this.home!.nodeIds) if (id !== 'MapMount') this.home!.setVisible(id, false);
        const mount = this.build.element('MapMount');
        this.anchors.clear();
        for (const b of this.map.buildings) {
            const view = await this.nav.instantiate('BuildAnchor', mount, id => { if (id === 'upgrade') this.upgrade(b.id); });
            view.node.setPosition((b.feetX - 0.5) * W, (0.5 - b.feetY) * H, 0);
            this.anchors.set(b.id, view);
        }
        this.render();
    }
    private closeBuild(): void {
        if (this.construction) return; // leaving is locked while building
        this.nav.popPage();
        this.build = null; this.anchors.clear();
        for (const id of this.home!.nodeIds) this.home!.setVisible(id, true);
        this.render();
    }
    private renderBuild(): void {
        const s = this.game.state, map = this.map, progress = mapProgress(s, this.game.rules, map.id);
        this.build!.setText('home_progress', `${progress.built}/${progress.total}`);
        const bar = this.build!.element('bar_fill_green_2').getComponent(UITransform)!;
        bar.width = Math.max(8, this.build!.element('bar_bg_2').getComponent(UITransform)!.width * progress.built / progress.total);
        for (const b of map.buildings) {
            const anchor = this.anchors.get(b.id);
            if (!anchor?.isValid) continue;
            const level = buildingLevel(s, map.id, b.id), cost = upgradeCost(s, this.game.rules, map.id, b.id);
            const building = s.pendingBuild?.buildingId === b.id;
            for (let i = 1; i <= 5; i++) this.scope.load(`UI/建造/build_dot_${i <= level ? 'done' : 'todo'}.png`, SpriteFrame).then(f => anchor.isValid && anchor.setFrame(`dot_${i}`, f));
            const showCost = cost !== null && !building && guideAllowsBuild(s, this.game.rules, b.id);
            for (const id of ['cost', 'coin', 'cost_text']) if (anchor.has(id)) anchor.setVisible(id, showCost);
            if (showCost) {
                anchor.setText('cost_text', cost!);
                this.scope.load(`UI/建造/build_cost_capsule_${s.wallet.coins >= cost! ? 'normal' : 'insufficient'}.png`, SpriteFrame).then(f => anchor.isValid && anchor.setFrame('cost', f));
            }
        }
    }

    private upgrade(buildingId: string): void {
        if (this.construction || this.nav.dialogOpen) return;
        const buildId = `${buildingId}:${this.game.now()}`;
        try {
            this.game.act(s => startBuild(s, this.game.rules, this.map.id, buildingId, buildId));
            this.beginConstruction(buildId, buildingId);
        } catch (error) {
            if (error instanceof RuleError && error.code === 'coins') this.rewards.coinsShort(upgradeCost(this.game.state, this.game.rules, this.map.id, buildingId)!, () => this.play());
            else this.rewards.failure(error);
        }
    }
    private beginConstruction(buildId: string, buildingId: string): void {
        const building = this.buildings.get(buildingId);
        if (!building) return;
        const overlay = this.sprite(building.node, 'scaffold', SCAFFOLD[0], building.node.getComponent(UITransform)!.width, building.node.getComponent(UITransform)!.height, 0.5, 0.5, 0, 0);
        const ui = building.node.getComponent(UITransform)!;
        overlay.node.setPosition((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height, 0);
        this.construction = { buildId, buildingId, elapsed: 0, frame: 0, overlay };
        this.render();
    }
    private stepConstruction(dt: number): void {
        const c = this.construction!;
        c.elapsed += dt;
        const frame = Math.floor(c.elapsed * 6) % SCAFFOLD.length;
        if (frame !== c.frame) { c.frame = frame; this.setFrame(c.overlay, SCAFFOLD[frame]); }
        if (c.elapsed < this.game.rules.build.constructionSeconds) return;
        try {
            // Commit first; only a saved level is shown. A failed write keeps the pending build for retry.
            this.game.act(s => finishBuild(s, this.game.rules, c.buildId, this.game.day()));
            c.overlay.node.destroy();
            this.construction = null;
            this.render();
            this.rewards.drain();
        } catch (error) {
            c.elapsed = 0;
            this.construction = null;
            c.overlay.node.destroy();
            this.rewards.failure(error, () => this.beginConstruction(c.buildId, c.buildingId));
        }
    }

    private play(): void { this.onPlay?.(); }
    private onHomeAction(id: string): void {
        if (this.nav.dialogOpen) return;
        switch (id) {
            case 'home_play_btn': return this.play();
            case 'home_btn_build': void this.openBuild(); return;
            case 'hud_btn_square_purple': return this.rewards.settings();
            case 'hud_energy': return this.rewards.energy(false);
        }
    }
    private onBuildAction(id: string): void {
        if (this.nav.dialogOpen) return;
        switch (id) {
            case 'home_btn_home': return this.closeBuild();
            case 'hud_btn_square_purple': return this.rewards.settings();
            case 'hud_energy': return this.rewards.energy(false);
        }
    }
}
