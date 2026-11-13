import { SpriteFrame } from 'cc';
import type { Game } from '../core/Game';
import { secondsToNextEnergy } from '../core/Energy';
import { claimWelcome, guideStep } from '../core/Guide';
import { endlessUnlocked, goToNextMap } from '../core/Progress';
import type { DisplayEvent } from '../core/State';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import type { GuideCoach } from './GuideCoach';

const KNOB_OFFSET = 55;
/** Rewards shown by their own pages, not by the home queue. */
const OWN_PAGE = new Set<DisplayEvent['type']>(['firstClear', 'replay', 'signIn', 'dailyTask', 'dailyChest', 'endlessStage', 'welcome']);

/**
 * Home-side dialogs: queued reward display (S13 level up, S14 building max, S15
 * map complete, S25 welcome), plus S10 energy, S11 coins, S23 settings, S24 failure.
 * Rewards are already in the wallet when shown; closing a dialog never grants again.
 */
export class RewardPresenter {
    /** drains=false: closing a dialog does not pull in queued home rewards (used on the puzzle page). */
    public constructor(private readonly game: Game, private readonly nav: Navigator, private readonly changed: () => void, private readonly drains = true, private readonly guide: GuideCoach | null = null) {}

    /** Shows every pending reward in order, then the welcome step of the first-run guide. */
    public drain(): void {
        if (this.nav.dialogOpen) return;
        let event: DisplayEvent | null;
        while ((event = this.peek()) && OWN_PAGE.has(event.type)) this.game.takeDisplay();
        if (event) { this.game.takeDisplay(); this.show(event); return; }
        if (guideStep(this.game.state, this.game.rules) === 'welcome') this.welcome();
    }
    private peek(): DisplayEvent | null { return this.game.state.displayQueue[0] ?? null; }
    private next = (): void => { this.guide?.clear(); this.nav.closeDialog(); this.changed(); if (this.drains) this.drain(); };

    private show(event: DisplayEvent): void {
        const r = event.reward;
        if (event.type === 'levelUp') void this.nav.showDialog('S13', id => id === 'confirm' && this.next(), v => {
            v.setText('new_level_value', event.detail!.level); v.setText('new_level', `等级 ${event.detail!.level}`);
            v.setText('energy_reward', `+${r.energy}`);
        });
        else if (event.type === 'buildingMax') void this.nav.showDialog('S14', () => undefined, v => {
            v.setText('building_complete', r.coins ? `建筑完成  金币 +${r.coins}` : '建筑完成');
            setTimeout(() => { if (v.isValid) this.next(); }, 1500); // non-modal toast
        });
        else if (event.type === 'mapComplete') void this.nav.showDialog('S15', id => this.onMapComplete(id), v => {
            const map = this.game.rules.maps.find(m => m.id === event.detail!.mapId)!;
            v.setText('map_progress', `${map.buildings.length * 5}/${map.buildings.length * 5}`);
            v.setText('map_reward', `+${r.coins}`);
            if (!map.nextMapId) v.setText('claim_next_text', '现有地图已完成');
        });
        else this.drain();
    }
    private onMapComplete(id: string): void {
        if (id === 'claim_next') {
            try { this.game.act(s => goToNextMap(s, this.game.rules)); } catch (error) { console.error(error); }
            this.next();
        } else if (id === 'stay') this.next();
    }
    private welcome(): void {
        const reward = this.game.rules.rewards[this.game.rules.welcomeRewardId];
        void this.nav.showDialog('S25', id => {
            if (id !== 'claim_continue') return;
            try {
                // Reward and guide completion are one save; on failure the gift stays claimable.
                this.game.act(s => claimWelcome(s, this.game.rules));
                this.game.takeDisplay();
                this.next();
            } catch (error) { this.nav.closeDialog(); this.failure(error, () => this.welcome()); }
        }, v => {
            v.setText('coin_reward', `+${reward.coins}`); v.setText('hint_reward', `+${reward.hints}`);
            this.guide?.point(v.element('claim_continue'), 'welcome');
        });
    }

    public energy(blocking: boolean): void {
        const s = this.game.state, rules = this.game.rules, left = secondsToNextEnergy(s, rules, this.game.now());
        void this.nav.showDialog('S10', id => { if (id === 'btn_close_dialog' || id === 'return') this.next(); }, v => {
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
            v.setText(`${key}_state`, on ? '开启' : '关闭');
            v.element(`${key}_toggle_knob`).setPosition(track.position.x + (on ? KNOB_OFFSET : -KNOB_OFFSET), track.position.y, 0);
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
