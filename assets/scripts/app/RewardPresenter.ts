import { Label, Node, SpriteFrame, tween, UITransform, Vec3 } from 'cc';
import type { Game } from '../core/Game';
import { nextDisplay, rewardText, sumRewards } from '../core/Display';
import { secondsToNextEnergy } from '../core/Energy';
import { claimWelcome, guideStep } from '../core/Guide';
import { endlessUnlocked, goToNextMap } from '../core/Progress';
import type { Reward } from '../core/Rules';
import type { DisplayEvent } from '../core/State';
import type { RewardShow } from '../features/fx/RewardFx';
import type { LayoutView } from '../features/ui/LayoutView';
import { hudTargets } from './EnergyHud';
import type { Navigator } from './Navigator';
import type { GuideCoach } from './GuideCoach';

const KNOB_OFFSET = 55;
/** A dialog's own reward elements are used once its pop-in (LayoutView.popIn) has settled. */
const POP_IN_MS = 200;
/** S14 is a short toast. */
const TOAST_MS = 1500;
/** HelpDialog text box grown over its (hidden) picture for the left-over reward note. */
const RECOVER_TEXT_HEIGHT = 520;

/**
 * Home-side dialogs: queued reward display (S13 level up, S14 building max, S15
 * map complete, S25 welcome), plus S10 energy, S11 coins, S23 settings, S24 failure.
 * Rewards are already in the wallet when shown; a show never grants again. Queued
 * events stay in the save until their show has run, then are confirmed by id.
 */
export class RewardPresenter {
    /** S10 "去无尽" (shown once endless is unlocked). */
    public onEndless: (() => void) | null = null;
    /** Called when drain() finds nothing left to show (all rewards shown, no guide step pending). */
    public onIdle: (() => void) | null = null;
    /**
     * Called when a non-terminal map finishes; the caller plays the honeycomb transition and
     * shows a toast. The presenter has already paid the reward and acknowledged the event.
     * Signature: (doneMapId, doneView, nextView).
     */
    /** Called when the player taps "返回首页" on the last-map complete dialog. */
    public onReturnHome: (() => void) | null = null;
    public onMapTransition: ((doneId: string, done: import('../core/Config').MapView, next: import('../core/Config').MapView) => void) | null = null;
    /** drains=false: closing a dialog does not pull in queued home rewards (used on the puzzle page). */
    public constructor(private readonly game: Game, private readonly nav: Navigator, private readonly changed: () => void, private readonly drains = true, private readonly guide: GuideCoach | null = null) {}

    /**
     * Plays a saved reward on the effects layer towards the top page's HUD, then confirms the
     * display events. Ends early (and still confirms) when the owner view goes away.
     */
    public collect(reward: Reward, ids: readonly string[], show: Omit<RewardShow, 'reward' | 'targets'>): Promise<void> {
        // After confirming, the page repaints its HUD from the saved values (energy may have recovered meanwhile).
        return this.nav.fx.play({ ...show, reward, targets: hudTargets(this.nav.topPage, this.game) }).then(() => { this.game.ackDisplay(ids); this.changed(); });
    }

    /** Modal reward dialogs shown since the page arrived home (docs/v2/10 §4: at most MODALS_PER_VISIT). */
    private modals = 0;
    /**
     * Shows the next pending reward (one at a time), then the welcome step of the first-run guide.
     * Toasts (level up, building done) always show; a modal one (map complete, left-over rewards)
     * only while this visit has not had one yet, otherwise it waits in the queue for the next visit.
     * fresh: a new visit (arriving home, or a build just finished there).
     */
    public drain(fresh = false): void {
        if (fresh) this.modals = 0;
        if (this.nav.dialogOpen || this.nav.fx.busy) return;
        const next = nextDisplay(this.game.displays, id => this.game.fromEarlierRun(id));
        if (next && isModal(next) && this.modals >= MODALS_PER_VISIT) return;
        if (next && isModal(next)) this.modals++;
        if (next?.kind === 'recover') this.recover(next.events);
        else if (next) this.show(next.events);
        else if (guideStep(this.game.state, this.game.rules) === 'welcome') this.welcome();
        else this.onIdle?.();
    }
    private next = (): void => { this.guide?.clear(); this.nav.closeDialog(); this.changed(); if (this.drains) this.drain(); };

    private show(events: DisplayEvent[]): void {
        const event = events[events.length - 1], r = sumRewards(events), ids = events.map(e => e.id);
        if (event.type === 'levelUp') void this.nav.showDialog('S14', () => undefined, v => {
            // Level up is a toast (docs/v2/10 §4): several at once share one, with every level's reward.
            const from = Number(events[0].detail!.level), to = Number(event.detail!.level);
            v.setText('building_complete', [from === to ? `升到 ${to} 级` : `升到 ${from}–${to} 级`, rewardText(r)].filter(Boolean).join(' · '));
            const shown = this.afterPopIn(v, () => this.collect(r, ids, { owner: v.node, from: v.element('hud_capsule_light'), sources: { energy: v.element('hud_capsule_light') } }));
            void Promise.all([shown, wait(TOAST_MS)]).then(() => { if (v.isValid) this.next(); });
        });
        else if (event.type === 'buildingMax') void this.nav.showDialog('S14', () => undefined, v => {
            v.setText('building_complete', r.coins ? `建筑完成  金币 +${r.coins}` : '建筑完成');
            // Non-modal toast: closes after its time and once the coins have landed.
            const shown = this.afterPopIn(v, () => this.collect(r, ids, { owner: v.node, from: v.element('hud_capsule_light'), sources: { coins: v.element('hud_capsule_light') } }));
            void Promise.all([shown, wait(TOAST_MS)]).then(() => { if (v.isValid) this.next(); });
        });
        else if (event.type === 'mapComplete') {
            const map = this.game.rules.maps.find(m => m.id === event.detail!.mapId)!, views = this.game.config.maps;
            const view = views.find(m => m.id === map.id)!, next = views.find(m => m.id === map.nextMapId);
            if (next && this.onMapTransition) {
                // Non-last map: ack the reward (coins were already written to the wallet by grantAndShow),
                // then fire the transition; skip the fx animation so the cover plays immediately.
                this.game.ackDisplay(ids);
                this.changed();
                void this.onMapTransition!(map.id, view, next);
                // levelUp / other queued events will drain when enter() finishes.
                return;
            } else {
                // Last map (no next) or no transition callback: show the S15 dialog.
                void this.nav.showDialog('S15', id => this.onMapComplete(id), v => {
                    v.setText('title', `${view.name}完工`);
                    v.setText('map_progress', `${map.buildings.length * 5}/${map.buildings.length * 5}`);
                    v.setText('map_complete', next ? (next.chapter !== view.chapter ? `${view.chapter}章节完成！下一站：${next.chapter}` : `收获${view.subtitle}`) : '敬请期待更多地图');
                    v.setText('map_reward', `+${r.coins}`);
                    v.setText('claim_next_text', next ? `前往${next.name}` : '返回首页');
                    void this.afterPopIn(v, () => this.collect(r, ids, { owner: v.node, from: v.element('panel_inner'), sources: { coins: v.element('icon_coin') } }));
                });
            }
        }
        else { this.game.ackDisplay(ids); this.drain(); }
    }
    /** Page rewards the app closed on before their page showed them: one short note, never paid again. */
    private recover(events: DisplayEvent[]): void {
        const ids = events.map(e => e.id);
        void this.nav.showDialog('HelpDialog', id => { if (id === 'confirm' || id === 'btn_close_dialog') this.next(); }, v => {
            v.setText('title', '已获得');
            v.setText('help_text', `上次领取的奖励已经到账\n${rewardText(sumRewards(events)) || '无'}`);
            // No rules picture here: the text takes its place, centred, keeping its bottom edge.
            if (v.has('help_art')) {
                v.setVisible('help_art', false);
                const label = v.label('help_text'), ui = label.node.getComponent(UITransform)!, bottom = ui.height * ui.anchorY;
                ui.setContentSize(ui.width, RECOVER_TEXT_HEIGHT);
                ui.anchorY = bottom / RECOVER_TEXT_HEIGHT;
                label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
                label.fontSize = 38; label.lineHeight = 60;
            }
            this.game.ackDisplay(ids);
        });
    }
    private onMapComplete(id: string): void {
        if (id === 'claim_next') {
            const hasNext = !!this.game.rules.maps.find(m => m.id === this.game.state.maps.currentMapId)?.nextMapId;
            if (hasNext) {
                try { this.game.act(s => goToNextMap(s, this.game.rules)); } catch (error) { console.error(error); }
            } else {
                // Last map: "返回首页" navigates home without advancing.
                this.onReturnHome?.();
            }
            this.next();
        } else if (id === 'stay' || id === 'btn_close_dialog') this.next();
    }
    private welcome(): void {
        const reward = this.game.rules.rewards[this.game.rules.welcomeRewardId];
        void this.nav.showDialog('S25', (id, v) => {
            if (id !== 'claim_continue' || guideStep(this.game.state, this.game.rules) !== 'welcome') return;
            let event: DisplayEvent | null;
            // Reward and guide completion are one save; on failure the gift stays claimable.
            try { event = this.game.act(s => claimWelcome(s, this.game.rules)); }
            catch (error) { this.nav.closeDialog(); this.failure(error, () => this.welcome()); return; }
            // The guide moves on only after the gift has landed.
            this.guide?.clear();
            if (!event) { this.next(); return; }
            void this.collect(event.reward, [event.id], { owner: v.node, from: v.element('claim_continue'), sources: { coins: v.element('icon_coin'), hints: v.element('icon_hint') } })
                .then(() => this.next());
        }, v => {
            v.setText('coin_reward', `+${reward.coins}`); v.setText('hint_reward', `+${reward.hints}`);
            this.guide?.point(v.element('claim_continue'), 'welcome');
        });
    }
    /** Runs a show once the dialog stopped growing; a dialog closed before that has nothing to show. */
    private afterPopIn(v: LayoutView, show: () => Promise<void>): Promise<void> {
        return wait(POP_IN_MS).then(() => v.isValid ? show() : undefined);
    }

    public energy(blocking: boolean): void {
        const s = this.game.state, rules = this.game.rules, left = secondsToNextEnergy(s, rules, this.game.now());
        void this.nav.showDialog('S10', id => { if (id === 'btn_close_dialog' || id === 'return') this.next(); else if (id === 'go_endless') { this.next(); this.onEndless?.(); } }, v => {
            v.setText('title', blocking ? '体力不足' : '体力');
            v.setText('energy_amount', `${s.energy.value} / ${rules.energy.max}`);
            v.setText('energy_timer', left === null ? '体力已满' : `下点恢复 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
            v.setVisible('go_endless', endlessUnlocked(s, rules)); v.setVisible('go_endless_text', endlessUnlocked(s, rules));
        });
    }
    public coinsShort(cost: number, play: () => void): void {
        const have = this.game.state.wallet.coins;
        void this.nav.showDialog('S11', id => {
            if (id === 'play') { this.next(); play(); } else if (id === 'later' || id === 'btn_close_dialog') this.next();
        }, v => { v.setText('cost_value_0', have); v.setText('cost_value_1', cost); v.setText('cost_value_2', cost - have); });
    }
    public failure(error: unknown, retry?: () => void): void {
        console.error(error);
        void this.nav.showDialog('S24', id => {
            if (id === 'retry_save') { this.nav.closeDialog(); retry?.(); } else if (id === 'continue') this.next();
        }, v => { v.setVisible('retry_save', !!retry); v.setVisible('retry_save_text', !!retry); });
    }

    public settings(): void {
        const keys = ['music', 'sound', 'vibration'] as const;
        const paint = (v: LayoutView) => keys.forEach(key => {
            const on = this.game.state.settings[key], track = v.element(`${key}_toggle_track`);
            v.element(`${key}_toggle_knob`).setPosition(track.position.x + (on ? KNOB_OFFSET : -KNOB_OFFSET) * track.scale.x, track.position.y, 0);
            this.frame(v, `${key}_toggle_track`, `UI/通用/toggle_track_${on ? 'on' : 'off'}.png`);
            this.frame(v, `${key}_toggle_knob`, `UI/通用/toggle_knob_${on ? 'on' : 'off'}.png`);
        });
        void this.nav.showDialog('S23', (id, v) => {
            const key = keys.find(k => id === `${k}_toggle_track`);
            if (key) {
                // A failed write leaves the saved value, which paint() shows again.
                try { this.game.act(s => { s.settings[key] = !s.settings[key]; }); } catch (error) { console.error(error); }
                paint(v);
            } else if (id === 'done' || id === 'btn_close_dialog') this.next();
        }, paint);
    }
    private frame(v: LayoutView, id: string, assetId: string): void {
        this.nav.loadFrame(assetId).then(f => { if (v.isValid) v.setFrame(id, f as SpriteFrame); }, error => console.error(error));
    }
}

/** docs/v2/10 §4: arriving home after a win shows at most one modal reward window. */
const MODALS_PER_VISIT = 1;
function isModal(next: { kind: 'recover' | 'show'; events: DisplayEvent[] }): boolean {
    return next.kind === 'recover' || next.events[0].type === 'mapComplete';
}

function wait(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

/** Short 1 → 1.1 → 1 pop of a dialog element (a claimed cell, a level badge). */
export function bounce(node: Node): void {
    if (!node.isValid) return;
    const base = node.scale.clone(), up = new Vec3(base.x * 1.1, base.y * 1.1, base.z);
    tween(node).to(0.08, { scale: up }, { easing: 'quadOut' }).to(0.08, { scale: base }, { easing: 'quadIn' }).start();
}
