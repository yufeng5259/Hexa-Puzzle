import { Camera, Color, EventTouch, game as engine, Game as Engine, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { Game } from '../core/Game';
import {
    boardCells, boardLines, canPlace, claimEndlessStage, endEndlessGame, endlessOutcome, endlessSummary, hammerCell, key, newEndlessGame, placeShape, refreshWeek,
    swapTray, toolBlock, toolsLeft, type EndlessOutcome, type EndlessTool, type ToolBlock,
} from '../core/Endless';
import { reward, RuleError, type EndlessShape } from '../core/Rules';
import { EndlessFx, type EndlessArt } from '../features/fx/EndlessFx';
import { axialPoint, centeredCells, fitCells, nearestAxial, type Point2 } from '../features/puzzle/presentation/PuzzleLayout';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';
import type { GuideCoach } from './GuideCoach';
import type { LocalLeaderboardService } from '../core/LeaderboardService';
import type { LeaguePage } from './LeaguePage';

/** Shape colour index -> piece texture (the mainline catalog's hex art). */
const COLORS = ['1_png', '6_png', '8_png', '9_png', '10_png', '3_png'].map(t => `hex.${t}`);
const TRAY_MAX_RADIUS = 34;
/** The dragged shape floats above the finger so the target cells stay visible. */
const LIFT = 150;
const FEEDBACK_SECONDS = 1.6;
/** S19 status text colours as drawn: "已领取" (row 0) and "未解锁" (rows 2, 3). */
const STATUS_COLOR = { claimed: new Color(0x31, 0x66, 0x4d, 255), locked: new Color(0x5e, 0x6c, 0x84, 255) };
const RULE_HINT = '三个方向填满整线即可消除';
const RESCUE_HINT = '暂无位置：可用道具继续，或结束本局';
const AIM_HINT = '选择要移除的一格（再点锤子取消）';
const TOOL_NAME: Record<EndlessTool, string> = { swap: '换一手', hammer: '单格锤' };
const BLOCKED: Record<ToolBlock, (tool: EndlessTool) => string> = {
    used: tool => `${TOOL_NAME[tool]}本局已用完`, noSlot: () => '没有可换的拼块', noShape: () => '没有能放下的新拼块', emptyBoard: () => '棋盘上还没有可移除的格子',
};
const HAMMER_ART = 'UI/特效/build/fx_build_hammer.png';
const HELP = '把下方拼块拖进蜂巢。横向、左斜、右斜任一方向整条线填满就会消除，颜色不用相同。一次消除多条线得分更高。每局可免费用一次“换一手”（替换托盘里剩下的拼块）和“单格锤”（敲掉一格，不得分）；拼块都放不下且道具用完时本局结束。';

interface CellView { base: Sprite; overlay: Sprite }
/** What S20 shows instead of the saved game while a placement plays (each part returns to the saved one on its cue). */
interface Shown { board?: Record<string, number>; tray?: (string | null)[]; score?: number }
const BURST = Array.from({ length: 6 }, (_, i) => `UI/特效/fx_line_clear/fx_line_clear_0${i + 1}.png`);
const CONFETTI = Array.from({ length: 4 }, (_, i) => `UI/特效/fx_confetti_0${i + 1}.png`);
interface Drag { slot: number; node: Node; pointer: number; target: { q: number; r: number } | null; valid: boolean }

/**
 * S19 activity page, S20 61-cell board, S21 results and S22 leave. The running game
 * (board, remaining tray, score, deal seed) is saved with every placement, so leaving
 * or reloading never redraws the batch. Weekly points are added per placement.
 */
export class EndlessPage {
    public onHome: (() => void) | null = null;
    /** S26 bee league (set by GameBoot): the S19 entry opens it; waiting settlements pop up on S19. */
    public league: LeaguePage | null = null;
    private readonly scope: ResourceScope;
    private readonly rewards: RewardPresenter;
    private view: LayoutView | null = null;
    private page: 'S19' | 'S20' | null = null;
    private cells = new Map<string, CellView>();
    private radius = 0;
    private offset: Point2 = { x: 0, y: 0 };
    private slots: (Node | null)[] = [];
    private trayRadius = 0;
    private drag: Drag | null = null;
    private feedbackUntil = 0;
    private feedback = '';
    /** "单格锤" picked: the next tap on a filled cell removes it (nothing is spent until then). */
    private aiming = false;
    /** Last frame state of each tool button, so a render only reloads a picture when it changes. */
    private toolLook: Partial<Record<EndlessTool, boolean>> = {};
    private request = 0;
    private unsubscribe: (() => void) | null = null;
    private readonly fx: EndlessFx;
    private art: EndlessArt = { glow: null, burst: [], confetti: [], hammer: null };
    private artLoading = false;
    private shown: Shown | null = null;
    /** From the end-of-game save until S21's buttons work: no dragging, no leaving. */
    private finishing = false;

    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader,
        private readonly inputCamera: Camera | null, private readonly guide: GuideCoach, private readonly leaderboard: LocalLeaderboardService) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.render(), false);
        this.fx = new EndlessFx(game.rules.anim, () => this.art);
        engine.on(Engine.EVENT_HIDE, this.cancelAim, this);
    }

    private get state() { return this.game.state.endless; }
    private get shapes(): readonly EndlessShape[] { return this.game.rules.endless.shapes; }
    private shape(id: string): EndlessShape { return this.shapes.find(s => s.id === id)!; }

    /** S19. Re-reads the week first so an old panel never maps onto the new week's stages. */
    public async open(): Promise<void> {
        const request = ++this.request;
        this.rollWeek();
        const view = await this.nav.replacePage('S19', id => this.onActivity(id));
        if (request !== this.request) return;
        this.attach(view, 'S19');
        this.render();
        this.renderLeague(view);
        if (this.leaderboard.pendingCount && this.league) {
            this.league.closed = () => { if (this.view === view) this.renderLeague(view); };
            void this.league.showSettlements();
        }
    }
    /** S19 league entry: today's rank under the button, a red dot while a settlement waits. */
    private renderLeague(v: LayoutView): void {
        if (!v.isValid || !v.has('league_entry')) return;
        v.setVisible('league_reddot', this.leaderboard.pendingCount > 0);
        this.league?.todayRank().then(rank => { if (v.isValid) v.setText('league_entry_rank', rank || '联赛'); }, error => console.error(error));
    }

    /** Straight into a game (S26 "去挑战"): continues the saved one or starts a free new one. */
    public start(): Promise<void> { return this.play(); }

    public update(dt = 0): void {
        this.fx.update(dt);
        if (!this.view?.isValid) return;
        if (this.page === 'S19') { this.rollWeek(); this.view.setText('weekly_reset', `每周一0点刷新 · ${countdown(this.game.msToNextWeek())}`); }
        if (this.page === 'S20' && this.feedbackUntil && this.game.now() > this.feedbackUntil) { this.feedbackUntil = 0; this.renderHint(this.view); }
        if (this.page === 'S20' && this.nav.dialogOpen && this.drag) this.cancelDrag();
        if (this.page === 'S20' && this.nav.dialogOpen && this.aiming) this.cancelAim();
    }

    public dispose(): void { engine.off(Engine.EVENT_HIDE, this.cancelAim, this); this.detach(); this.fx.dispose(); this.scope.release(); }

    private rollWeek(): void {
        if (this.state.weekId === this.game.week()) return;
        try { this.game.act(s => refreshWeek(s, this.game.week())); } catch (error) { console.error(error); }
    }

    private attach(view: LayoutView, page: 'S19' | 'S20'): void {
        this.detach();
        this.view = view; this.page = page;
        this.unsubscribe = this.game.subscribe(() => this.render());
    }
    private detach(): void {
        this.fx.stop(); this.shown = null; this.finishing = false; this.aiming = false; this.toolLook = {}; this.feedbackUntil = 0;
        this.unsubscribe?.(); this.unsubscribe = null;
        this.drag = null; this.cells.clear(); this.slots = [];
        this.view = null; this.page = null;
    }
    private leave(): void { this.request++; this.detach(); this.guide.clear(); this.onHome?.(); }

    private render(): void {
        const v = this.view;
        if (!v?.isValid) return;
        if (this.page === 'S19') this.renderActivity(v); else if (this.page === 'S20') this.renderGame(v);
    }

    // ---- S19 -------------------------------------------------------------

    private renderActivity(v: LayoutView): void {
        const e = this.state, stages = this.game.rules.endless.stages, rules = this.game.rules;
        v.setText('weekly_score', e.weekScore.toLocaleString('en-US'));
        v.setText('record_score', e.best.toLocaleString('en-US'));
        v.setText('start_challenge_label', e.game ? '继续挑战' : '开始挑战');
        const marks = ['mark_check', 'stage_1_mark', 'mark_lock', 'mark_lock_2'];
        stages.slice(0, 4).forEach((stage, i) => {
            const reached = e.weekScore >= stage.score, claimed = e.claimedStages.includes(i);
            const r = reward(rules, stage.rewardId);
            v.setText(`stage_${i}_threshold`, stage.score.toLocaleString('en-US'));
            if (i < 3) v.setText(`stage_${i}_reward`, r.coins ? `金币 ×${r.coins}` : r.hints ? `提示 ×${r.hints}` : `体力 ×${r.energy}`);
            else { v.setText('stage_3_coin', `金币×${r.coins}`); v.setText('stage_3_energy', `体力×${r.energy}`); }
            this.frame(v, `stage_${i}_node`, `UI/无尽/endless_stage_node_${reached ? 'reached' : 'unreached'}.png`);
            if (i > 0) this.frame(v, `stage_link_${i - 1}`, `UI/无尽/endless_stage_link_${reached ? 'reached' : 'unreached'}.png`);
            const claimable = reached && !claimed;
            v.setVisible(`stage_${i}_claim`, claimable); v.setVisible(`stage_${i}_claim_label`, claimable);
            for (const id of [`stage_${i}_status`, marks[i], `stage_${i}_status_text`]) v.setVisible(id, !claimable);
            if (!claimable) {
                v.setText(`stage_${i}_status_text`, claimed ? '已领取' : '未解锁');
                v.label(`stage_${i}_status_text`).color = claimed ? STATUS_COLOR.claimed : STATUS_COLOR.locked;
                this.frame(v, `stage_${i}_status`, `UI/通用/tag_${claimed ? 'claimed' : 'locked'}.png`);
                this.frame(v, marks[i], `UI/通用/mark_${claimed ? 'check' : 'lock'}.png`);
            }
        });
    }
    private onActivity(id: string): void {
        if (this.nav.dialogOpen) return;
        const stage = /^stage_(\d)_claim$/.exec(id);
        if (id === 'home_button') this.leave();
        else if (id === 'help_button') this.help();
        else if (id === 'league_entry' && this.league) { this.request++; this.detach(); void this.league.open(); }
        else if (id === 'start_challenge') void this.play();
        else if (stage) this.claimStage(Number(stage[1]));
    }
    /** One save per stage; the saved reward then pops from the stage row (S19 has no wallet HUD, so it stays listed). */
    private claimStage(index: number): void {
        const v = this.view;
        if (!v?.isValid || this.nav.fx.busy) return;
        const week = this.game.week();
        let event;
        try { event = this.game.act(s => claimEndlessStage(s, this.game.rules, week, index)); }
        catch (error) { if (!(error instanceof RuleError)) this.rewards.failure(error); this.render(); return; }
        this.render();
        if (event) void this.rewards.collect(event.reward, [event.id], { owner: v.node, from: v.element(`stage_${index}_row`) });
    }

    /** S19 help: the HelpDialog prefab (standard dialog + rules illustration once delivered). */
    private help(): void {
        void this.nav.showDialog('HelpDialog', id => { if (id === 'confirm' || id === 'btn_close_dialog') this.nav.closeDialog(); }, v => {
            v.setText('title', '玩法说明');
            v.setText('help_text', HELP);
        });
    }

    // ---- S20 -------------------------------------------------------------

    /** Continues the saved game or starts a free new one. */
    private async play(): Promise<void> {
        if (!this.state.game) {
            try { this.game.act(s => newEndlessGame(s, this.game.rules, `endless:${this.game.now()}`, this.game.now() >>> 0)); }
            catch (error) { this.rewards.failure(error); return; }
        }
        const request = ++this.request;
        const view = await this.nav.replacePage('S20', id => this.onGame(id));
        if (request !== this.request) return;
        this.attach(view, 'S20');
        this.loadArt();
        this.buildBoard(view);
        this.listen(view);
        this.render();
        if (endlessOutcome(this.state.game!, this.game.rules) === 'over') void this.finish(false);
    }

    private buildBoard(v: LayoutView): void {
        const mount = v.element('BoardMount'), ui = mount.getComponent(UITransform)!;
        const cells = boardCells(this.game.rules.endless.radius), fit = fitCells(cells.map(([q, r]) => ({ q, r })), ui.width, ui.height, 4);
        this.radius = fit.radius;
        const first = axialPoint({ q: cells[0][0], r: cells[0][1] }, fit.radius);
        this.offset = { x: fit.centers[0].x - first.x, y: fit.centers[0].y - first.y };
        const size = [2 * fit.radius, Math.sqrt(3) * fit.radius] as const;
        cells.forEach(([q, r], i) => {
            const base = this.sprite(mount, `cell_${q}_${r}`, size[0], size[1]), overlay = this.sprite(base.node, 'overlay', size[0], size[1]);
            base.node.setPosition(fit.centers[i].x, fit.centers[i].y, 0);
            overlay.node.active = false;
            this.cells.set(key(q, r), { base, overlay });
        });
    }

    /** While a placement plays, the parts not yet on their cue show the copy from before the move. */
    private renderGame(v: LayoutView): void {
        const g = this.state.game;
        if (!g) return;
        const board = this.shown?.board ?? g.board, score = this.shown?.score ?? g.score;
        v.setText('score', `本局 ${score.toLocaleString('en-US')}`);
        v.setText('record', `最高 ${Math.max(g.bestAtStart ?? this.state.best, score).toLocaleString('en-US')}`);
        for (const [k, cell] of this.cells) this.setFrame(cell.base, k in board ? COLORS[board[k] % COLORS.length] : 'hex.empty_well');
        if (!this.drag) this.renderTray(v, this.shown?.tray ?? g.tray);
        this.renderTools(v);
        if (this.aiming) this.markTargets();
    }

    /** No piece fits but a tool can still change that: the game waits for a tool or "结束本局" (09 §7.2). */
    private get rescue(): boolean {
        const g = this.state.game;
        return !!g && !this.shown && !this.finishing && endlessOutcome(g, this.game.rules) === 'rescue';
    }

    /** Tool buttons: uses left, greyed out when not usable now; a tool configured to 0 per game is not shown. */
    private renderTools(v: LayoutView): void {
        const g = this.state.game!, rules = this.game.rules, left = toolsLeft(g, rules);
        for (const tool of ['swap', 'hammer'] as const) {
            const id = `tool_${tool}`, shown = rules.endless.tools[tool] > 0;
            for (const part of [id, `${id}_icon`, `${id}_label`, `${id}_count`]) v.setVisible(part, shown);
            if (!shown) continue;
            const on = toolBlock(g, rules, tool) === null;
            v.setText(`${id}_label`, tool === 'hammer' && this.aiming ? '取消' : TOOL_NAME[tool]);
            v.setText(`${id}_count`, `剩${left[tool]}次`);
            if (this.toolLook[tool] !== on) { this.toolLook[tool] = on; this.frame(v, id, `UI/通用/btn_blue_${on ? 'normal' : 'disabled'}.png`); }
        }
        const rescue = this.rescue;
        v.setVisible('end_rescue', rescue); v.setVisible('end_rescue_label', rescue);
        this.renderHint(v);
    }
    /** Rule line: picking a cell, then a fresh feedback, then the rescue prompt, else the rule. */
    private renderHint(v: LayoutView): void {
        const feedback = this.feedbackUntil && this.game.now() <= this.feedbackUntil ? this.feedback : '';
        v.setText('rule_hint', this.aiming ? AIM_HINT : feedback || (this.rescue ? RESCUE_HINT : RULE_HINT));
    }
    private say(text: string): void {
        this.feedback = text;
        this.feedbackUntil = this.game.now() + FEEDBACK_SECONDS * 1000;
        if (this.view?.isValid) this.renderHint(this.view);
    }

    private renderTray(v: LayoutView, ids: readonly (string | null)[]): void {
        const tray = v.element('TrayMount'), ui = tray.getComponent(UITransform)!, width = ui.width / ids.length;
        for (const node of this.slots) if (node?.isValid) node.destroy();
        const fits = ids.filter((id): id is string => !!id)
            .map(id => fitCells(this.shape(id).cells.map(([q, r]) => ({ q, r })), width - 16, ui.height - 16).radius);
        this.trayRadius = Math.min(TRAY_MAX_RADIUS, ...fits);
        this.slots = ids.map((id, i) => {
            if (!id) return null;
            const node = this.shapeNode(tray, id, this.trayRadius);
            node.setPosition(-ui.width / 2 + width * (i + 0.5), 0, 0);
            return node;
        });
    }
    private shapeNode(parent: Node, shapeId: string, radius: number): Node {
        const shape = this.shape(shapeId), node = new Node(shapeId);
        node.layer = parent.layer; node.parent = parent; node.addComponent(UITransform);
        const layout = centeredCells(shape.cells.map(([q, r]) => ({ q, r })), radius);
        layout.centers.forEach(c => {
            const s = this.sprite(node, 'cell', 2 * radius, Math.sqrt(3) * radius);
            s.node.setPosition(c.x, c.y, 0);
            this.setFrame(s, COLORS[shape.color % COLORS.length]);
        });
        return node;
    }

    // Drag: picks a tray slot, follows the finger lifted above it, previews cells and lines.
    private listen(v: LayoutView): void {
        v.node.on(Node.EventType.TOUCH_START, this.onStart, this, true);
        v.node.on(Node.EventType.TOUCH_MOVE, this.onMove, this, true);
        v.node.on(Node.EventType.TOUCH_END, this.onEnd, this, true);
        v.node.on(Node.EventType.TOUCH_CANCEL, this.onCancel, this, true);
    }
    private world(event: EventTouch): Vec3 {
        const p = event.getLocation();
        return this.inputCamera ? this.inputCamera.screenToWorld(new Vec3(p.x, p.y, 0)) : new Vec3(event.getUILocation().x, event.getUILocation().y, 0);
    }
    private onStart(event: EventTouch): void {
        const v = this.view, g = this.state.game;
        if (!v?.isValid || !g || this.drag || this.nav.dialogOpen || this.finishing || this.fx.locked) return;
        if (this.aiming) { this.aim(event); return; }
        const tray = v.element('TrayMount'), ui = tray.getComponent(UITransform)!, p = ui.convertToNodeSpaceAR(this.world(event));
        if (Math.abs(p.x) > ui.width / 2 || Math.abs(p.y) > ui.height / 2 + 30) return;
        const slot = Math.min(g.tray.length - 1, Math.max(0, Math.floor((p.x + ui.width / 2) / (ui.width / g.tray.length))));
        const node = this.slots[slot];
        if (!node?.isValid || !g.tray[slot]) return;
        // Move the shape to the page root so it renders above the board and tray.
        const at = node.worldPosition.clone();
        node.parent = v.node; node.setWorldPosition(at);
        node.setScale(this.radius / this.trayRadius, this.radius / this.trayRadius, 1);
        this.drag = { slot, node, pointer: event.getID(), target: null, valid: false };
        this.follow(event);
    }
    private onMove(event: EventTouch): void { if (this.drag?.pointer === event.getID()) this.follow(event); }
    private onEnd(event: EventTouch): void {
        const drag = this.drag;
        if (!drag || drag.pointer !== event.getID()) return;
        this.follow(event);
        this.drag = null;
        this.clearPreview();
        if (drag.valid && drag.target) this.place(drag.slot, drag.target);
        else this.render(); // an illegal or cancelled drop returns the shape to the tray, nothing spent
    }
    private onCancel(event: EventTouch): void { if (this.drag?.pointer === event.getID()) this.cancelDrag(); }
    private cancelDrag(): void { this.drag = null; this.clearPreview(); this.render(); }

    private follow(event: EventTouch): void {
        const drag = this.drag!, v = this.view!, g = this.state.game!, shapeId = g.tray[drag.slot]!;
        const root = v.node.getComponent(UITransform)!, local = root.convertToNodeSpaceAR(this.world(event));
        drag.node.setPosition(local.x, local.y + LIFT, 0);
        // First shape cell, in board space, decides the anchor cell (shape cells are offsets from it).
        // The node keeps its tray-radius children and is scaled up, so its own transform maps them.
        const shape = this.shape(shapeId), first = centeredCells(shape.cells.map(([q, r]) => ({ q, r })), this.trayRadius).centers[0];
        const mount = v.element('BoardMount').getComponent(UITransform)!;
        const point = mount.convertToNodeSpaceAR(drag.node.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(first.x, first.y, 0)));
        const cell = nearestAxial({ x: point.x - this.offset.x, y: point.y - this.offset.y }, this.radius);
        const onBoard = Math.abs(point.x) <= mount.width / 2 + this.radius && Math.abs(point.y) <= mount.height / 2 + this.radius;
        drag.target = onBoard ? { q: cell.q - shape.cells[0][0], r: cell.r - shape.cells[0][1] } : null;
        drag.valid = !!drag.target && canPlace(g, this.game.rules, shapeId, drag.target.q, drag.target.r);
        this.preview(shape, drag.target, drag.valid);
    }
    private preview(shape: EndlessShape, at: { q: number; r: number } | null, valid: boolean): void {
        this.clearPreview();
        if (!at) return;
        const g = this.state.game!, filled = new Set(Object.keys(g.board));
        const footprint = shape.cells.map(([dq, dr]) => key(at.q + dq, at.r + dr));
        footprint.forEach(k => filled.add(k));
        // Lines this drop would complete are highlighted; the preview itself never scores.
        const lines = valid ? boardLines(this.game.rules.endless.radius).filter(line => line.every(([q, r]) => filled.has(key(q, r)))) : [];
        const glow = this.nav.hasFrame('hex.line_highlight_strong') ? 'hex.line_highlight_strong' : 'hex.line_highlight';
        for (const line of lines) for (const [q, r] of line) this.overlay(key(q, r), glow);
        for (const k of footprint) this.overlay(k, valid ? 'hex.preview_valid' : 'hex.preview_invalid');
    }
    private overlay(k: string, asset: string): void {
        const cell = this.cells.get(k);
        if (!cell) return;
        cell.overlay.node.active = true;
        this.setFrame(cell.overlay, asset);
    }
    private clearPreview(): void { for (const cell of this.cells.values()) cell.overlay.node.active = false; }

    /**
     * One saved transaction (place, clear, score, refill, game-over check); then the board plays it
     * from the copy taken before the move (docs/v2/09 §7.1). The end of the game waits for the show.
     */
    private place(slot: number, at: { q: number; r: number }): void {
        const g = this.state.game!, before = { board: { ...g.board }, tray: [...g.tray], score: g.score };
        let result;
        // The league points of the move are saved with it (docs/v2/16 §7).
        try { result = this.game.act(s => { const r = placeShape(s, this.game.rules, this.game.day(), this.game.week(), slot, at.q, at.r); this.leaderboard.recordPoints(s, r.score); return r; }); }
        catch (error) { this.render(); if (!(error instanceof RuleError)) this.rewards.failure(error); return; }
        const v = this.view, request = this.request;
        if (!v?.isValid) return;
        const board = before.board;
        for (const k of result.placed) board[k] = result.color;
        before.tray[slot] = null;
        const shown: Shown = this.shown = { board, tray: before.tray, score: before.score };
        const cue = (part: keyof Shown) => {
            if (this.shown !== shown) return;
            delete shown[part];
            if (!Object.keys(shown).length) this.shown = null;
            this.render();
        };
        this.render();
        if (result.lines) this.say(`消除 ${result.lines} 条线  +${result.score}`);
        const dealt = result.refilled ? (this.state.game?.tray ?? []).map((_, i) => i) : [];
        void this.fx.place({
            lines: result.fullLines, score: result.score, refillSlots: dealt, lineCount: result.lines, placed: result.placed,
            cells: this.cells, mount: v.element('BoardMount'), root: v.node, scoreNode: v.element('score'),
            onClear: () => cue('board'),
            onRefill: () => { cue('tray'); return this.slots; },
            onScore: () => cue('score'),
        }).then(() => {
            if (this.shown === shown) { this.shown = null; this.render(); }
            if (request === this.request && this.view === v && result.outcome === 'over') void this.finish(false);
        });
    }

    // ---- tools (docs/v2/09 §7.2) -------------------------------------------

    /** Tools wait for the board: no drag, no running effect, no dialog, not while ending. */
    private get toolsIdle(): boolean { return !!this.state.game && !this.drag && !this.fx.busy && !this.finishing && !this.nav.dialogOpen; }

    private useTool(tool: EndlessTool): void {
        const g = this.state.game;
        if (!g || !this.toolsIdle) return;
        if (tool === 'hammer' && this.aiming) { this.cancelAim(); return; }
        const block = toolBlock(g, this.game.rules, tool);
        if (block) { this.say(BLOCKED[block](tool)); return; }
        if (tool === 'swap') { this.cancelAim(); this.swap(); return; }
        this.aiming = true;
        this.render();
    }
    private cancelAim(): void {
        if (!this.aiming) return;
        this.aiming = false;
        this.clearPreview();
        this.render();
    }
    /** Picking a cell: filled cells light up. */
    private markTargets(): void {
        const g = this.state.game;
        this.clearPreview();
        if (g) for (const k of Object.keys(g.board)) this.overlay(k, 'hex.preview_valid');
    }

    /** "换一手": one save (tray, seed, use), then the old pieces shrink out and the saved ones pop in. */
    private swap(): void {
        const g = this.state.game!, before = [...g.tray];
        let result;
        try { result = this.game.act(s => swapTray(s, this.game.rules)); }
        catch (error) { this.render(); if (error instanceof RuleError) this.say(BLOCKED.noShape('swap')); else this.rewards.failure(error); return; }
        const v = this.view, request = this.request;
        if (!v?.isValid) return;
        const shown: Shown = this.shown = { tray: before };
        this.render();
        const old = [...this.slots], outcome = result.outcome;
        void this.fx.swap({
            slots: result.slots, old,
            onSwap: () => { if (this.shown === shown) { this.shown = null; this.render(); } return this.slots; },
        }).then(() => this.settled(shown, request, v, outcome));
    }

    /** A tap while aiming: a filled cell is hit (one save), anything else keeps aiming and costs nothing. */
    private aim(event: EventTouch): void {
        const v = this.view!, g = this.state.game!, mount = v.element('BoardMount').getComponent(UITransform)!;
        const p = mount.convertToNodeSpaceAR(this.world(event)), at = nearestAxial({ x: p.x - this.offset.x, y: p.y - this.offset.y }, this.radius);
        const k = key(at.q, at.r), cell = this.cells.get(k);
        if (!cell || !(k in g.board)) return;
        const board = { ...g.board };
        let result;
        try { result = this.game.act(s => hammerCell(s, this.game.rules, at.q, at.r)); }
        catch (error) { if (!(error instanceof RuleError)) this.rewards.failure(error); this.render(); return; }
        this.aiming = false;
        this.clearPreview();
        const request = this.request, shown: Shown = this.shown = { board }, outcome = result.outcome;
        this.render();
        void this.fx.hammer({
            cell, mount: v.element('BoardMount'),
            onHit: () => { if (this.shown === shown) { this.shown = null; this.render(); } },
        }).then(() => this.settled(shown, request, v, outcome));
    }

    /** After a tool's show: the saved state is on screen; a game no tool can save any more ends. */
    private settled(shown: Shown, request: number, v: LayoutView, outcome: EndlessOutcome): void {
        if (this.shown === shown) this.shown = null;
        if (request !== this.request || this.view !== v) return;
        this.render();
        if (outcome === 'over') void this.finish(false);
    }

    private onGame(id: string): void {
        if (this.nav.dialogOpen || this.finishing) return;
        if (id === 'tool_swap') { this.useTool('swap'); return; }
        if (id === 'tool_hammer') { this.useTool('hammer'); return; }
        this.cancelAim();
        if (id === 'settings_button') this.rewards.settings();
        else if (id === 'hud_btn_square_blue') this.confirmLeave(false);
        else if (id === 'end_rescue' && this.rescue && !this.fx.busy) this.confirmLeave(true);
    }

    /** S22; ending the game goes through its confirmation variant on the same dialog. */
    private confirmLeave(ending: boolean): void {
        void this.nav.showDialog('S22', id => {
            if (id === 'btn_close_dialog' || id === 'continue') { this.nav.closeDialog(); if (ending) this.confirmLeave(false); }
            else if (id === 'end_game' && !ending) { this.nav.closeDialog(); this.confirmLeave(true); }
            else if (id === 'save_leave') {
                this.nav.closeDialog();
                // Ending a stuck game (rescue offered, declined) is its natural end, not an abandon.
                if (ending) void this.finish(!this.rescue); else void this.open(); // every placement is already saved
            }
        }, v => {
            if (!ending) return;
            v.setText('title', '结束本局？');
            v.setText('preserve_board', '已获得的积分会保留');
            v.setText('resume_caption', '结束后本局无法继续');
            v.setText('save_leave_label', '确认结束');
            v.setText('continue_label', '返回');
            v.setVisible('end_game', false);
        });
    }

    /**
     * S21 (docs/v2/09 §8). Scores were saved per placement; ending only clears the running game.
     * Saved first, then the board dims (ends) or fades (abandoned), S21 comes in and its score rolls;
     * only a score strictly above the best at the game's start shows the record badge.
     */
    private async finish(abandoned: boolean): Promise<void> {
        const rules = this.game.rules, summary = endlessSummary(this.game.state, rules, this.game.week(), abandoned);
        if (!summary || this.finishing) return;
        this.finishing = true;
        this.aiming = false;
        if (this.drag) this.cancelDrag();
        try { this.game.act(s => endEndlessGame(s)); }
        catch (error) { this.finishing = false; this.rewards.failure(error, () => void this.finish(abandoned)); return; }
        this.fx.stop();
        const v = this.view, request = this.request, input = { score: summary.score, record: summary.record, abandoned, claimable: summary.claimable };
        if (v?.isValid) await this.fx.board([v.element('BoardMount'), v.element('TrayMount')], this.cells.values(), input);
        if (request !== this.request) return;
        let ready = false, gone = false;
        const skip = () => { if (!ready && this.fx.elapsed >= rules.anim.skipAfterSeconds) this.fx.stop(); };
        void this.nav.showDialog('S21', id => {
            if (gone) return;
            if (!ready) { skip(); return; }
            // The first tap decides; a second one in the same frame never routes again.
            gone = true;
            this.nav.closeDialog();
            if (id === 'retry') void this.play(); else void this.open();
        }, d => {
            d.setText('title', abandoned ? '已结束本局' : summary.record ? '新纪录！' : '本局结束');
            d.setText('game_score', summary.score.toLocaleString('en-US'));
            d.setText('best_value', summary.best.toLocaleString('en-US'));
            d.setText('weekly_delta', `+${summary.weekGain.toLocaleString('en-US')}`);
            // A zero game has nothing to report under its score.
            for (const id of ['weekly_delta', 'weekly_delta_label']) d.setVisible(id, summary.score > 0);
            d.setVisible('reward_notice', summary.score > 0 || summary.claimable);
            d.setText('reward_notice', summary.claimable ? '有阶段奖励可领取，请返回活动页' : '阶段奖励请返回活动页领取');
            if (d.has('league_rank')) {
                d.setText('league_rank', '');
                this.league?.todayRank().then(rank => { if (d.isValid && rank) d.setText('league_rank', `今日联赛 ${rank}`); }, error => console.error(error));
            }
            const badge = ['record_badge', 'record_badge_label'].filter(id => d.has(id)).map(id => d.element(id));
            for (const n of badge) n.active = false;
            d.node.on(Node.EventType.TOUCH_END, skip);
            void this.fx.result({ ...input, scoreLabel: d.label('game_score'), badge, notice: d.element('reward_notice'), layer: d.node })
                .then(() => { ready = true; if (request === this.request) this.finishing = false; });
        });
    }

    private loadArt(): void {
        if (this.artLoading) return;
        this.artLoading = true;
        const all = (ids: readonly string[]) => Promise.all(ids.map(id => this.nav.loadFrame(id).catch(() => null)))
            .then(list => list.filter((f): f is SpriteFrame => !!f));
        const glow = this.nav.hasFrame('hex.line_highlight_strong') ? 'hex.line_highlight_strong' : 'hex.line_highlight';
        void Promise.all([this.scope.load(glow, SpriteFrame).catch(() => null), all(BURST), all(CONFETTI), this.nav.loadFrame(HAMMER_ART).catch(() => null)])
            .then(([g, burst, confetti, hammer]) => { this.art = { glow: g, burst, confetti, hammer }; });
    }

    private sprite(parent: Node, name: string, w: number, h: number): Sprite {
        const node = new Node(name);
        node.layer = parent.layer; node.parent = parent;
        node.addComponent(UITransform).setContentSize(w, h);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        return sprite;
    }
    private setFrame(sprite: Sprite, assetId: string): void {
        this.scope.load(assetId, SpriteFrame).then(f => { if (sprite.isValid) sprite.spriteFrame = f; }, error => console.error(error));
    }
    private frame(v: LayoutView, id: string, assetId: string): void {
        this.nav.loadFrame(assetId).then(f => { if (v.isValid) v.setFrame(id, f); }, error => console.error(error));
    }
}

function countdown(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400);
    const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
    return d ? `${d}天 ${hms}` : hms;
}
