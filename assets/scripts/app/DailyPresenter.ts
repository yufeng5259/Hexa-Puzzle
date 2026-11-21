import { Button, Node, UITransform } from 'cc';
import type { Game } from '../core/Game';
import { canSignIn, claimDailyChest, claimDailyTask, claimSignIn, refreshDaily, signInSlot } from '../core/Daily';
import { dailyUnlocked } from '../core/Progress';
import { payout, RuleError, type DailyTaskType, type Reward } from '../core/Rules';
import type { DailyTask, DisplayEvent, GameState } from '../core/State';
import type { LayoutView } from '../features/ui/LayoutView';
import { setProgress } from '../features/ui/ProgressBar';
import type { Navigator } from './Navigator';
import { bounce, type RewardPresenter } from './RewardPresenter';

const TASK_TEXT: Record<DailyTaskType, (n: number) => string> = {
    win: n => `完成${n}次拼图`, build: n => `完成${n}次建造`, endlessLines: n => `无尽消除${n}条线`,
    endlessScore: n => `无尽获得${n}分`, placePiece: n => `放置${n}块拼块`,
};
const TASK_ICON: Record<DailyTaskType, string> = { win: 'puzzle', placePiece: 'puzzle', build: 'build', endlessLines: 'endless', endlessScore: 'endless' };
const ICON = (r: Reward) => r.coins ? 'coin' : r.energy ? 'energy' : 'hint';
const AMOUNT = (r: Reward) => r.coins || r.energy || r.hints;
const DAYS = 7;

export interface DailyRoutes { play(): void; build(): void; endless(): void }

/**
 * S17 seven-day sign-in and S18 daily tasks, opened from the home side entries.
 * Every claim is one save; the dialog repaints from the saved state, so a failed
 * write never shows a claimed cell. The day is re-read on every open and claim.
 * A saved claim then plays its reward (cell/button pop, cards, flight to the home HUD);
 * the daily chest shakes and opens first.
 */
export class DailyPresenter {
    private view: LayoutView | null = null;
    private kind: 'signIn' | 'tasks' | null = null;
    private day = '';
    /** The chest keeps its closed picture until the show opens it. */
    private chestOpening = false;

    public constructor(private readonly game: Game, private readonly nav: Navigator, private readonly rewards: RewardPresenter, private readonly routes: DailyRoutes) {}

    /** Starts today's tasks when the local day changed (launch, foreground, midnight while playing). */
    public rollover(): void {
        const day = this.game.day();
        if (day === this.day) return;
        this.day = day;
        if (dailyUnlocked(this.game.state) && this.game.state.daily.day !== day) {
            try { this.game.act(s => refreshDaily(s, this.game.rules, day)); } catch (error) { console.error(error); }
        }
        this.repaint();
    }
    /** Called every second by the home controller: countdown and midnight. */
    public tick(): void {
        this.rollover();
        if (this.kind === 'tasks' && this.view?.isValid) this.view.setText('daily_reset', `每日0点刷新 · ${clock(this.game.msToNextDay())}`);
    }

    public signInDot(): boolean { return canSignIn(this.game.state, this.game.day()); }
    public taskDot(): boolean {
        const d = this.game.state.daily;
        if (!dailyUnlocked(this.game.state) || d.day !== this.game.day()) return false;
        return d.tasks.some(t => t.progress >= t.target && !t.claimed) || (!d.chestClaimed && d.tasks.length > 0 && d.tasks.every(t => t.progress >= t.target));
    }

    public openSignIn(): void {
        void this.nav.showDialog('S17', id => {
            if (id === 'btn_close') this.close();
            else if (id === 'btn_green') this.claimSignIn();
        }, v => { this.view = v; this.kind = 'signIn'; this.repaint(); });
    }
    public openTasks(): void {
        this.rollover();
        void this.nav.showDialog('S18', id => {
            const row = /^task_(\d)_action$/.exec(id);
            if (id === 'btn_close') this.close();
            else if (id === 'completion_claim') this.claimChest();
            else if (row) this.taskAction(Number(row[1]) - 1);
        }, v => {
            this.view = v; this.kind = 'tasks';
            this.repaint();
            this.tick();
        });
    }

    private close(): void { this.view = null; this.kind = null; this.nav.closeDialog(); }
    /** Saves a claim, repaints, then shows the saved reward from `from` (an optional chest opens first). */
    private claim(change: (draft: GameState) => DisplayEvent | null, from: Node, chest = false): void {
        const v = this.view;
        if (!v?.isValid || this.nav.fx.busy) return;
        let event: DisplayEvent | null;
        this.chestOpening = chest;
        try { event = this.game.act(change); }
        catch (error) {
            this.chestOpening = false;
            if (!(error instanceof RuleError)) { this.close(); this.rewards.failure(error); return; }
            console.warn(error.message); // stale button after a day change or a double tap: just repaint
            this.repaint();
            return;
        }
        // null: the receipt was already paid; nothing new to show.
        if (!event) this.chestOpening = false;
        this.repaint();
        if (!event) return;
        if (!chest) bounce(from);
        const open = () => { this.chestOpening = false; this.repaint(); };
        void this.rewards.collect(event.reward, [event.id], { owner: v.node, from, chest: chest ? { node: from, open } : undefined }).then(() => { if (this.chestOpening) open(); });
    }
    private claimSignIn(): void {
        const slot = signInSlot(this.game.state, this.game.rules);
        const cell = this.view!.element(slot === DAYS - 1 ? 'signin_cell_big_7' : `signin_cell_${slot + 1}`);
        const v = this.view;
        if (!v?.isValid || this.nav.fx.busy) return;
        let event: DisplayEvent | null;
        try { event = this.game.act(s => claimSignIn(s, this.game.rules, this.game.day())); }
        catch (error) {
            if (!(error instanceof RuleError)) { this.close(); this.rewards.failure(error); return; }
            console.warn((error as Error).message);
            this.repaint();
            return;
        }
        this.repaint();
        if (!event) return;
        bounce(cell);
        void this.rewards.collect(event.reward, [event.id], { owner: v.node, from: cell })
            .then(() => { this.close(); });
    }
    private claimChest(): void { this.claim(s => claimDailyChest(s, this.game.rules, this.game.day()), this.view!.element('icon_chest_closed'), true); }
    private taskAction(index: number): void {
        const task = this.game.state.daily.tasks[index];
        if (!task || task.claimed) return;
        if (task.progress >= task.target) { this.claim(s => claimDailyTask(s, this.game.rules, this.game.day(), task.id), this.view!.element(`task_${index + 1}_action`)); return; }
        // "Go" only navigates; it never pays energy or drops the current attempt by itself.
        this.close();
        if (task.type === 'build') this.routes.build();
        else if (task.type === 'endlessLines' || task.type === 'endlessScore') this.routes.endless();
        else this.routes.play();
    }

    private repaint(): void {
        const v = this.view;
        if (!v?.isValid) { this.view = null; this.kind = null; return; }
        if (this.kind === 'signIn') this.paintSignIn(v); else if (this.kind === 'tasks') this.paintTasks(v);
    }

    private paintSignIn(v: LayoutView): void {
        const s = this.game.state, rules = this.game.rules, open = canSignIn(s, this.game.day());
        // A round just finished today still shows all seven cells claimed until tomorrow.
        let done = s.signIn.claimedCount % DAYS;
        if (done === 0 && s.signIn.claimedCount > 0 && !open) done = DAYS;
        let todayCell: Node | null = null;
        for (let i = 1; i <= DAYS; i++) {
            const id = i === DAYS ? 'signin_cell_big_7' : `signin_cell_${i}`, big = i === DAYS ? 'big_' : '';
            const state = i <= done ? 'claimed' : i === done + 1 && open ? 'today' : 'locked';
            if (state === 'today') todayCell = v.element(id);
            this.frame(v, id, `UI/签到/signin_cell_${big}${state}.png`);
            const r = payout(this.game.state, rules, rules.signIn[i - 1]);
            if (i < DAYS) { v.setText(`reward_${i}`, AMOUNT(r)); this.frame(v, `reward_icon_${i}`, `UI/图标/icon_${ICON(r)}.png`); }
            else { v.setText('reward_7_coin', r.hints ? `${r.coins} +` : `${r.coins}`); v.setText('reward_7_hint', r.hints || ''); v.setVisible('icon_hint', r.hints > 0); }
        }
        const tag = v.element('signin_today_tag_bg'), label = v.element('today');
        tag.active = label.active = !!todayCell;
        if (todayCell) {
            // The tag sits on the lower-left of whichever cell is today's, as drawn on day 4.
            const ui = todayCell.getComponent(UITransform)!, k = todayCell.scale.x;
            const x = todayCell.position.x + (112 - ui.width / 2) * k, y = todayCell.position.y + (30 - ui.height / 2) * k;
            tag.setPosition(x, y, 0); label.setPosition(x, y, 0);
        }
        v.setText('claim', open ? '领取' : '明日再来');
        this.button(v, 'btn_green', open, `UI/通用/btn_green_${open ? 'normal' : 'disabled'}.png`);
    }

    private paintTasks(v: LayoutView): void {
        const d = this.game.state.daily, rules = this.game.rules;
        const tasks: DailyTask[] = d.day === this.game.day() ? d.tasks : [];
        for (let i = 1; i <= 3; i++) {
            const t = tasks[i - 1], row = t && rules.daily.tasks.find(r => r.id === t.id);
            for (const id of ['row', 'icon', 'description', 'progress_bg', 'progress_fill', 'progress', 'coins', 'action', 'action_label']) v.setVisible(`task_${i}_${id}`, !!t);
            v.setVisible(i === 1 ? 'icon_coin' : `icon_coin_${i}`, !!t);
            if (!t || !row) continue;
            const complete = t.progress >= t.target;
            this.frame(v, `task_${i}_row`, `UI/任务/task_row_${complete ? 'done' : 'normal'}.png`);
            this.frame(v, `task_${i}_icon`, `UI/任务/task_icon_${TASK_ICON[t.type]}.png`);
            v.setText(`task_${i}_description`, TASK_TEXT[t.type](t.target));
            v.setText(`task_${i}_progress`, `${t.progress}/${t.target}`);
            v.setText(`task_${i}_coins`, payout(this.game.state, rules, row.rewardId).coins);
            setProgress(v.element(`task_${i}_progress_fill`), t.progress / t.target);
            const art = t.claimed ? 'btn_grey_normal' : complete ? 'btn_green_normal' : 'btn_blue_normal';
            v.setText(`task_${i}_action_label`, t.claimed ? '已领取' : complete ? '领取' : '前往');
            this.button(v, `task_${i}_action`, !t.claimed, `UI/通用/${art}.png`);
        }
        const done = tasks.filter(t => t.progress >= t.target).length, all = tasks.length > 0 && done === tasks.length;
        v.setText('completion_progress', `今日完成 ${done}/${tasks.length}`);
        v.setText('completion_coin', payout(this.game.state, rules, rules.daily.chestRewardId).coins);
        v.setText('completion_claim_text', d.chestClaimed ? '已领取' : all ? '领取宝箱' : '完成后领取');
        this.frame(v, 'icon_chest_closed', `UI/图标/icon_chest_${d.chestClaimed && !this.chestOpening ? 'open' : 'closed'}.png`);
        this.button(v, 'completion_claim', all && !d.chestClaimed, `UI/通用/btn_green_${all && !d.chestClaimed ? 'normal' : 'disabled'}.png`);
    }

    private button(v: LayoutView, id: string, on: boolean, art: string): void {
        const button = v.element(id).getComponent(Button);
        if (button) button.interactable = on;
        this.frame(v, id, art);
    }
    private frame(v: LayoutView, id: string, assetId: string): void {
        this.nav.loadFrame(assetId).then(f => { if (v.isValid) v.setFrame(id, f); }, error => console.error(error));
    }
}

function clock(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
}
