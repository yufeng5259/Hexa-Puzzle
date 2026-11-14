import { Camera, Color, EventTouch, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { Game } from '../core/Game';
import { boardCells, boardLines, canPlace, claimEndlessStage, endEndlessGame, isGameOver, key, newEndlessGame, placeShape, refreshWeek } from '../core/Endless';
import { reward, RuleError, type EndlessShape } from '../core/Rules';
import type { EndlessGame } from '../core/State';
import { axialPoint, centeredCells, fitCells, nearestAxial, type Point2 } from '../features/puzzle/presentation/PuzzleLayout';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';
import type { GuideCoach } from './GuideCoach';

/** Shape colour index -> piece texture (the mainline catalog's hex art). */
const COLORS = ['1_png', '6_png', '8_png', '9_png', '10_png', '3_png'].map(t => `hex.${t}`);
const TRAY_MAX_RADIUS = 34;
/** The dragged shape floats above the finger so the target cells stay visible. */
const LIFT = 150;
const FEEDBACK_SECONDS = 1.6;
/** S19 status text colours as drawn: "已领取" (row 0) and "未解锁" (rows 2, 3). */
const STATUS_COLOR = { claimed: new Color(0x31, 0x66, 0x4d, 255), locked: new Color(0x5e, 0x6c, 0x84, 255) };
const RULE_HINT = '三个方向填满整线即可消除';
const HELP = '把下方拼块拖进蜂巢。横向、左斜、右斜任一方向整条线填满就会消除，颜色不用相同。一次消除多条线得分更高；三块都放不下时本局结束。';

interface CellView { base: Sprite; overlay: Sprite }
interface Drag { slot: number; node: Node; pointer: number; target: { q: number; r: number } | null; valid: boolean }

/**
 * S19 activity page, S20 61-cell board, S21 results and S22 leave. The running game
 * (board, remaining tray, score, deal seed) is saved with every placement, so leaving
 * or reloading never redraws the batch. Weekly points are added per placement.
 */
export class EndlessPage {
    public onHome: (() => void) | null = null;
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
    private request = 0;
    private unsubscribe: (() => void) | null = null;

    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader,
        private readonly inputCamera: Camera | null, private readonly guide: GuideCoach) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.render(), false);
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
    }

    public update(): void {
        if (!this.view?.isValid) return;
        if (this.page === 'S19') { this.rollWeek(); this.view.setText('weekly_reset', `每周一0点刷新 · ${countdown(this.game.msToNextWeek())}`); }
        if (this.page === 'S20' && this.feedbackUntil && this.game.now() > this.feedbackUntil) { this.feedbackUntil = 0; this.view.setText('rule_hint', RULE_HINT); }
        if (this.page === 'S20' && this.nav.dialogOpen && this.drag) this.cancelDrag();
    }

    public dispose(): void { this.detach(); this.scope.release(); }

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
        if (id === 'home_button' || id === 'back_button') this.leave();
        else if (id === 'help_button') this.help();
        else if (id === 'start_challenge') void this.play();
        else if (stage) {
            const week = this.game.week();
            try { this.game.act(s => claimEndlessStage(s, this.game.rules, week, Number(stage[1]))); }
            catch (error) { if (!(error instanceof RuleError)) this.rewards.failure(error); }
            this.render();
        }
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
        this.buildBoard(view);
        this.listen(view);
        this.render();
        if (isGameOver(this.state.game!, this.game.rules)) this.finish(false);
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

    private renderGame(v: LayoutView): void {
        const g = this.state.game;
        if (!g) return;
        v.setText('score', `本局 ${g.score.toLocaleString('en-US')}`);
        v.setText('record', `最高 ${this.state.best.toLocaleString('en-US')}`);
        for (const [k, cell] of this.cells) this.setFrame(cell.base, k in g.board ? COLORS[g.board[k] % COLORS.length] : 'hex.empty_well');
        if (!this.drag) this.renderTray(v, g);
    }

    private renderTray(v: LayoutView, g: EndlessGame): void {
        const tray = v.element('TrayMount'), ui = tray.getComponent(UITransform)!, width = ui.width / g.tray.length;
        for (const node of this.slots) if (node?.isValid) node.destroy();
        const fits = g.tray.filter((id): id is string => !!id)
            .map(id => fitCells(this.shape(id).cells.map(([q, r]) => ({ q, r })), width - 16, ui.height - 16).radius);
        this.trayRadius = Math.min(TRAY_MAX_RADIUS, ...fits);
        this.slots = g.tray.map((id, i) => {
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
        if (!v?.isValid || !g || this.drag || this.nav.dialogOpen) return;
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

    private place(slot: number, at: { q: number; r: number }): void {
        let result;
        try { result = this.game.act(s => placeShape(s, this.game.rules, this.game.day(), this.game.week(), slot, at.q, at.r)); }
        catch (error) { this.render(); if (!(error instanceof RuleError)) this.rewards.failure(error); return; }
        this.render();
        if (result.lines && this.view?.isValid) {
            this.view.setText('rule_hint', `消除 ${result.lines} 条线  +${result.score}`);
            this.feedbackUntil = this.game.now() + FEEDBACK_SECONDS * 1000;
        }
        if (result.gameOver) this.finish(false);
    }

    private onGame(id: string): void {
        if (this.nav.dialogOpen) return;
        if (id === 'settings_button') this.rewards.settings();
        else if (id === 'hud_btn_square_blue') this.confirmLeave(false);
    }

    /** S22; ending the game goes through its confirmation variant on the same dialog. */
    private confirmLeave(ending: boolean): void {
        void this.nav.showDialog('S22', id => {
            if (id === 'btn_close_dialog' || id === 'continue') { this.nav.closeDialog(); if (ending) this.confirmLeave(false); }
            else if (id === 'end_game' && !ending) { this.nav.closeDialog(); this.confirmLeave(true); }
            else if (id === 'save_leave') {
                this.nav.closeDialog();
                if (ending) this.finish(true); else void this.open(); // every placement is already saved
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

    /** S21. Scores were saved per placement; ending only clears the running game. */
    private finish(abandoned: boolean): void {
        const g = this.state.game;
        if (!g) return;
        const score = g.score, gain = g.weekId === this.game.week() ? g.weekGain ?? 0 : 0, best = this.state.best;
        try { this.game.act(s => endEndlessGame(s)); }
        catch (error) { this.rewards.failure(error, () => this.finish(abandoned)); return; }
        const record = !abandoned && score > 0 && score >= best;
        void this.nav.showDialog('S21', id => {
            if (id === 'retry') { this.nav.closeDialog(); void this.play(); }
            else if (id === 'return_event') { this.nav.closeDialog(); void this.open(); }
        }, v => {
            v.setText('title', abandoned ? '已结束本局' : record ? '新纪录！' : '本局结束');
            v.setText('game_score', score.toLocaleString('en-US'));
            v.setText('best_value', best.toLocaleString('en-US'));
            v.setText('weekly_delta', `+${gain.toLocaleString('en-US')}`);
            const open = this.game.rules.endless.stages.some((stage, i) => this.state.weekScore >= stage.score && !this.state.claimedStages.includes(i));
            v.setText('reward_notice', open ? '有阶段奖励可领取，请返回活动页' : '阶段奖励请返回活动页领取');
        });
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
