import { BlockInputEvents, Button, Camera, JsonAsset, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { Game } from '../core/Game';
import { abandonAttempt, completeAttempt, mainlineFinished, recordPlacement, saveBoard, startAttempt, startCost, useHint, winEventId } from '../core/Mainline';
import { mainlineLevel, RuleError } from '../core/Rules';
import { winCopy } from '../core/Display';
import { BoardFx } from '../features/fx/BoardFx';
import type { Attempt } from '../core/State';
import { LevelCatalog, type LevelDefinition } from '../features/puzzle/data/LevelCatalog';
import { PuzzleBoardPresentation } from '../features/puzzle/presentation/PuzzleBoardPresentation';
import { PuzzleController } from '../features/puzzle/controller/PuzzleController';
import { PuzzleSession, type PuzzleSessionSnapshot } from '../features/puzzle/session/PuzzleSession';
import { hudText, hudValue, showEnergy } from './EnergyHud';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';
import type { GuideCoach, Hole, Lesson } from './GuideCoach';
import type { HexCell } from '../features/puzzle/data/LevelDefinition';

const LOW_STEPS = 3;
const BUTTON_ART: Record<string, string> = { undo_button: 'blue', replay_button: 'purple', hint_button: 'teal' };
/** Win bar elements (tools/v2/build-ui.mjs winBar) and the button row it replaces. */
const WIN_BAR = ['win_bar', 'win_line', 'win_home', 'win_home_text', 'win_next', 'win_next_text'];
const PUZZLE_ROW = ['undo_button', 'undo_icon', 'undo_text', 'replay_button', 'replay_icon', 'replay_text', 'hint_button', 'hint_icon', 'hint_text', 'puzzle_badge_count', 'hint_count'];
/** The bar starts this far (design units) below its place. */
const WIN_BAR_DROP = 300;

/**
 * S04 normal / S05 move-limited puzzle and its dialogs S06–S09, S12. The attempt
 * lives in the save: every accepted move is written before the board shows it,
 * so leaving, crashing or reloading resumes the same attempt without paying again.
 */
export class PuzzlePage {
    public onHome: (() => void) | null = null;
    public onEndless: (() => void) | null = null;
    public onReplayList: (() => void) | null = null;
    private readonly scope: ResourceScope;
    private readonly rewards: RewardPresenter;
    private catalog: Promise<LevelCatalog> | null = null;
    private view: LayoutView | null = null;
    private board: PuzzleBoardPresentation | null = null;
    private controller: PuzzleController | null = null;
    private boardFx: BoardFx | null = null;
    /** A board finish (celebration, failure, fade-out) runs: no drag, button or second outcome. */
    private finishing = false;
    private session: PuzzleSession | null = null;
    private level: LevelDefinition | null = null;
    private levelNo = 0;
    private chargeHint = false;
    /** The running teaching drag and the GuideSteps row it belongs to. */
    private teaching: { rowId: string; lesson: Lesson } | null = null;
    private suspended = false;
    /** Win bar of the finished board: its nodes (base position once shown), whether its buttons work, the outcome, the tap catcher. */
    private barNodes: { node: Node; base: Vec3 | null }[] = [];
    private barReady = false;
    private winKind: 'firstClear' | 'replay' | 'duplicate' | null = null;
    private catcher: Node | null = null;
    private request = 0;
    private unsubscribe: (() => void) | null = null;

    /** inputCamera: the Canvas camera, so drags map screen points into board space. */
    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader, private readonly inputCamera: Camera | null, private readonly guide: GuideCoach) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.renderHud(), false);
        // The attempt is saved with every move, so leaving for endless keeps it intact.
        this.rewards.onEndless = () => { this.request++; this.leave(); this.onEndless?.(); };
        this.loadCatalog().catch(error => console.error(error));
    }

    /** Play from home: resumes the saved attempt, otherwise starts the next level (paying energy). */
    /** instant: first page under the boot loading screen (no transition). */
    public async play(levelNo = this.game.state.mainline.nextLevelNo, instant = false): Promise<void> {
        const saved = this.game.state.mainline.attempt;
        if (saved) return this.show(saved, instant);
        if (!this.game.state.mainline.cleared[levelNo] && levelNo !== this.game.state.mainline.nextLevelNo) return;
        if (mainlineFinished(this.game.state, this.game.rules) && !this.game.state.mainline.cleared[levelNo]) return;
        const attempt = this.start(levelNo);
        if (attempt) await this.show(attempt);
    }

    /** Pauses dragging while any dialog is up (including shared ones: settings, energy) or a board finish runs. */
    public update(dt = 0): void {
        this.boardFx?.update(dt);
        const controller = this.controller;
        if (!controller?.isValid) return;
        const pause = this.nav.dialogOpen || this.finishing;
        if (pause && !this.suspended) { this.suspended = true; controller.suspend(); }
        else if (!pause && this.suspended) { this.suspended = false; controller.resume(); }
    }

    public dispose(): void { this.leave(); this.scope.release(); }

    /** Pays and saves a new attempt; on failure keeps whatever attempt was there. */
    private start(levelNo: number): Attempt | null {
        try {
            return this.game.act(s => startAttempt(s, this.game.rules, this.game.now(), levelNo, `${levelNo}:${this.game.now()}`));
        } catch (error) {
            if (error instanceof RuleError && error.code === 'energy') this.rewards.energy(true);
            else this.rewards.failure(error);
            return null;
        }
    }

    /** Loaded once (started at construction) so a tap reaches the page change without waiting. */
    private loadCatalog(): Promise<LevelCatalog> {
        if (!this.catalog) {
            const loading = this.catalog = this.scope.load('puzzle.catalog', JsonAsset).then(asset => {
                const catalog = new LevelCatalog(asset.json);
                for (const level of this.game.rules.mainline) catalog.getById(level.puzzleId); // config must match the 110 questions
                return catalog;
            });
            loading.catch(() => { if (this.catalog === loading) this.catalog = null; }); // retry on the next play
        }
        return this.catalog;
    }

    /** fadeIn: restart on the same page; no page transition, the new board fades in instead. */
    private async show(attempt: Attempt, instant = false, fadeIn = false): Promise<void> {
        const request = ++this.request;
        try {
            const catalog = await this.loadCatalog();
            const level = catalog.getById(mainlineLevel(this.game.rules, attempt.levelNo).puzzleId);
            // The board and pieces are built while the transition (or the faded-out board) still covers it.
            let presented: Promise<void> = Promise.resolve(), fx: BoardFx | null = null;
            const view = await this.nav.replacePage(level.mode === 'challenge' ? 'S05' : 'S04', id => this.onAction(id), {
                instant: instant || fadeIn,
                prepare: v => {
                    const board = v.getComponent(PuzzleBoardPresentation)!;
                    fx = new BoardFx(board, this.game.rules.anim);
                    fx.preload(id => this.nav.loadFrame(id));
                    if (fadeIn) fx.hide();
                    return (presented = board.present(v.resources, level));
                },
            });
            if (request !== this.request) { (fx as BoardFx | null)?.dispose(); return; }
            this.leave();
            const board = view.getComponent(PuzzleBoardPresentation)!, controller = view.getComponent(PuzzleController)!;
            this.boardFx = fx ?? new BoardFx(board, this.game.rules.anim);
            if (!fx) this.boardFx.preload(id => this.nav.loadFrame(id));
            await presented;
            if (request !== this.request || !view.isValid) return;
            const session = new PuzzleSession(level, attempt.attemptId);
            if (attempt.board) {
                try { session.restore(attempt.board as PuzzleSessionSnapshot); }
                catch (error) { console.warn('Saved board ignored', error); }
            }
            Object.assign(this, { view, board, controller, session, level, levelNo: attempt.levelNo, suspended: false });
            session.beforeCommit = candidate => this.persist(candidate);
            controller.onOutcome = status => void (status === 'completed' ? this.win() : this.fail());
            controller.onError = error => this.rewards.failure(error);
            controller.inputCamera = this.inputCamera;
            controller.onDragStateChanged = dragging => this.guide.setPaused(dragging);
            controller.allowPieceStart = id => { const l = this.lesson(); return !l || l.pieceId === id; };
            controller.allowPlacement = (id, at) => { const l = this.lesson(); return !l || l.pieceId === id && l.targetCell.q === at.q && l.targetCell.r === at.r; };
            controller.bind(session);
            this.unsubscribe = this.game.subscribe(() => this.renderHud());
            session.subscribe(() => this.render());
            view.setText('level_title', attempt.mode === 'replay' ? `复玩 第${attempt.levelNo}关` : `第${attempt.levelNo}关`);
            this.render();
            this.renderHud();
            if (fadeIn) void this.boardFx.fadeIn();
            // A board saved at its final move still owes its outcome.
            const status = session.snapshot.status;
            if (status === 'completed') void this.win(); else if (status === 'failed') void this.fail();
        } catch (error) {
            if (request === this.request) this.rewards.failure(error);
        }
    }

    private leave(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.session) this.session.beforeCommit = null;
        if (this.controller?.isValid) { this.controller.onOutcome = null; this.controller.onError = null; }
        this.boardFx?.dispose();
        this.boardFx = null;
        this.finishing = false;
        if (this.catcher?.isValid) this.catcher.destroy();
        this.catcher = null; this.barNodes = []; this.barReady = false; this.winKind = null;
        this.view = this.board = this.controller = this.session = this.level = null;
    }

    private goHome(): void { this.teaching = null; this.guide.clear(); this.request++; this.leave(); this.onHome?.(); }
    /** Saved or abandoned board going home: it fades out first (no result dialog). */
    private async fadeHome(): Promise<void> {
        const request = this.request;
        this.finishing = true;
        await this.boardFx?.fadeOut();
        if (request === this.request) this.goHome();
    }
    /** New attempt of the same level: paid and saved first, then the old board fades out and the new one in. */
    private async restart(): Promise<void> {
        const attempt = this.start(this.levelNo);
        if (!attempt) return;
        const request = this.request;
        this.finishing = true;
        await this.boardFx?.fadeOut();
        if (request === this.request) await this.show(attempt, false, true);
    }

    /** Every move, return and hint is saved with the board in one write; a failed write rejects the move. */
    private persist(candidate: PuzzleSessionSnapshot): void {
        const before = this.session!.snapshot, charge = this.chargeHint;
        const placed = candidate.moves > before.moves && (candidate.placementOrder?.length ?? 0) >= (before.placementOrder?.length ?? 0);
        this.game.act(s => {
            if (charge) useHint(s);
            saveBoard(s, candidate.attemptId, candidate);
            if (placed) recordPlacement(s, this.game.rules, this.game.day());
        });
    }

    private render(): void {
        const view = this.view, session = this.session, level = this.level;
        if (!view?.isValid || !session || !level) return;
        const snapshot = session.snapshot;
        if (level.mode === 'challenge' && view.has('steps_count')) {
            const left = Math.max(0, level.moveLimit! - snapshot.moves);
            view.setText('steps_count', `剩余步数 ${left}`);
            this.frame('puzzle_steps_plate', `UI/拼图/puzzle_steps_plate_${left <= LOW_STEPS ? 'warning' : 'normal'}.png`);
        }
        this.enable('undo_button', snapshot.status === 'active' && !this.lesson() && (snapshot.placementOrder?.length ?? 0) > 0);
        const free = snapshot.status === 'active' && !this.lesson();
        this.enable('replay_button', free);
        this.enable('hint_button', free);
        const hint = snapshot.activeHintPieceId ? session.hintCandidate() : null;
        this.board?.drawHint(hint ? hint.cells : []);
        this.renderLesson();
    }
    /** First-run teaching: the next GuideSteps drag row whose piece is not placed yet. */
    private lesson(): { rowId: string; pieceId: string; targetCell: HexCell; hand: Record<string, number> } | null {
        if (this.levelNo !== 1 || this.guide.step !== 'firstPuzzle' || !this.session) return null;
        const placed = this.session.snapshot.placements;
        for (const row of this.game.config.guide) {
            const p = row.params as { pieceId?: string; targetCell?: HexCell; hand?: Record<string, number> };
            if (row.step === 'firstPuzzle' && p.pieceId && p.targetCell && !placed[p.pieceId]) return { rowId: row.id, pieceId: p.pieceId, targetCell: p.targetCell, hand: p.hand ?? {} };
        }
        return null;
    }
    private renderLesson(): void {
        const controller = this.controller, view = this.view, lesson = this.lesson();
        if (!controller?.isValid || !view?.isValid) return;
        if (!lesson) {
            controller.clearGuidePreview();
            if (this.teaching) { this.teaching = null; this.guide.clear(); }
            view.setText('puzzle_instruction', '拖动拼块，填满蜂巢');
            return;
        }
        controller.setGuidePreview(lesson.pieceId, lesson.targetCell, lesson.hand);
        view.setText('puzzle_instruction', this.guide.text(lesson.rowId));
        if (this.teaching?.rowId !== lesson.rowId) {
            this.teaching = { rowId: lesson.rowId, lesson: this.teachingDrag(lesson.pieceId, lesson.targetCell, lesson.hand) };
            this.guide.teach(this.teaching.lesson);
        }
    }
    /**
     * Live positions for the teaching hand and spotlight. The tray re-flows (animated)
     * after every placement, so nothing is cached: the hand waits while it settles.
     */
    private teachingDrag(pieceId: string, targetCell: HexCell, hand: Record<string, number>): Lesson {
        const page = this, piece = this.level!.pieces.find(p => p.id === pieceId)!, first = piece.cells[0];
        const center = (node: Node) => {
            const ui = node.getComponent(UITransform)!;
            return ui.convertToWorldSpaceAR(new Vec3((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height, 0));
        };
        const trayCells = () => {
            const board = page.board;
            if (!board?.isValid) return null;
            const entry = board.pieceEntries().find(e => e.item.pieceId === pieceId);
            if (!entry || entry.node.parent !== board.piecesMount) return null;
            return entry.item.cellsRoot!.children.filter(n => n.active);
        };
        const boardPoint = (cell: HexCell) => {
            const board = page.board!, p = board.pointOfCell(cell);
            return board.boardMount!.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(p.x, p.y, 0));
        };
        return {
            from: () => page.board?.isTraySettling ? null : (trayCells()?.[0] && center(trayCells()![0])) ?? null,
            to: () => page.board?.isValid && page.board.boardFit ? boardPoint({ q: targetCell.q + first.q, r: targetCell.r + first.r }) : null,
            holes: () => {
                const board = page.board, cells = trayCells();
                if (!board?.boardFit || !cells?.length) return null;
                const trayRadius = cells[0].getComponent(UITransform)!.getBoundingBoxToWorld().width / 2;
                const boardRadius = board.boardFit.radius * board.boardMount!.worldScale.x;
                const holes: Hole[] = [{ hexes: cells.map(center), radius: trayRadius }, { hexes: piece.targetCells.map(boardPoint), radius: boardRadius }];
                return holes;
            },
            motion: hand,
        };
    }
    private renderHud(): void {
        const view = this.view;
        if (!view?.isValid) return;
        showEnergy(view, this.game, this.nav.fx);
        hudText(view, 'coin_value', hudValue(this.game, 'coins'), this.nav.fx);
        hudText(view, 'hint_count', hudValue(this.game, 'hints'), this.nav.fx);
    }
    private enable(id: string, on: boolean): void {
        const node = this.view!.element(id), button = node.getComponent(Button);
        if (button) button.interactable = on;
        this.frame(id, `UI/拼图/puzzle_btn_${BUTTON_ART[id]}_${on ? 'normal' : 'disabled'}.png`);
    }
    private frame(id: string, assetId: string): void {
        const view = this.view!;
        this.nav.loadFrame(assetId).then(f => { if (view.isValid && view.element(id).getComponent(Sprite)) view.setFrame(id, f as SpriteFrame); }, error => console.error(error));
    }

    private onAction(id: string): void {
        const session = this.session;
        if (this.nav.dialogOpen || !session || this.finishing) return;
        if (this.lesson() && !this.guide.allows('puzzle', id)) return; // forced first drag: no way around it
        // A finished board: the win bar, or (failure dialog closed by a blocked retry) only home.
        if (session.snapshot.status !== 'active') {
            if (id === 'win_next' || id === 'win_home') this.onWinAction(id);
            else if (id === 'hud_btn_square_blue' && (!this.guide.active || this.barReady)) this.goHome();
            return;
        }
        switch (id) {
            case 'hud_btn_square_blue': return this.confirmExit(false);
            case 'hud_btn_square_blue_2': return this.rewards.settings();
            case 'undo_button': return this.controller?.onReturnPiece();
            case 'replay_button': return this.confirmRestart();
            case 'hint_button': return this.hint();
        }
    }

    private hint(): void {
        const session = this.session!;
        this.controller?.cancelDrag();
        // Looking at the active hint again is free.
        if (session.snapshot.activeHintPieceId) { this.render(); return; }
        if (!session.hintCandidate()) return;
        if (this.game.state.wallet.hints <= 0) { this.noHints(); return; }
        this.chargeHint = true;
        try { session.activateHint(); } catch (error) { this.rewards.failure(error); } finally { this.chargeHint = false; }
    }
    private noHints(): void {
        void this.nav.showDialog('S12', id => { if (id === 'continue' || id === 'btn_close_dialog') this.nav.closeDialog(); },
            v => v.setText('hint_inventory', `当前提示 ${this.game.state.wallet.hints}`));
    }

    /** S08; abandoning goes through its confirmation variant (S08-B) on the same dialog. */
    private confirmExit(abandon: boolean): void {
        const cost = startCost(this.game.state, this.game.rules, this.levelNo);
        void this.nav.showDialog('S08', id => {
            if (id === 'btn_close_dialog' || id === 'continue') { this.nav.closeDialog(); if (abandon) this.confirmExit(false); }
            else if (id === 'abandon' && !abandon) { this.nav.closeDialog(); this.confirmExit(true); }
            else if (id === 'save_home') {
                const session = this.session!;
                try {
                    this.game.act(s => abandon ? abandonAttempt(s, session.attemptId) : saveBoard(s, session.attemptId, session.serialize()));
                } catch (error) { this.nav.closeDialog(); this.rewards.failure(error); return; }
                this.nav.closeDialog();
                void this.fadeHome();
            }
        }, v => {
            if (!abandon) return;
            v.setText('title', '放弃本局？');
            v.setText('save_summary', '当前摆放将被清空');
            v.setText('save_detail', cost ? `再次开局需要 ${cost} 点体力` : '再次开局不消耗体力');
            v.setText('save_home_text', '确认放弃');
            v.setText('continue_text', '返回');
            v.setVisible('abandon', false);
        });
    }

    private confirmRestart(): void {
        const cost = startCost(this.game.state, this.game.rules, this.levelNo);
        void this.nav.showDialog('S09', id => {
            if (id === 'btn_close_dialog' || id === 'continue') this.nav.closeDialog();
            else if (id === 'restart') { this.nav.closeDialog(); void this.restart(); }
        }, v => v.setText('restart_cost', cost ? `新开一局需要 ${cost} 点体力` : '首关免费，不消耗体力'));
    }


    /**
     * Win (docs/v2/10 §4.1): saved first; the board celebrates on its own timeline (punch, flash,
     * rims and shine, ribbon, confetti, fireworks, bee), the reward this commit actually paid (read
     * from the display queue by its event id) flies to the HUD on cue and the bottom bar slides in;
     * no dialog. A tap after skipAfter (not on the first guided win) jumps to the bar. A repeated
     * outcome does not celebrate: the bar comes in at once. The event is confirmed when its show ends.
     */
    private async win(): Promise<void> {
        const session = this.session!, levelNo = this.levelNo, rules = this.game.rules, request = this.request, view = this.view!;
        this.finishing = true;
        this.controller?.cancelDrag();
        let kind: 'firstClear' | 'replay' | 'duplicate';
        try { kind = this.game.act(s => completeAttempt(s, rules, session.attemptId, this.game.day())); }
        catch (error) { this.finishing = false; this.rewards.failure(error, () => void this.win()); return; }
        const id = kind === 'duplicate' ? null : winEventId(kind, levelNo, session.attemptId);
        const event = id ? this.game.displays.find(e => e.id === id) ?? null : null;
        const prize = event?.reward ?? null, guided = this.guide.active;
        this.winKind = kind;
        const copy = winCopy(kind, levelNo, mainlineLevel(rules, levelNo).kind === 'challenge', prize);
        this.prepareBar(view, kind, copy.line, guided);
        const fx = this.boardFx;
        if (!copy.banner || !fx) { this.slideBar(view, 0, guided); return; }
        view.setText('win_ribbon_text', copy.banner);
        // Full-screen catcher above the page: nothing below acts meanwhile; a tap fast-forwards.
        const skip = () => { if (!guided && fx.elapsed >= rules.anim.skipAfterSeconds) fx.stop(); };
        this.catcher = this.cover(view, skip);
        // The first guided win plays once in full, but its buttons never wait longer than this.
        const guard = guided ? setTimeout(() => fx.stop(), rules.anim.firstWinLimitSeconds * 1000) : null;
        await fx.win(session.snapshot, {
            ribbon: [view.element('win_ribbon'), view.element('win_ribbon_text')],
            coins: prize && event ? (from, late) => {
                if (request !== this.request) return;
                const ids = [event.id];
                this.rewards.collect(prize, ids, { owner: view.node, from, sources: { coins: from }, skippable: !guided, onTap: skip })
                    .catch(error => console.error(error));
                if (late) this.nav.fx.settle();
            } : null,
            bar: offset => { if (request === this.request) this.slideBar(view, offset, guided); },
        });
        if (guard) clearTimeout(guard);
    }

    /** Bar texts and buttons for this outcome; the bar stays hidden until it slides in. */
    private prepareBar(view: LayoutView, kind: 'firstClear' | 'replay' | 'duplicate', line: string, guided: boolean): void {
        const finished = mainlineFinished(this.game.state, this.game.rules);
        view.setText('win_line', line);
        view.setText('win_next_text', kind === 'replay' ? '继续复玩' : finished ? '主线完成' : '下一关');
        this.barNodes = WIN_BAR.filter(id => !guided || !id.startsWith('win_next')).map(id => ({ node: view.element(id), base: null }));
    }
    /**
     * Bottom bar slide: offset 1 hidden below the screen → 0 in place. The button row it covers hides
     * when it starts; at 0 the buttons work (and the first guided win points at "回家建造").
     */
    private slideBar(view: LayoutView, offset: number, guided: boolean): void {
        if (!view.isValid || this.barReady) return;
        const drop = WIN_BAR_DROP * view.node.getComponent(UITransform)!.height / 1844;
        for (const b of this.barNodes) {
            if (!b.node.isValid) continue;
            if (!b.base) { b.base = b.node.position.clone(); b.node.active = true; }
            b.node.setPosition(b.base.x, b.base.y - drop * offset, b.base.z);
        }
        for (const id of PUZZLE_ROW) if (view.has(id)) view.setVisible(id, false);
        if (offset > 0) return;
        this.barReady = true;
        this.catcher?.destroy();
        this.catcher = null;
        this.finishing = false;
        if (guided) this.guide.point(view.element('win_home'), 'home');
    }
    /** Win bar buttons; the first tap decides, a second one in the same frame never routes again. */
    private onWinAction(id: string): void {
        if (!this.barReady || this.guide.active && !this.guide.allows('result', id)) return;
        const finished = mainlineFinished(this.game.state, this.game.rules);
        if (id === 'win_next' && this.winKind === 'replay') { this.request++; this.leave(); this.onReplayList?.(); }
        else if (id === 'win_next' && !finished) void this.play(this.game.state.mainline.nextLevelNo);
        else this.goHome();
    }
    /** A transparent full-screen node above the page that swallows taps. */
    private cover(view: LayoutView, tap: () => void): Node {
        const node = new Node('WinCatcher');
        node.layer = view.node.layer; node.parent = view.node;
        const size = view.node.getComponent(UITransform)!;
        node.addComponent(UITransform).setContentSize(size.width, size.height);
        node.addComponent(BlockInputEvents);
        node.on(Node.EventType.TOUCH_END, tap);
        return node;
    }

    /** Failure (moves used up): saved first, the board darkens and sways once, then S07. */
    private async fail(): Promise<void> {
        const session = this.session!, request = this.request;
        this.finishing = true;
        this.controller?.cancelDrag();
        try { this.game.act(s => abandonAttempt(s, session.attemptId)); }
        catch (error) { this.finishing = false; this.rewards.failure(error, () => void this.fail()); return; }
        await this.boardFx?.fail();
        if (request !== this.request) return;
        this.finishing = false;
        const cost = startCost(this.game.state, this.game.rules, this.levelNo);
        void this.nav.showDialog('S07', id => {
            if (id === 'home') { this.nav.closeDialog(); this.goHome(); }
            else if (id === 'retry') {
                this.nav.closeDialog();
                void this.restart();
            }
        }, v => {
            v.setText('retry_energy', `重新挑战需要 ${cost} 点体力（现有 ${this.game.state.energy.value}）`);
            v.setText('retry_text', `再试一次 · ${cost}体力`);
        });
    }
}
