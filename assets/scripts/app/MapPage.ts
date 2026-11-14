import { UITransform } from 'cc';
import type { Game } from '../core/Game';
import { mainlineFinished, startCost } from '../core/Mainline';
import { mapProgress } from '../core/Progress';
import { reward, type Rules } from '../core/Rules';
import type { GameState } from '../core/State';
import { VirtualList } from '../framework/ui/VirtualList';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { showEnergy } from './EnergyHud';

const CARD_GAP = 18;
const LOCKED = { card: 388, thumbTop: 19, thumbHeight: 268, row: 332 };
type CardState = 'current' | 'done' | 'locked';

export interface MapRoutes {
    /** Shows a map on the home page; null = the current build map. */
    home(viewMapId: string | null): void;
    /** Starts a replay attempt of a cleared level (pays energy there, not here). */
    replay(levelNo: number): void;
}

/**
 * S16 map selection and its S16-B variant "选择已通关关卡" (replay list). Viewing a
 * finished map never changes which map is being built; future maps never load.
 */
export class MapPage {
    private view: LayoutView | null = null;
    private request = 0;
    private selected = 0;
    private levels: number[] = [];

    public constructor(private readonly game: Game, private readonly nav: Navigator, private readonly routes: MapRoutes) {}

    public async openMaps(): Promise<void> {
        const view = await this.open();
        if (!view) return;
        view.setText('title', '蜂群地图');
        view.setText('return_home_text', '返回家园');
        const list = view.element('MapList'), content = list.getChildByName('MapView')!.getChildByName('MapContent')!;
        const cards = this.game.config.maps;
        let y = 0;
        for (const map of cards) {
            const card = await this.nav.instantiate('MapCard', content, id => { if (id === 'enter') this.enter(map.id); });
            if (!view.isValid) return;
            this.paintCard(card, map.id);
            const h = card.node.getComponent(UITransform)!.height, w = content.getComponent(UITransform)!.width;
            card.node.setPosition(w / 2, -y - h / 2, 0);
            y += h + CARD_GAP;
        }
        content.getComponent(UITransform)!.height = Math.max(y - CARD_GAP, list.getComponent(UITransform)!.height);
    }

    /** S16-B: every cleared level, newest first; choosing one does not spend energy yet. */
    public async openReplay(): Promise<void> {
        const view = await this.open();
        if (!view) return;
        const s = this.game.state, rules = this.game.rules;
        this.levels = rules.mainline.map(l => l.levelNo).filter(n => s.mainline.cleared[n]).reverse();
        this.selected = 0;
        view.setText('title', mainlineFinished(s, rules) ? '选择已通关关卡' : '复玩已通关关卡');
        view.setVisible('MapList', false);
        view.setVisible('ReplayList', true);
        this.renderReplay(view);
    }

    private async open(): Promise<LayoutView | null> {
        const request = ++this.request;
        const view = await this.nav.replacePage('S16', id => this.onAction(id));
        if (request !== this.request) return null;
        this.view = view;
        this.renderHud(view);
        return view;
    }

    private renderHud(v: LayoutView): void {
        const s = this.game.state, rules = this.game.rules;
        const level = rules.levels[Math.min(s.player.level - 1, rules.levels.length - 1)];
        v.setText('player_level', s.player.level);
        v.setText('coin_value', s.wallet.coins.toLocaleString('en-US'));
        showEnergy(v, this.game);
        const fill = v.element('bar_fill_green').getComponent(UITransform)!, full = v.element('bar_bg').getComponent(UITransform)!.width;
        fill.width = Math.max(8, full * Math.min(1, s.player.exp / level.expToNext));
    }

    private paintCard(card: LayoutView, mapId: string): void {
        const s = this.game.state, rules = this.game.rules, state = cardState(s, rules, mapId);
        const map = this.game.config.maps.find(m => m.id === mapId)!, index = rules.maps.findIndex(m => m.id === mapId);
        const p = mapProgress(s, rules, mapId);
        card.setText('name', map.name);
        this.frame(card, 'card', `UI/地图选择/map_card_${state}.png`);
        this.frame(card, 'thumbnail', `UI/地图选择/map_thumb_${mapId.toLowerCase()}.png`);
        const open = state !== 'locked';
        for (const id of ['progress_bg', 'progress_fill', 'progress', 'enter', 'enter_text']) card.setVisible(id, open);
        for (const id of ['lock', 'condition']) card.setVisible(id, !open);
        card.setVisible('tag', state === 'current'); card.setVisible('tag_text', state === 'current');
        if (open) {
            card.setText('progress', `${p.built}/${p.total}`);
            card.setText('enter_text', state === 'current' ? '进入' : '回看');
            const fill = card.element('progress_fill').getComponent(UITransform)!, bg = card.element('progress_bg');
            const full = bg.getComponent(UITransform)!.width - 12;
            fill.setAnchorPoint(0, 0.5);
            fill.width = Math.max(1, full * p.built / p.total);
            card.element('progress_fill').setPosition(bg.position.x - full / 2, bg.position.y, 0);
        } else {
            // S16 draws locked cards shorter: card 388, thumbnail 268 from 19, name row centred at 332 (layout px from the card top).
            const k = 1844 / 1842, h = LOCKED.card * k, top = h / 2;
            card.node.getComponent(UITransform)!.height = h;
            card.element('card').getComponent(UITransform)!.height = h;
            card.element('card').setPosition(0, 0, 0);
            card.element('thumbnail').getComponent(UITransform)!.height = LOCKED.thumbHeight * k;
            card.element('thumbnail').setPosition(0, top - (LOCKED.thumbTop + LOCKED.thumbHeight / 2) * k, 0);
            for (const id of ['name', 'lock', 'condition']) card.element(id).setPosition(card.element(id).position.x, top - LOCKED.row * k, 0);
            const previous = this.game.config.maps[index - 1];
            card.setText('condition', `完成${previous?.name ?? '上一张地图'}后解锁`);
        }
    }

    private enter(mapId: string): void {
        if (this.nav.dialogOpen) return;
        const state = cardState(this.game.state, this.game.rules, mapId);
        if (state === 'locked') return;
        this.leave();
        this.routes.home(state === 'current' ? null : mapId);
    }

    private renderReplay(v: LayoutView): void {
        const list = v.element('ReplayList').getComponent(VirtualList)!, rules = this.game.rules;
        list.setData(this.levels.map((n, i) => ({ title: `第${n}关 · ${rules.mainline[n - 1].kind === 'challenge' ? '挑战' : '普通'} · 已通关`, selected: i === this.selected })),
            index => { this.selected = index; this.renderReplay(v); list.jumpTo(Math.max(0, index - 2)); });
        const levelNo = this.levels[this.selected];
        if (levelNo === undefined) { v.setText('return_home_text', '返回家园'); return; }
        const prize = reward(rules, rules.mainline[levelNo - 1].replayRewardId);
        v.setText('return_home_text', `复玩第${levelNo}关 · ${startCost(this.game.state, rules, levelNo)}体力 · 金币+${prize.coins}`);
    }

    private onAction(id: string): void {
        if (this.nav.dialogOpen) return;
        const replaying = this.view?.isValid && this.view.element('ReplayList').active;
        if (id === 'hud_btn_square_blue') { this.leave(); this.routes.home(null); }
        else if (id === 'return_home') {
            const levelNo = this.levels[this.selected];
            this.leave();
            if (replaying && levelNo !== undefined) this.routes.replay(levelNo); else this.routes.home(null);
        }
    }

    private leave(): void { this.request++; this.view = null; this.levels = []; }

    private frame(v: LayoutView, id: string, assetId: string): void {
        this.nav.loadFrame(assetId).then(f => { if (v.isValid) v.setFrame(id, f); }, error => console.error(error));
    }
}

function cardState(s: GameState, rules: Rules, mapId: string): CardState {
    if (mapId === s.maps.currentMapId) return 'current';
    if (s.maps.completed[mapId]) return 'done';
    return 'locked';
}
