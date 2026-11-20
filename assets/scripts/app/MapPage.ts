import { Color, Node, ScrollView, Sprite, UITransform, Vec2 } from 'cc';
import type { Game } from '../core/Game';
import { mainlineFinished, startCost } from '../core/Mainline';
import { mapProgress } from '../core/Progress';
import { mainlineLevel, payout, type Rules } from '../core/Rules';
import type { GameState } from '../core/State';
import { VirtualList } from '../framework/ui/VirtualList';
import type { LayoutView } from '../features/ui/LayoutView';
import type { Navigator } from './Navigator';
import { showEnergy, showLevel } from './EnergyHud';
import { setProgress } from '../features/ui/ProgressBar';

const CARD_GAP = 18;
/** Chapter title row above a chapter's first card (tools/v2/build-ui.mjs MAP_CHAPTER_ROW). */
const CHAPTER_ROW = 70;
const CHAPTER_NO = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
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
        const list = view.element('MapList');
        const content = list.getChildByName('MapView')!.getChildByName('MapContent')!;
        const cards = this.game.config.maps, request = this.request;
        let y = 0, chapters = 0, current: Node | null = null;
        for (let i = 0; i < cards.length; i++) {
            const map = cards[i], first = i === 0 || cards[i - 1].chapter !== map.chapter;
            const card = await this.nav.instantiate('MapCard', content, id => { if (id === 'enter') this.enter(map.id); });
            if (!view.isValid || request !== this.request) { if (card.isValid) card.node.destroy(); return; }
            this.paintCard(card, map.id);
            if (first) {
                // The chapter title sits in the row above the card; the card moves down by that row.
                card.setVisible('chapter', true);
                card.setText('chapter', `第${CHAPTER_NO[chapters] ?? chapters + 1}章 · ${map.chapter}`);
                chapters++;
                y += CHAPTER_ROW;
            }
            const h = card.node.getComponent(UITransform)!.height, w = content.getComponent(UITransform)!.width;
            card.node.setPosition(w / 2, -y - h / 2, 0);
            // Locked cards are shorter: the chapter row always sits right above the card's own top.
            if (first) card.element('chapter').setPosition(0, h / 2 + CHAPTER_ROW / 2 - 2, 0);
            if (map.id === this.game.state.maps.currentMapId) current = card.node;
            y += h + CARD_GAP;
        }
        // Set content height now.
        const totalH = Math.max(y - CARD_GAP, 1);
        content.getComponent(UITransform)!.height = totalH;
        // Defer fitListBounds one frame so LayoutView.fitScreen has fully shifted button positions.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        if (!view.isValid || request !== this.request) return;
        this.fitListBounds(view, list, 'hud_btn_square_blue', 'return_home');
        const listHeight = list.getComponent(UITransform)!.height;
        content.getComponent(UITransform)!.height = Math.max(totalH, listHeight);
        // Scroll to the map being built.
        const scroll = list.getComponent(ScrollView);
        if (current && scroll) {
            // Scroll to put the current card fully visible at the top of the list.
            // content y=0 is the content top; card position is in content local (y-down from top).
            const cardTopInContent = -current.position.y - current.getComponent(UITransform)!.height / 2;
            const offset = Math.max(0, Math.min(cardTopInContent, content.getComponent(UITransform)!.height - listHeight));
            scroll.scrollToOffset(new Vec2(0, offset), 0);
        }
    }

    /** S16-B: every cleared level, newest first; choosing one does not spend energy yet. */
    public async openReplay(): Promise<void> {
        const view = await this.open();
        if (!view) return;
        const s = this.game.state, rules = this.game.rules;
        this.levels = Object.keys(s.mainline.cleared).map(Number).filter(n => Number.isSafeInteger(n) && n > 0).sort((a, b) => b - a);
        this.selected = 0;
        view.setText('title', mainlineFinished(s, rules) ? '选择已通关关卡' : '复玩已通关关卡');
        view.setVisible('MapList', false);
        view.setVisible('ReplayList', true);
        this.renderReplay(view);
    }

    /**
     * Shrinks the list scroll view to stay clear of the two anchor buttons after fitScreen.
     * Reads node.position.y (local, already shifted by fitScreen) and accounts for anchor/scale.
     */
    private fitListBounds(view: LayoutView, list: Node, topButtonId: string, bottomButtonId: string, gap = 8): void {
        const topBtn = view.element(topButtonId), botBtn = view.element(bottomButtonId);
        const topUi = topBtn.getComponent(UITransform)!;
        const botUi = botBtn.getComponent(UITransform)!;
        // Local bottom of the top button (y-up local coords, anchor-aware).
        const topBotEdge = topBtn.position.y - topUi.height * (1 - topUi.anchorY) * Math.abs(topBtn.scale.y);
        // Local top of the bottom button.
        const botTopEdge = botBtn.position.y + botUi.height * botUi.anchorY * Math.abs(botBtn.scale.y);
        const ui = list.getComponent(UITransform)!;
        const newH = (topBotEdge - gap) - (botTopEdge + gap);
        if (newH < 100) return;
        // MapList has anchorY=0.5; setPosition sets the centre.
        const newCentreY = (topBotEdge - gap + botTopEdge + gap) / 2;
        list.setPosition(list.position.x, newCentreY, list.position.z);
        ui.setContentSize(ui.width, newH);
        // The inner MapView (mask + scroll viewport) must match the new size; it has anchorY=1.
        const mapView = list.getChildByName('MapView');
        if (mapView) {
            const mvUi = mapView.getComponent(UITransform)!;
            mapView.setPosition(-ui.width / 2, newH / 2, mapView.position.z);
            mvUi.setContentSize(ui.width, newH);
        }
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
        showLevel(v, this.game);
        v.setText('coin_value', this.game.state.wallet.coins.toLocaleString('en-US'));
        showEnergy(v, this.game);
    }

    private paintCard(card: LayoutView, mapId: string): void {
        const s = this.game.state, rules = this.game.rules, state = cardState(s, rules, mapId);
        const map = this.game.config.maps.find(m => m.id === mapId)!, index = rules.maps.findIndex(m => m.id === mapId);
        const p = mapProgress(s, rules, mapId);
        card.setText('name', map.name);
        card.setText('subtitle', map.subtitle);
        this.frame(card, 'card', `UI/地图选择/map_card_${state}.png`);
        this.frame(card, 'thumbnail', map.thumbAssetId);
        // Locked maps: the thumbnail greyed and dimmed instead of its own art (docs/v2/15 §8).
        const thumb = card.element('thumbnail').getComponent(Sprite);
        if (thumb) { thumb.grayscale = state === 'locked'; const v = state === 'locked' ? 170 : 255; thumb.color = new Color(v, v, v, 255); }
        card.setVisible('subtitle', state !== 'locked');
        const open = state !== 'locked';
        for (const id of ['progress_bg', 'progress_fill', 'progress', 'enter', 'enter_text']) card.setVisible(id, open);
        for (const id of ['lock', 'condition']) card.setVisible(id, !open);
        card.setVisible('tag', state === 'current'); card.setVisible('tag_text', state === 'current');
        if (open) {
            card.setText('progress', `${p.built}/${p.total}`);
            card.setText('enter_text', state === 'current' ? '进入' : '回看');
            setProgress(card.element('progress_fill'), p.built / p.total);
        } else {
            // S16 draws locked cards shorter: card 388, thumbnail 268 from 19, name row centred at 332 (layout px from the card top).
            const k = 1844 / 1842, h = LOCKED.card * k, top = h / 2;
            card.node.getComponent(UITransform)!.height = h;
            // 2x nine-slice frames are laid out at twice their size and scaled by ½: set the height in the node's own units.
            card.element('card').getComponent(UITransform)!.height = h / Math.abs(card.element('card').scale.y || 1);
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
        list.setData(this.levels.map((n, i) => ({ title: `第${n}关 · ${mainlineLevel(rules, n).kind === 'challenge' ? '挑战' : '普通'} · 已通关`, selected: i === this.selected })),
            index => { this.selected = index; this.renderReplay(v); list.jumpTo(Math.max(0, index - 2)); });
        const levelNo = this.levels[this.selected];
        if (levelNo === undefined) { v.setText('return_home_text', '返回家园'); return; }
        const prize = payout(this.game.state, rules, mainlineLevel(rules, levelNo).replayRewardId);
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
