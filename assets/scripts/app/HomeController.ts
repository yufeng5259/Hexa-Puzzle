import { JsonAsset, Node, Sprite, SpriteFrame, tween, UITransform, Vec3 } from 'cc';
import { BuildFx, type BuildFxData } from '../features/fx/BuildFx';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { MapView } from '../core/Config';
import type { Game } from '../core/Game';
import { showEnergy } from './EnergyHud';
import { finishBuild, mapProgress, startBuild, upgradeCost } from '../core/Progress';
import { guideAllowsBuild } from '../core/Guide';
import { mainlineFinished } from '../core/Mainline';
import { endlessUnlocked } from '../core/Progress';
import { reward, RuleError, type Reward } from '../core/Rules';
import { buildingLevel } from '../core/State';
import type { LayoutView } from '../features/ui/LayoutView';
import { ScreenFit } from '../features/ui/ScreenFit';
import { placeMap, type Picture } from '../features/ui/FitMath';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';
import type { GuideCoach } from './GuideCoach';
import { DailyPresenter } from './DailyPresenter';

const W = 853, H = 1844;
/** The migrated effect was drawn around a building about this wide; it scales with ours. */
const FX_REFERENCE_WIDTH = 420;
const FX_SCALE = { min: 0.55, max: 1.2 };

/**
 * S02 home and S03 build mode. Both share one map instance: the map lives in the
 * S02 page, build mode is the S03 page pushed above it with its own map mount empty.
 */
export class HomeController {
    public onPlay: (() => void) | null = null;
    public onEndless: (() => void) | null = null;
    /** S16 map selection (map name) and the replay list (Play after all levels are cleared). */
    public onMaps: (() => void) | null = null;
    public onReplay: (() => void) | null = null;
    /** A finished map being looked at; building stays on the current map. */
    private viewMapId: string | null = null;
    private home: LayoutView | null = null;
    private build: LayoutView | null = null;
    private readonly scope: ResourceScope;
    private readonly buildings = new Map<string, Sprite>();
    private readonly anchors = new Map<string, LayoutView>();
    private construction: { buildId: string; buildingId: string; elapsed: number; fx: Node | null } | null = null;
    private fxData: Promise<BuildFxData | null> | null = null;
    private readonly pendingFrames: Promise<unknown>[] = [];
    /**
     * Per map (tools/v2/map-bounds.mjs): opaque building extent, map design coordinates y down, and
     * the drawn (outpainted) background around the design centre, y up.
     */
    public mapBounds: Record<string, { left: number; right: number; top: number; bottom: number; picture?: Picture }> = {};
    private readonly onFit = () => this.placeMapNodes();
    private unsubscribe: (() => void) | null = null;
    private readonly rewards: RewardPresenter;
    private readonly daily: DailyPresenter;
    private mapId = '';
    private lastTick = 0;

    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader, private readonly guide: GuideCoach) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.render(), true, guide);
        this.rewards.onEndless = () => this.onEndless?.();
        this.daily = new DailyPresenter(game, nav, this.rewards, { play: () => this.play(), build: () => void this.openBuild(), endless: () => this.onEndless?.() });
    }

    /** instant: first page under the boot loading screen (no transition). */
    public async enter(viewMapId: string | null = null, instant = false): Promise<void> {
        this.viewMapId = viewMapId === this.game.state.maps.currentMapId ? null : viewMapId;
        // The transition stays closed until the map and building pictures are loaded.
        this.home = await this.nav.replacePage('S02', id => this.onHomeAction(id), { instant, prepare: () => this.ready() });
        this.build = null; this.anchors.clear(); this.buildings.clear(); this.mapId = '';
        this.unsubscribe?.();
        this.unsubscribe = this.game.subscribe(() => this.render());
        ScreenFit.events.off('changed', this.onFit);
        ScreenFit.events.on('changed', this.onFit);
        this.daily.rollover();
        await this.renderMap();
        this.render();
        // A build paid for before a crash finishes without charging again.
        const pending = this.game.state.pendingBuild;
        if (pending) { await this.openBuild(); this.beginConstruction(pending.buildId, pending.buildingId); }
        else this.rewards.drain();
    }

    public update(): void {
        const now = this.game.now();
        if (now - this.lastTick >= 1000) { this.lastTick = now; try { this.game.tick(); } catch (error) { console.error(error); } this.renderEnergy(); if (this.home?.isValid) this.daily.tick(); }
        if (this.construction) this.stepConstruction(1 / 60);
    }

    public dispose(): void { this.unsubscribe?.(); ScreenFit.events.off('changed', this.onFit); this.scope.release(); }

    private get map(): MapView { return this.game.config.maps.find(m => m.id === (this.viewMapId ?? this.game.state.maps.currentMapId))!; }

    private async renderMap(): Promise<void> {
        const home = this.home!, map = this.map, mount = home.element('MapMount');
        if (this.mapId === map.id) return;
        this.mapId = map.id;
        mount.removeAllChildren();
        this.buildings.clear();
        // The outpainted picture reaches past the design area so wide/tall screens see more map.
        const pic = this.picture(map.id);
        this.sprite(mount, 'background', map.backgroundAssetId, pic.width, pic.height, 0.5, 0.5, pic.x, pic.y);
        for (const b of [...map.buildings].sort((x, y) => x.zIndex - y.zIndex)) {
            const size = b.widthFraction * W, level = buildingLevel(this.game.state, map.id, b.id);
            const sprite = this.sprite(mount, b.id, b.assetIds[level], size, size, b.anchorX, 1 - b.anchorY, (b.feetX - 0.5) * W, (0.5 - b.feetY) * H);
            if (b.flipX) sprite.node.setScale(-1, 1, 1);
            this.buildings.set(b.id, sprite);
        }
        this.placeMapNodes();
    }
    /**
     * Enlarges the whole map (background, buildings, build anchors, effects) to fill the game
     * frame as far as the buildings stay clear of the HUD and bottom bar (FitMath.placeMap).
     * The build page's anchor layer gets the same transform; its capsules keep their size.
     */
    private placeMapNodes(): void {
        const map = this.map, b = this.mapBounds[map.id], fit = ScreenFit.current, frame = fit.frame;
        // Fill to the screen edges (under notches and rounded corners).
        const cover = fit.tablet ? { x: 0, y: -frame.y, width: frame.width, height: fit.visible.height }
            : { x: -frame.x, y: -frame.y, width: fit.visible.width, height: fit.visible.height };
        const p = b ? placeMap(frame, { top: b.top - H / 2, bottom: b.bottom - H / 2 }, { width: W, height: H }, cover, this.picture(map.id))
            : { scale: Math.max(frame.width / W, frame.height / H), offsetY: 0 };
        for (const view of [this.home, this.build]) {
            if (!view?.isValid) continue;
            const mount = view.element('MapMount');
            mount.setScale(p.scale, p.scale, 1);
            mount.setPosition(frame.x, frame.y + p.offsetY, 0);
        }
        for (const anchor of this.anchors.values()) if (anchor.isValid) anchor.node.setScale(1 / p.scale, 1 / p.scale, 1);
    }
    private picture(mapId: string): Picture { return this.mapBounds[mapId]?.picture ?? { x: 0, y: 0, width: W, height: H }; }
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
        const pending = this.scope.load(assetId, SpriteFrame).then(frame => { if (sprite.isValid) sprite.spriteFrame = frame; }, error => console.error(error))
            .then(() => { const i = this.pendingFrames.indexOf(pending); if (i >= 0) this.pendingFrames.splice(i, 1); });
        this.pendingFrames.push(pending);
    }
    /** Resolves once every picture requested so far (map, buildings) is on screen. */
    public async ready(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 0)); // the page's synchronous setup runs first
        while (this.pendingFrames.length) await Promise.all([...this.pendingFrames]);
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
        this.home.setText('play_level', mainlineFinished(s, rules) && !s.mainline.attempt ? '复玩' : s.mainline.attempt?.levelNo ?? s.mainline.nextLevelNo);
        // Looking back at a finished map: nothing to build there, the back entry takes the build entry's place.
        // In build mode every S02 control stays hidden (openBuild).
        if (!this.build?.isValid) {
            const current = !this.viewMapId;
            for (const id of ['home_btn_build', 'icon_build', 'build_text']) this.home.setVisible(id, current);
            for (const id of ['home_btn_back', 'icon_back', 'back_text']) this.home.setVisible(id, !current);
            this.home.setVisible('build_reddot', current && this.canBuild());
        }
        if (!this.build?.isValid) { this.home.setVisible('signin_reddot', this.daily.signInDot()); this.home.setVisible('task_reddot', this.daily.taskDot()); }
        if (!this.construction) for (const b of map.buildings) this.buildings.get(b.id)?.isValid && this.setFrame(this.buildings.get(b.id)!, b.assetIds[buildingLevel(s, map.id, b.id)]);
        if (this.build?.isValid) this.renderBuild();
        this.renderEnergy();
        this.renderGuide();
    }
    /** Light build prompt: some building on the current map is affordable now. */
    private canBuild(): boolean {
        const s = this.game.state, rules = this.game.rules, mapId = s.maps.currentMapId;
        return rules.maps.find(m => m.id === mapId)!.buildings.some(b => { const cost = upgradeCost(s, rules, mapId, b.id); return cost !== null && s.wallet.coins >= cost; });
    }
    /** Points at the one control the first-run guide waits for; dialogs place their own pointer. */
    private renderGuide(): void {
        if (this.nav.dialogOpen) return;
        const step = this.guide.step;
        if (step === 'goBuild' && !this.build?.isValid) this.guide.point(this.home!.element('home_btn_build'), 'build', 'left');
        else if (step === 'goBuild') {
            const anchor = this.anchors.get(this.game.rules.guideBuildingId);
            if (anchor?.isValid && anchor.has('cost')) this.guide.point(anchor.element('cost'), 'upgrade');
        } else if (step === 'firstPuzzle') this.guide.point(this.home!.element('home_play_btn'), 'drag1');
        else this.guide.clear();
    }
    private renderEnergy(): void {
        // Ticks every second from update(); the top page may be the map list or a puzzle.
        for (const view of new Set([this.home, this.build, this.nav.topPage])) showEnergy(view, this.game);
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
        this.placeMapNodes();
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
        if (this.construction || this.nav.dialogOpen || !this.guide.allows('build', 'upgrade:' + buildingId)) return;
        const buildId = `${buildingId}:${this.game.now()}`;
        try {
            this.game.act(s => startBuild(s, this.game.rules, this.map.id, buildingId, buildId));
            this.beginConstruction(buildId, buildingId);
        } catch (error) {
            if (error instanceof RuleError && error.code === 'coins') this.rewards.coinsShort(upgradeCost(this.game.state, this.game.rules, this.map.id, buildingId)!, () => this.play());
            else this.rewards.failure(error);
        }
    }
/**
     * Construction: the unified build effect plays over the old building; when its tools
     * stop (config constructionSeconds) the level is committed, and only after a successful
     * save the next-level picture pops in while the effect's sparkle finishes.
     */
    private beginConstruction(buildId: string, buildingId: string): void {
        const building = this.buildings.get(buildingId);
        if (!building) return;
        const b = this.map.buildings.find(x => x.id === buildingId)!, pending = this.game.state.pendingBuild;
        if (pending) void this.scope.load(b.assetIds[pending.toLevel], SpriteFrame).catch(() => undefined); // ready for the swap
        this.construction = { buildId, buildingId, elapsed: 0, fx: null };
        const c = this.construction;
        void this.loadFx().then(data => {
            if (!data || this.construction !== c || !building.isValid) return;
            const ui = building.node.getComponent(UITransform)!, mount = building.node.parent!;
            const node = new Node('BuildFx');
            node.layer = mount.layer; node.parent = mount;
            node.addComponent(UITransform);
            // Centre of the building picture, whatever its anchor (feet) is.
            node.setPosition(building.node.position.x + (0.5 - ui.anchorX) * ui.width * Math.sign(building.node.scale.x), building.node.position.y + (0.5 - ui.anchorY) * ui.height, 0);
            const s = Math.max(FX_SCALE.min, Math.min(FX_SCALE.max, ui.width / FX_REFERENCE_WIDTH));
            node.setScale(s, s, 1);
            // Speed so the tools stop exactly at the configured construction time.
            void node.addComponent(BuildFx).play(data, this.scope, BuildFx.revealTime(data) / this.game.rules.build.constructionSeconds);
            c.fx = node;
        });
        this.render();
    }
    private loadFx(): Promise<BuildFxData | null> {
        this.fxData ??= this.scope.load('fx.build', JsonAsset).then(a => a.json as BuildFxData, error => { console.error(error); return null; });
        return this.fxData;
    }
    private stepConstruction(dt: number): void {
        const c = this.construction!;
        c.elapsed += dt;
        if (c.elapsed < this.game.rules.build.constructionSeconds) return;
        try {
            // Commit first; only a saved level is shown. A failed write keeps the pending build for retry.
            this.game.act(s => finishBuild(s, this.game.rules, c.buildId, this.game.day()));
            this.construction = null;
            this.render();
            this.popBuilding(c.buildingId);
            this.rewards.drain();
        } catch (error) {
            this.construction = null;
            if (c.fx?.isValid) c.fx.destroy();
            this.rewards.failure(error, () => this.beginConstruction(c.buildId, c.buildingId));
        }
    }
    /** The new level appears with a small bounce (kept mirrored for flipped buildings). */
    private popBuilding(buildingId: string): void {
        const node = this.buildings.get(buildingId)?.node;
        if (!node?.isValid) return;
        const sx = Math.sign(node.scale.x) || 1, at = (k: number) => new Vec3(sx * k, k, 1);
        node.setScale(at(0.88));
        tween(node).to(0.16, { scale: at(1.06) }, { easing: 'quadOut' }).to(0.14, { scale: at(1) }, { easing: 'quadIn' }).start();
    }

    /** Level badge: current level, exp and what the next level gives. */
    private levelInfo(): void {
        const s = this.game.state, rules = this.game.rules, row = rules.levels[Math.min(s.player.level - 1, rules.levels.length - 1)];
        const next = rules.levels[Math.min(s.player.level, rules.levels.length - 1)]?.rewardId ?? row.rewardId;
        const prize = next ? rewardText(reward(rules, next)) : '';
        this.guide.flash(`等级 ${s.player.level} · 经验 ${s.player.exp}/${row.expToNext}${prize ? `\n升级奖励 ${prize}` : ''}`);
    }
    /** Build-mode gift: the completion reward of the map being built. */
    private giftInfo(): void {
        const s = this.game.state, rules = this.game.rules, map = rules.maps.find(m => m.id === s.maps.currentMapId)!;
        const p = mapProgress(s, rules, map.id), prize = map.completionRewardId ? rewardText(reward(rules, map.completionRewardId)) : '';
        this.guide.flash(s.maps.completed[map.id] ? '本地图已完工，奖励已发放' : `建设进度 ${p.built}/${p.total}\n完工奖励 ${prize}`);
    }
    private play(): void { this.guide.clear(); this.onPlay?.(); }
    private onHomeAction(id: string): void {
        if (this.nav.dialogOpen || !this.guide.allows('home', id)) return;
        switch (id) {
            case 'home_play_btn':
                // A saved attempt always resumes first; the replay list never silently replaces it.
                if (mainlineFinished(this.game.state, this.game.rules) && !this.game.state.mainline.attempt) { this.guide.clear(); this.onReplay?.(); return; }
                return this.play();
            case 'map_name': return this.onMaps?.();
            case 'hud_level_badge': return this.levelInfo();
            case 'home_btn_back': void this.enter(); return;
            case 'home_btn_build': void this.openBuild(); return;
            case 'hud_btn_square_purple': return this.rewards.settings();
            case 'hud_energy': return this.rewards.energy(false);
            case 'signin_entry': return this.daily.openSignIn();
            case 'task_entry': return this.daily.openTasks();
            case 'endless_entry':
                if (endlessUnlocked(this.game.state, this.game.rules)) this.onEndless?.();
                else this.guide.flash(`通关第${this.game.rules.endless.unlockAfterLevelNo}关后开放蜂巢消消乐`);
                return;
        }
    }
    private onBuildAction(id: string): void {
        if (this.nav.dialogOpen || !this.guide.allows('build', id)) return;
        switch (id) {
            case 'home_btn_home': return this.closeBuild();
            case 'icon_gift': return this.giftInfo();
            case 'hud_btn_square_purple': return this.rewards.settings();
            case 'hud_energy': return this.rewards.energy(false);
        }
    }
}

function rewardText(r: Reward): string {
    return [r.coins && `金币+${r.coins}`, r.energy && `体力+${r.energy}`, r.hints && `提示+${r.hints}`].filter(Boolean).join(' ');
}
