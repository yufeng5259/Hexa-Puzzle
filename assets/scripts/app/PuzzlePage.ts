import { Button, Camera, JsonAsset, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import type { Game } from '../core/Game';
import { abandonAttempt, completeAttempt, mainlineFinished, recordPlacement, saveBoard, startAttempt, startCost, useHint } from '../core/Mainline';
import { upgradeCost } from '../core/Progress';
import { mainlineLevel, reward, RuleError } from '../core/Rules';
import type { Attempt } from '../core/State';
import { LevelCatalog, type LevelDefinition } from '../features/puzzle/data/LevelCatalog';
import { PuzzleBoardPresentation } from '../features/puzzle/presentation/PuzzleBoardPresentation';
import { PuzzleController } from '../features/puzzle/controller/PuzzleController';
import { PuzzleSession, type PuzzleSessionSnapshot } from '../features/puzzle/session/PuzzleSession';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';
import type { GuideCoach, Hole, Lesson } from './GuideCoach';
import type { HexCell } from '../features/puzzle/data/LevelDefinition';

const LOW_STEPS = 3;
const BUTTON_ART: Record<string, string> = { undo_button: 'blue', replay_button: 'purple', hint_button: 'teal' };

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
    private catalog: LevelCatalog | null = null;
    private view: LayoutView | null = null;
    private board: PuzzleBoardPresentation | null = null;
    private controller: PuzzleController | null = null;
    private session: PuzzleSession | null = null;
    private level: LevelDefinition | null = null;
    private levelNo = 0;
    private chargeHint = false;
    /** The running teaching drag and the GuideSteps row it belongs to. */
    private teaching: { rowId: string; lesson: Lesson } | null = null;
    private suspended = false;
    private request = 0;
    private unsubscribe: (() => void) | null = null;

    /** inputCamera: the Canvas camera, so drags map screen points into board space. */
    public constructor(private readonly game: Game, private readonly nav: Navigator, loader: ResourceLoader, private readonly inputCamera: Camera | null, private readonly guide: GuideCoach) {
        this.scope = loader.createScope();
        this.rewards = new RewardPresenter(game, nav, () => this.renderHud(), false);
        // The attempt is saved with every move, so leaving for endless keeps it intact.
        this.rewards.onEndless = () => { this.request++; this.leave(); this.onEndless?.(); };
    }

    /** Play from home: resumes the saved attempt, otherwise starts the next level (paying energy). */
    public async play(levelNo = this.game.state.mainline.nextLevelNo): Promise<void> {
        const saved = this.game.state.mainline.attempt;
        if (saved) return this.show(saved);
        if (!this.game.state.mainline.cleared[levelNo] && levelNo !== this.game.state.mainline.nextLevelNo) return;
        if (mainlineFinished(this.game.state, this.game.rules) && !this.game.state.mainline.cleared[levelNo]) return;
        const attempt = this.start(levelNo);
        if (attempt) await this.show(attempt);
    }

    /** Pauses dragging while any dialog is up, including shared ones (settings, energy). */
    public update(): void {
        const controller = this.controller;
        if (!controller?.isValid) return;
        if (this.nav.dialogOpen && !this.suspended) { this.suspended = true; controller.suspend(); }
        else if (!this.nav.dialogOpen && this.suspended) { this.suspended = false; controller.resume(); }
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

    private async loadCatalog(): Promise<LevelCatalog> {
        if (!this.catalog) {
            const catalog = new LevelCatalog((await this.scope.load('puzzle.catalog', JsonAsset)).json);
            for (const level of this.game.rules.mainline) catalog.getById(level.puzzleId); // config must match the 110 questions
            this.catalog = catalog;
        }
        return this.catalog;
    }

    private async show(attempt: Attempt): Promise<void> {
        const request = ++this.request;
        try {
            const catalog = await this.loadCatalog();
            const level = catalog.getById(mainlineLevel(this.game.rules, attempt.levelNo).puzzleId);
            const view = await this.nav.replacePage(level.mode === 'challenge' ? 'S05' : 'S04', id => this.onAction(id));
            if (request !== this.request) return;
            this.leave();
            const board = view.getComponent(PuzzleBoardPresentation)!, controller = view.getComponent(PuzzleController)!;
            await board.present(view.resources, level);
            if (request !== this.request || !view.isValid) return;
            const session = new PuzzleSession(level, attempt.attemptId);
            if (attempt.board) {
                try { session.restore(attempt.board as PuzzleSessionSnapshot); }
                catch (error) { console.warn('Saved board ignored', error); }
            }
            Object.assign(this, { view, board, controller, session, level, levelNo: attempt.levelNo, suspended: false });
            session.beforeCommit = candidate => this.persist(candidate);
            controller.onOutcome = status => status === 'completed' ? this.win() : this.fail();
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
            // A board saved at its final move still owes its outcome.
            const status = session.snapshot.status;
            if (status === 'completed') this.win(); else if (status === 'failed') this.fail();
        } catch (error) {
            if (request === this.request) this.rewards.failure(error);
        }
    }

    private leave(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.session) this.session.beforeCommit = null;
        if (this.controller?.isValid) { this.controller.onOutcome = null; this.controller.onError = null; }
        this.view = this.board = this.controller = this.session = this.level = null;
    }

    private goHome(): void { this.teaching = null; this.guide.clear(); this.request++; this.leave(); this.onHome?.(); }

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
        const s = this.game.state;
        view.setText('energy_value', `${s.energy.value}/${this.game.rules.energy.max}`);
        view.setText('coin_value', s.wallet.coins.toLocaleString('en-US'));
        view.setText('hint_count', s.wallet.hints);
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
        if (this.nav.dialogOpen || !session) return;
        if (this.lesson() && !this.guide.allows('puzzle', id)) return; // forced first drag: no way around it
        // A finished board (outcome dialog closed by a blocked retry) can only go home.
        if (session.snapshot.status !== 'active') { if (id === 'hud_btn_square_blue') this.goHome(); return; }
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
                this.goHome();
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
            else if (id === 'restart') {
                this.nav.closeDialog();
                const attempt = this.start(this.levelNo);
                if (attempt) void this.show(attempt);
            }
        }, v => v.setText('restart_cost', cost ? `新开一局需要 ${cost} 点体力` : '首关免费，不消耗体力'));
    }

    private win(): void {
        const session = this.session!, levelNo = this.levelNo, rules = this.game.rules;
        let kind: 'firstClear' | 'replay' | 'duplicate';
        try { kind = this.game.act(s => completeAttempt(s, rules, session.attemptId, this.game.day())); }
        catch (error) { this.rewards.failure(error, () => this.win()); return; }
        const level = mainlineLevel(rules, levelNo), replay = kind === 'replay';
        const prize = reward(rules, replay ? level.replayRewardId : level.firstClearRewardId);
        const s = this.game.state, finished = mainlineFinished(s, rules);
        const cheapest = Math.min(...rules.maps.find(m => m.id === s.maps.currentMapId)!.buildings
            .map(b => upgradeCost(s, rules, s.maps.currentMapId, b.id) ?? Infinity));
        const guided = this.guide.active;
        void this.nav.showDialog('S06', id => {
            if (guided && !this.guide.allows('result', id)) return;
            if (id === 'btn_green' && replay) { this.nav.closeDialog(); this.request++; this.leave(); this.onReplayList?.(); }
            else if (id === 'btn_green' && !finished) { this.nav.closeDialog(); void this.play(this.game.state.mainline.nextLevelNo); }
            else if (id === 'btn_grey' || id === 'btn_green') { this.nav.closeDialog(); this.goHome(); }
        }, v => {
            v.setText('first_clear', `第${levelNo}关 · ${replay ? '复玩' : '首次通关'}`);
            v.setText('reward_coin', `+${prize.coins}`);
            v.setText('build_suggestion', s.wallet.coins >= cheapest ? '金币充足，可以回家建造' : '继续闯关，攒金币建造家园');
            if (replay) v.setText('next', '继续复玩');
            else if (finished) v.setText('next', '主线完成');
            if (guided) { v.setVisible('btn_green', false); v.setVisible('next', false); this.guide.point(v.element('btn_grey'), 'home'); }
        });
    }

    private fail(): void {
        const session = this.session!;
        try { this.game.act(s => abandonAttempt(s, session.attemptId)); }
        catch (error) { this.rewards.failure(error, () => this.fail()); return; }
        const cost = startCost(this.game.state, this.game.rules, this.levelNo);
        void this.nav.showDialog('S07', id => {
            if (id === 'home') { this.nav.closeDialog(); this.goHome(); }
            else if (id === 'retry') {
                this.nav.closeDialog();
                const attempt = this.start(this.levelNo);
                if (attempt) void this.show(attempt);
            }
        }, v => {
            v.setText('retry_energy', `重新挑战需要 ${cost} 点体力（现有 ${this.game.state.energy.value}）`);
            v.setText('retry_text', `再试一次 · ${cost}体力`);
        });
    }
}
