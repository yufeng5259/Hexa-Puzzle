import { type Camera, type EventTouch, Node, Sprite, SpriteFrame, Tween, tween, UITransform, Vec3 } from 'cc';
import { TooltipBubble, type TooltipItem } from '../features/ui/TooltipBubble';
import { BuildFx } from '../features/fx/BuildFx';
import { revealSeconds, startSeconds } from '../features/fx/BuildTimeline';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { MapView } from '../core/Config';
import type { Game } from '../core/Game';
import { hudText, hudValue, showEnergy, showLevel } from './EnergyHud';
import { setProgress } from '../features/ui/ProgressBar';
import { finishBuild, goToNextMap, mapProgress, startBuild, upgradeCost } from '../core/Progress';
import { guideAllowsBuild } from '../core/Guide';
import { mainlineFinished } from '../core/Mainline';
import { endlessUnlocked } from '../core/Progress';
import { payout, reward, RuleError } from '../core/Rules';
import { rewardText } from '../core/Display';
import { buildingLevel } from '../core/State';
import type { LayoutView } from '../features/ui/LayoutView';
import { ScreenFit } from '../features/ui/ScreenFit';
import { placeMap, type Picture } from '../features/ui/FitMath';
import { hitBuilding, isTap } from '../features/ui/MapHit';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';
import type { GuideCoach } from './GuideCoach';
import { DailyPresenter } from './DailyPresenter';
import type { LocalLeaderboardService } from '../core/LeaderboardService';

const W = 853, H = 1844;

/**
 * S02 home and S03 build mode. Both share one map instance: the map lives in the
 * S02 page, build mode is the S03 page pushed above it with its own map mount empty.
 */
export class HomeController {
    public onPlay: (() => void) | null = null;
    public onEndless: (() => void) | null = null;
    /** Bee league (set by GameBoot): a waiting settlement puts a red dot on the endless entry. */
    public leaderboard: LocalLeaderboardService | null = null;
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
    /** Map the build anchors were made for; a map change while building (S15 "前往下一图") remakes them. */
    private anchorsMapId = '';
    private anchorsRequest = 0;
    private construction: { buildId: string; buildingId: string; elapsed: number; fx: Node | null } | null = null;
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
    /** Build progress last drawn on the build page. */
    private shownBuilt: { mapId: string; built: number } | null = null;
    private lastTick = 0;
    /** Finger down on the map page (world point), to tell a building tap from a drag. */
    private press: { pointer: number; x: number; y: number } | null = null;
    private beePatrol: Tween<Node> | null = null;

    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader, private readonly guide: GuideCoach, private readonly inputCamera: Camera | null = null) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.render(), true, guide);
        this.rewards.onEndless = () => this.onEndless?.();
        this.rewards.onMapTransition = (doneId, done, next) => void this.mapTransition(doneId, done, next);
        this.rewards.onReturnHome = () => void this.enter();
        this.rewards.onIdle = () => this.checkAutoSignIn();
        this.daily = new DailyPresenter(game, nav, this.rewards, { play: () => this.play(), build: () => void this.openBuild(), endless: () => this.onEndless?.() });
    }

    /** instant: first page under the boot loading screen (no transition). */
    public async enter(viewMapId: string | null = null, instant = false): Promise<void> {
        this.viewMapId = viewMapId === this.game.state.maps.currentMapId ? null : viewMapId;
        // Settles a finished league day / week so its red dot shows (writes only when needed).
        try { this.leaderboard?.refresh(); } catch (error) { console.error(error); }
        // The transition stays closed until the map and building pictures are loaded.
        this.home = await this.nav.replacePage('S02', id => this.onHomeAction(id), { instant, prepare: () => this.ready() });
        this.listen(this.home);
        this.build = null; this.anchors.clear(); this.anchorsMapId = ''; this.anchorsRequest++; this.shownBuilt = null; this.buildings.clear(); this.mapId = '';
        this.unsubscribe?.();
        this.unsubscribe = this.game.subscribe(() => this.render());
        ScreenFit.events.off('changed', this.onFit);
        ScreenFit.events.on('changed', this.onFit);
        this.daily.rollover();
        await this.renderMap();
        this.render();
        // A build paid for before a crash finishes without charging again.
        const pending = this.game.state.pendingBuild;
        if (pending) { await this.openBuild(); this.beginConstruction(pending.buildId, pending.buildingId, true); }
        else this.rewards.drain(true);
        setTimeout(() => this.checkAutoSignIn(), 600);
    }

    /** Shows the sign-in dialog once per day on first visit to home, after all reward dialogs settle. */
    private checkAutoSignIn(): void {
        if (this.build?.isValid || this.nav.dialogOpen || this.nav.transitioning) return;
        if (this.daily.signInDot()) this.daily.openSignIn();
    }

    public update(dt: number): void {
        const now = this.game.now();
        if (now - this.lastTick >= 1000) { this.lastTick = now; try { this.game.tick(); } catch (error) { console.error(error); } this.renderEnergy(); if (this.home?.isValid) this.daily.tick(); }
        if (this.construction) this.stepConstruction(dt);
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
        const pic = this.picture(map.placeholderOf ?? map.id);
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
        const map = this.map, b = this.mapBounds[map.placeholderOf ?? map.id], fit = ScreenFit.current, frame = fit.frame;
        // Fill to the screen edges (under notches and rounded corners).
        const cover = fit.tablet ? { x: 0, y: -frame.y, width: frame.width, height: fit.visible.height }
            : { x: -frame.x, y: -frame.y, width: fit.visible.width, height: fit.visible.height };
        const p = b ? placeMap(frame, { top: b.top - H / 2, bottom: b.bottom - H / 2 }, { width: W, height: H }, cover, this.picture(map.placeholderOf ?? map.id))
            : { scale: Math.max(frame.width / W, frame.height / H), offsetY: 0 };
        for (const view of [this.home, this.build]) {
            if (!view?.isValid) continue;
            const mount = view.element('MapMount');
            mount.setScale(p.scale, p.scale, 1);
            mount.setPosition(frame.x, frame.y + p.offsetY, 0);
        }
        for (const anchor of this.anchors.values()) if (anchor.isValid) anchor.node.setScale(1 / p.scale, 1 / p.scale, 1);
    }
    /**
     * Non-terminal map complete (docs/v2/14 §6.3): honeycomb covers, game switches to the next
     * map, then reveals the new map. A short toast slides down and auto-dismisses.
     */
    private async mapTransition(_doneId: string, _done: MapView, _next: MapView): Promise<void> {
        // Advance the game state now, then close the build page and navigate home.
        // The Transition (honeycomb cover/reveal) already plays inside enter() via replacePage,
        // so no extra toast is shown — the new map simply appears after the hexagons open.
        try { this.game.act(st => goToNextMap(st, this.game.rules)); } catch (e) { console.error(e); }
        this.viewMapId = null;
        if (this.build?.isValid) this.nav.popPage();
        await this.enter();
    }

    /** Bounds are measured per art set; a placeholder map uses its stand-in's art. */
    private picture(artId: string): Picture { return this.mapBounds[artId]?.picture ?? { x: 0, y: 0, width: W, height: H }; }
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
        for (const view of [this.home, this.build]) {
            if (!view?.isValid) continue;
            showLevel(view, this.game);
            hudText(view, 'coin_value', hudValue(this.game, 'coins'), this.nav.fx);
            view.setText('map_name', map.name);
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
        if (!this.build?.isValid) {
            this.home.setVisible('signin_reddot', this.daily.signInDot()); this.home.setVisible('task_reddot', this.daily.taskDot());
            if (this.home.has('endless_reddot')) this.home.setVisible('endless_reddot', endlessUnlocked(s, this.game.rules) && (this.leaderboard?.pendingCount ?? 0) > 0);
        }
        if (!this.construction) for (const b of map.buildings) this.buildings.get(b.id)?.isValid && this.setFrame(this.buildings.get(b.id)!, b.assetIds[buildingLevel(s, map.id, b.id)]);
        if (this.build?.isValid && this.anchorsMapId && this.anchorsMapId !== map.id) void this.makeAnchors();
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
        for (const view of new Set([this.home, this.build, this.nav.topPage])) showEnergy(view, this.game, this.nav.fx);
    }

    private opening: Promise<void> | null = null;
    /** One build page even if the entry button and a building are tapped in quick succession. */
    private openBuild(): Promise<void> {
        if (this.build?.isValid) return Promise.resolve();
        this.opening ??= this.pushBuild().finally(() => { this.opening = null; });
        return this.opening;
    }
    private async pushBuild(): Promise<void> {
        this.build = await this.nav.pushPage('S03', id => this.onBuildAction(id));
        // Sync HUD values immediately so S03's labels show correct numbers on the first fadeIn frame.
        this.render();
        this.listen(this.build);
        // Only the operation layer changes: hide S02 controls, keep its map.
        for (const id of this.home!.nodeIds) if (id !== 'MapMount') this.home!.setVisible(id, false);
        await this.makeAnchors();
        this.startBeePatrol();
    }
    /**
     * One upgrade anchor (level dots + cost) per building of the shown map. Old anchors are removed
     * first: after "前往下一图" in build mode they belonged to the finished map (all dots full, at
     * that map's building places) and their cost buttons would upgrade buildings of the wrong map.
     */
    private async makeAnchors(): Promise<void> {
        const build = this.build, map = this.map, request = ++this.anchorsRequest;
        if (!build?.isValid) return;
        for (const anchor of this.anchors.values()) if (anchor.isValid) anchor.node.destroy();
        this.anchors.clear();
        this.anchorsMapId = map.id;
        const mount = build.element('MapMount');
        for (const b of map.buildings) {
            const view = await this.nav.instantiate('BuildAnchor', mount, id => { if (id === 'upgrade') this.upgrade(b.id); });
            // A newer request (another map change) or a closed build page owns the anchors now.
            if (request !== this.anchorsRequest || !build.isValid) { view.node.destroy(); return; }
            view.node.setPosition((b.feetX - 0.5) * W, (0.5 - b.feetY) * H, 0);
            this.anchors.set(b.id, view);
        }
        this.placeMapNodes();
        this.render();
    }
    /**
     * Building taps on S02/S03. Listened on the page root in the bubble phase: buttons (HUD, cost capsule)
     * stop propagation, so only touches on bare map arrive here. The listener goes with the page node.
     */
    private listen(view: LayoutView): void {
        view.node.on(Node.EventType.TOUCH_START, (e: EventTouch) => { const p = this.worldPoint(e); this.press = { pointer: e.getID(), x: p.x, y: p.y }; });
        view.node.on(Node.EventType.TOUCH_CANCEL, () => { this.press = null; });
        view.node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            const press = this.press, p = this.worldPoint(e);
            this.press = null;
            if (!press || press.pointer !== e.getID() || !isTap(press, p) || !this.home?.isValid) return;
            const ui = this.home.element('MapMount').getComponent(UITransform)!, local = ui.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
            const id = hitBuilding(this.map.buildings, local.x, local.y, { width: W, height: H });
            if (id) this.tapBuilding(id);
        });
    }
    private worldPoint(event: EventTouch): { x: number; y: number } {
        if (!this.inputCamera) return event.getUILocation();
        const screen = event.getLocation(), world = this.inputCamera.screenToWorld(new Vec3(screen.x, screen.y, 0));
        return { x: world.x, y: world.y };
    }
    /** S02: enter build mode with that building highlighted, nothing charged. S03: same as its cost capsule. */
    private tapBuilding(buildingId: string): void {
        if (this.nav.dialogOpen || this.nav.transitioning) return;
        if (this.build?.isValid) {
            if (!this.guide.allows('build', 'upgrade:' + buildingId)) return;
            const s = this.game.state;
            if (this.construction || s.pendingBuild) { this.nudge(buildingId); this.guide.flash('正在建造中，请稍候'); return; }
            if (upgradeCost(s, this.game.rules, this.map.id, buildingId) === null) { this.nudge(buildingId); this.guide.flash('已建到最高级'); return; }
            this.upgrade(buildingId);
            return;
        }
        // A finished map being looked at has nothing to build.
        if (this.viewMapId || !this.guide.allows('home', 'building:' + buildingId)) return;
        void this.openBuild().then(() => this.nudge(buildingId));
    }
    /** Small bounce on a building: highlight after entering build mode, or "nothing to do" feedback. */
    private nudge(buildingId: string): void {
        const node = this.buildings.get(buildingId)?.node;
        if (!node?.isValid || this.construction?.buildingId === buildingId) return;
        const sx = Math.sign(node.scale.x) || 1, at = (k: number) => new Vec3(sx * k, k, 1);
        Tween.stopAllByTarget(node);
        node.setScale(at(1));
        tween(node).to(0.1, { scale: at(1.06) }, { easing: 'quadOut' }).to(0.12, { scale: at(1) }, { easing: 'quadIn' }).start();
    }
    private closeBuild(): void {
        if (this.construction) return; // leaving is locked while building
        this.stopBeePatrol();
        TooltipBubble.dismiss();
        this.nav.popPage();
        this.build = null; this.anchors.clear(); this.anchorsMapId = ''; this.anchorsRequest++; this.shownBuilt = null;
        for (const id of this.home!.nodeIds) this.home!.setVisible(id, true);
        this.render();
        this.checkAutoSignIn();
    }
    private renderBuild(): void {
        const s = this.game.state, map = this.map, progress = mapProgress(s, this.game.rules, map.id);
        this.build!.setText('home_progress', `${progress.built}/${progress.total}`);
        // Rises smoothly after a build lands; a new map or a reopened build page shows its value at once.
        const rose = this.shownBuilt?.mapId === map.id && progress.built > this.shownBuilt.built;
        setProgress(this.build!.element('bar_fill_green_2'), progress.built / progress.total, rose ? this.game.rules.anim.progressSeconds : 0);
        this.shownBuilt = { mapId: map.id, built: progress.built };
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
     * Construction (docs/v2/13 §2): the bee crew plays over the old building; at the reveal
     * (config buildFxRevealAt, under the dust cloud) the level is committed, and only after a
     * successful save the next-level picture pops in while the cloud clears and the sparkle ends.
     * resumed: a build paid for before a restart plays a short finish.
     */
    private beginConstruction(buildId: string, buildingId: string, resumed = false): void {
        const building = this.buildings.get(buildingId);
        if (!building) return;
        const b = this.map.buildings.find(x => x.id === buildingId)!, pending = this.game.state.pendingBuild, rules = this.game.rules.build;
        if (pending) void this.scope.load(b.assetIds[pending.toLevel], SpriteFrame).catch(() => undefined); // ready for the swap
        const start = startSeconds(rules.constructionSeconds, rules.fx, resumed), mount = building.node.parent!;
        const node = new Node('BuildFx');
        node.layer = mount.layer;
        node.addComponent(UITransform);
        // Just above its building (buildings in front still cover it), at the building's feet.
        mount.insertChild(node, building.node.getSiblingIndex() + 1);
        node.setPosition(building.node.position);
        node.addComponent(BuildFx).play({ building: building.node, seconds: rules.constructionSeconds, timing: rules.fx, scope: this.scope, start });
        this.construction = { buildId, buildingId, elapsed: start, fx: node };
        this.render();
    }
    private stepConstruction(dt: number): void {
        const c = this.construction!;
        c.elapsed += dt;
        if (c.elapsed < revealSeconds(this.game.rules.build.constructionSeconds, this.game.rules.build.fx)) return;
        try {
            // Commit first; only a saved level is shown. A failed write keeps the pending build for retry.
            this.game.act(s => finishBuild(s, this.game.rules, c.buildId, this.game.day()));
            this.construction = null;
            this.render();
            this.popBuilding(c.buildingId);
            this.rewards.drain(true);
        } catch (error) {
            this.construction = null;
            if (c.fx?.isValid) c.fx.destroy();
            this.rewards.failure(error, () => this.beginConstruction(c.buildId, c.buildingId, true));
        }
    }
    /** The new level appears with a small bounce (kept mirrored for flipped buildings). */
    private popBuilding(buildingId: string): void {
        const node = this.buildings.get(buildingId)?.node;
        if (!node?.isValid) return;
        const sx = Math.sign(node.scale.x) || 1, at = (k: number) => new Vec3(sx * k, k, 1);
        Tween.stopAllByTarget(node);
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

    // ---- bee patrol (S03 build page idle animation) -------------------------

    /**
     * Four fixed waypoints the bee flies between in the build scene.
     * Coordinates are design-space (853×1844, centre=0,0), chosen to stay
     * clear of buildings and the HUD band.  The bee hovers at each stop
     * with a gentle bob before flying to the next.
     */
    private static readonly BEE_WAYPOINTS: readonly Vec3[] = [
        new Vec3(  80, -540, 0),   // lower-left area
        new Vec3(-130, -380, 0),   // mid-left
        new Vec3( 160, -260, 0),   // mid-right
        new Vec3( -60, -610, 0),   // bottom-centre
    ];
    private static readonly BEE_FLY_S = 2.5;   // seconds per hop
    private static readonly BEE_BOB_S = 0.7;   // seconds per bob half-cycle
    private static readonly BEE_BOB_Y = 10;    // bob amplitude (px)
    private static readonly BEE_BOB_REPS = 4;  // bob repetitions per stop

    private startBeePatrol(): void {
        const bee = this.build?.element('bee_wave');
        if (!bee?.isValid) return;
        this.stopBeePatrol();
        const pts = HomeController.BEE_WAYPOINTS;
        let idx = 0;
        const flyNext = (): void => {
            if (!bee.isValid || !this.build?.isValid) return;
            const dest = pts[idx % pts.length];
            idx++;
            // face direction of travel
            const dx = dest.x - bee.position.x;
            if (Math.abs(dx) > 10) bee.setScale(dx < 0 ? -1 : 1, 1, 1);
            const bobBase = dest.y;
            const reps = HomeController.BEE_BOB_REPS;
            const bs = HomeController.BEE_BOB_S, by = HomeController.BEE_BOB_Y;
            // Build bob sequence dynamically: up→down repeated reps times, then back to base
            let t = tween(bee).to(HomeController.BEE_FLY_S, { position: dest }, { easing: 'sineInOut' });
            for (let i = 0; i < reps; i++) {
                t = t.to(bs, { position: new Vec3(dest.x, bobBase + by, 0) }, { easing: 'sineInOut' })
                     .to(bs, { position: new Vec3(dest.x, bobBase - by, 0) }, { easing: 'sineInOut' });
            }
            this.beePatrol = t.to(bs, { position: dest }, { easing: 'sineInOut' }).call(flyNext).start();
        };
        // small initial delay so the page settles first
        setTimeout(flyNext, 800);
    }

    private stopBeePatrol(): void {
        this.beePatrol?.stop();
        this.beePatrol = null;
        const bee = this.build?.element('bee_wave');
        if (bee?.isValid) Tween.stopAllByTarget(bee);
    }
    /** Build-mode gift: the completion reward of the map being built. */
    private giftInfo(): void {
        const s = this.game.state, rules = this.game.rules, map = rules.maps.find(m => m.id === s.maps.currentMapId)!;
        const p = mapProgress(s, rules, map.id), prize = map.completionRewardId ? payout(s, rules, map.completionRewardId) : null;
        const anchor = this.build?.element('icon_gift');
        if (!anchor) return;
        const items: TooltipItem[] = [];
        if (s.maps.completed[map.id]) {
            items.push({ icon: '✅', label: '本地图已完工，奖励已发放' });
        } else {
            items.push({ icon: '🏗️', label: `建设进度 ${p.built}/${p.total}` });
            if (prize?.coins) items.push({ icon: '🪙', label: `金币 ×${prize.coins}` });
            if (prize?.energy) items.push({ icon: '❤️', label: `体力 ×${prize.energy}` });
            if (prize?.hints) items.push({ icon: '💡', label: `提示 ×${prize.hints}` });
        }
        TooltipBubble.show(anchor, items, '完工奖励');
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
