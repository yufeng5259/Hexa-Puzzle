import { Color, Label, Node, Sprite, SpriteFrame } from 'cc';
import type { Game } from '../core/Game';
import { rewardText } from '../core/Display';
import { PLAYER_AVATAR, rankReward, tierRule, type LeagueRow, type LeagueView } from '../core/League';
import type { LocalLeaderboardService } from '../core/LeaderboardService';
import { LEAGUE_ANIMALS } from '../core/DefaultRules';
import type { LeagueBoard, LeagueGift } from '../core/Rules';
import type { LeagueSettlement } from '../core/State';
import { VirtualList } from '../framework/ui/VirtualList';
import type { LeagueRowData, LeagueRowItem } from '../features/ui/LeagueRowItem';
import type { LayoutView } from '../features/ui/LayoutView';
import { setProgress } from '../features/ui/ProgressBar';
import type { Navigator } from './Navigator';
import { RewardPresenter } from './RewardPresenter';

/** Avatar backgrounds 0–5 (LeagueBots.avatarBg); the player's own is honey gold. */
const AVATAR_BG = ['#F29E4C', '#6CC4A1', '#7FA7E8', '#E58BB5', '#B48CE0', '#F2C94C'].map(hex);
const PLAYER_BG = hex('#F5B82E');
/** Names and the own row: the player is shown in warm orange. */
const ME_COLOR = hex('#B25A12'), NAME_COLOR = hex('#FFFFFF');
/** Stand-in tints of the shared chest picture until the three league gifts are delivered (P2-12). */
const GIFT_TINT: Record<LeagueGift, Color> = { gold: hex('#FFD54A'), silver: hex('#D7E3F4'), bronze: hex('#EFA56A'), coin: hex('#FFFFFF'), none: hex('#FFFFFF') };
const TABS: readonly [string, LeagueBoard][] = [['tab_daily', 'daily'], ['tab_weekly', 'weekly'], ['tab_all', 'allTime']];
const BOARD_TITLE: Record<'daily' | 'weekly', string> = { daily: '每日联赛结算', weekly: '每周榜结算' };
const HELP = '蜂群联赛每天、每周各分一组，和模拟选手比拼无尽模式的得分。\n'
    + '· 每日：当天无尽新增分，20 人一组，次日按名次发奖并加联赛星，星满升段（只升不降）。\n'
    + '· 每周：本周累计分，30 人一组，前 10 名有奖。\n'
    + '· 总榜：单局最高分排名，不发奖。\n'
    + '联赛对手都是蜂群模拟选手，名次和奖励只和你自己的成绩有关。';

function hex(value: string): Color { const v = value.replace('#', ''); return new Color(parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), 255); }
const animal = new Map(LEAGUE_ANIMALS.map(([id, zh]) => [id, zh]));
const avatarArt = (avatar: string) => avatar === PLAYER_AVATAR ? 'UI/排行榜/avatar/avatar_player_bee.png' : `UI/排行榜/avatar/avatar_${avatar}.png`;
const giftArt = (gift: LeagueGift) => gift === 'coin' ? 'UI/图标/icon_coin.png' : `UI/排行榜/gift_${gift}_closed.png`;
const giftOpenArt = (gift: LeagueGift) => `UI/排行榜/gift_${gift}_open.png`;
const CHEST = { closed: 'UI/图标/icon_chest_closed.png', open: 'UI/图标/icon_chest_open.png' };
const TAB_ART = { on: 'UI/排行榜/tab_selected.png', off: 'UI/排行榜/tab_normal.png', onStandIn: 'UI/通用/btn_green_normal.png', offStandIn: 'UI/通用/btn_blue_normal.png' };
const number = (n: number) => n.toLocaleString('en-US');

/**
 * S26 bee league page and S27 settlement dialog (docs/v2/16 §9). Everything comes from the
 * LeaderboardService: boards are read (and the league rolled to today) on open, every second
 * only the countdown and, at a period end, the board are refreshed. Claims are saved first;
 * the gift then opens and the reward flies.
 */
export class LeaguePage {
    /** Back to the endless activity page; "去挑战" starts or resumes an endless game. */
    public onBack: (() => void) | null = null;
    public onPlay: (() => void) | null = null;
    private readonly rewards: RewardPresenter;
    private view: LayoutView | null = null;
    private board: LeagueBoard = 'daily';
    private shown: LeagueView | null = null;
    private request = 0;
    private lastSecond = -1;

    public constructor(private readonly game: Game, private readonly nav: Navigator, private readonly service: LocalLeaderboardService) {
        this.rewards = new RewardPresenter(game, nav, () => undefined, false);
    }

    public async open(board: LeagueBoard = this.board): Promise<void> {
        const request = ++this.request;
        this.board = board;
        const view = await this.nav.replacePage('S26', id => this.onAction(id));
        if (request !== this.request) return;
        this.view = view;
        await this.render();
        if (request === this.request && this.service.pendingCount) void this.showSettlements();
    }

    /** Countdown once a second; at a period end the board refreshes (and settles). */
    public update(): void {
        const v = this.view, shown = this.shown;
        if (!v?.isValid || !shown?.endsAt) return;
        const now = this.game.now(), second = Math.floor(now / 1000);
        if (second === this.lastSecond) return;
        this.lastSecond = second;
        if (now >= shown.endsAt) { void this.render(); if (this.service.pendingCount && !this.nav.dialogOpen) void this.showSettlements(); return; }
        v.setText('countdown', countdown(shown.endsAt - now));
    }

    private leave(): void { this.request++; this.view = null; this.shown = null; }

    private onAction(id: string): void {
        if (this.nav.dialogOpen) return;
        const tab = TABS.find(([key]) => key === id);
        if (tab) { if (tab[1] !== this.board) { this.board = tab[1]; void this.render(); } }
        else if (id === 'home_button') { this.leave(); this.onBack?.(); }
        else if (id === 'go_play') { this.leave(); this.onPlay?.(); }
        else if (id === 'help_button') this.help();
    }

    private async render(): Promise<void> {
        const v = this.view, request = this.request;
        if (!v?.isValid) return;
        let board: LeagueView;
        try { board = await this.service.getBoard(this.board); }
        catch (error) { this.rewards.failure(error, () => void this.render()); return; }
        if (request !== this.request || !v.isValid) return;
        this.shown = board;
        this.lastSecond = -1;
        for (const [id, key] of TABS) this.art(v, id, key === this.board ? TAB_ART.on : TAB_ART.off, key === this.board ? TAB_ART.onStandIn : TAB_ART.offStandIn);
        this.renderHeader(v, board);
        board.rows.slice(0, 3).forEach((row, i) => this.renderPodium(v, i + 1, row));
        const list = v.element('LeagueList').getComponent(VirtualList)!;
        list.setData(board.rows.slice(3).map(row => this.rowData(row)));
        this.renderMe(v, board);
        v.setText('go_play_label', this.game.state.endless.game ? '继续挑战' : '去挑战');
        this.update();
    }

    private renderHeader(v: LayoutView, board: LeagueView): void {
        const daily = board.board === 'daily', tier = tierRule(this.game.rules, board.tier), top = !tier.starsToNext;
        for (const id of ['tier_badge', 'tier_badge_text', 'tier_name', 'stars_bg', 'stars_fill_green', 'stars_text']) v.setVisible(id, daily);
        v.setVisible('board_info', !daily);
        for (const id of ['countdown_bg', 'countdown']) v.setVisible(id, board.endsAt !== null);
        if (daily) {
            v.setText('tier_badge_text', tier.tier);
            v.setText('tier_name', tier.name);
            this.art(v, 'tier_badge', `UI/排行榜/league_badge_${tier.tier}.png`, 'UI/HUD/hud_level_badge.png');
            v.setText('stars_text', top ? `第一 ×${this.game.state.league.firstPlaceCount}` : `${board.stars}/${board.starsToNext}`);
            setProgress(v.element('stars_fill_green'), top ? 1 : board.stars / board.starsToNext);
        } else {
            v.setText('board_info', board.board === 'weekly' ? '本周无尽累计分排名\n前 10 名周一结算发奖' : '无尽单局最高分排名\n长期榜，不发奖');
        }
    }

    private renderPodium(v: LayoutView, place: number, row: LeagueRow | undefined): void {
        const id = `podium_${place}`;
        for (const part of ['', '_bg', '_initial', '_name', '_score', '_rank']) v.setVisible(id + part, !!row);
        if (!row) { v.setVisible(`${id}_avatar`, false); return; }
        v.setText(`${id}_name`, row.me ? '我' : row.name);
        v.label(`${id}_name`).color = row.me ? hex('#FFE27A') : NAME_COLOR;
        v.setText(`${id}_score`, number(row.score));
        this.paintAvatar(v.element(`${id}_bg`).getComponent(Sprite), v.label(`${id}_initial`), v.element(`${id}_avatar`), row, () => v.isValid);
    }

    private renderMe(v: LayoutView, board: LeagueView): void {
        const me = board.me;
        v.setText('me_rank', board.joined ? me.rank : '-');
        v.setText('me_name', board.joined || board.board === 'allTime' ? '我' : '我 · 打一局即可参赛');
        v.setText('me_score', number(me.score));
        this.paintAvatar(v.element('me_bg').getComponent(Sprite), v.label('me_initial'), v.element('me_avatar'), me, () => v.isValid);
        const gift = v.element('me_gift');
        gift.active = board.joined && me.gift !== 'none';
        if (gift.active) this.paintGift(gift.getComponent(Sprite)!, me.gift, () => v.isValid);
    }

    private rowData(row: LeagueRow): LeagueRowData {
        return {
            rank: row.rank, name: row.me ? '我' : row.name, score: number(row.score), me: row.me,
            initial: this.initial(row), bg: row.me ? PLAYER_BG : AVATAR_BG[row.avatarBg % AVATAR_BG.length],
            paint: (item: LeagueRowItem, alive) => {
                if (item.nameLabel) item.nameLabel.color = row.me ? ME_COLOR : hex('#5B3A16');
                this.paintAvatar(item.avatarBg, item.initialLabel, item.avatarSprite?.node ?? null, row, alive);
                if (item.giftSprite && row.gift !== 'none') { item.giftSprite.node.active = true; this.paintGift(item.giftSprite, row.gift, alive); }
            },
        };
    }
    private initial(row: LeagueRow): string { return row.me ? '蜂' : animal.get(row.avatar)?.slice(-1) ?? row.name.slice(-1); }

    /** Tinted square with the animal's initial; the delivered animal picture replaces the initial. */
    private paintAvatar(bg: Sprite | null, initial: Label | null, picture: Node | null, row: LeagueRow, alive: () => boolean): void {
        if (bg) bg.color = row.me ? PLAYER_BG : AVATAR_BG[row.avatarBg % AVATAR_BG.length];
        if (initial) { initial.string = this.initial(row); initial.node.active = true; }
        if (picture) picture.active = false;
        const id = avatarArt(row.avatar);
        if (!picture || !this.nav.hasFrame(id)) return;
        this.nav.loadFrame(id).then(f => {
            if (!alive() || !picture.isValid) return;
            picture.getComponent(Sprite)!.spriteFrame = f; picture.active = true;
            if (initial?.isValid) initial.node.active = false;
        }, error => console.error(error));
    }
    private paintGift(sprite: Sprite, gift: LeagueGift, alive: () => boolean): void {
        const delivered = this.nav.hasFrame(giftArt(gift)), id = delivered || gift === 'coin' ? giftArt(gift) : CHEST.closed;
        sprite.color = delivered || gift === 'coin' ? GIFT_TINT.none : GIFT_TINT[gift];
        this.nav.loadFrame(id).then(f => { if (alive() && sprite.isValid) sprite.spriteFrame = f; }, error => console.error(error));
    }

    private help(): void {
        void this.nav.showDialog('HelpDialog', id => { if (id === 'confirm' || id === 'btn_close_dialog') this.nav.closeDialog(); }, v => {
            v.setText('title', '联赛规则');
            v.setText('help_text', HELP);
            if (v.has('help_art')) v.setVisible('help_art', false);
        });
    }

    // ---- S27 -----------------------------------------------------------------------------

    /**
     * Settlements waiting (oldest first) in one dialog: each shows its rank and prize, "领取" saves
     * the claim, then the gift opens, the reward flies and the stars / tier update; "继续" shows the
     * next one or closes. A failed save keeps the settlement for a retry.
     */
    public async showSettlements(): Promise<void> {
        let pending: readonly LeagueSettlement[];
        try { pending = [...await this.service.getPendingSettlements()]; } catch (error) { console.error(error); return; }
        if (!pending.length || this.nav.dialogOpen) return;
        let index = 0, claimed = false, busy = false;
        const total = pending.length;
        const paint = (d: LayoutView) => {
            const p = pending[index], s = this.game.state, rules = this.game.rules, prize = rankReward(s, rules, p.board, p.rank, p.tier);
            claimed = false;
            d.setText('title', BOARD_TITLE[p.board]);
            d.setText('result_rank', `第 ${p.rank} 名`);
            d.setText('result_info', `${p.board === 'daily' ? p.periodId.slice(5).replace('-', '月') + '日' : `${p.periodId.slice(5).replace('-', '月')}日起一周`} · 得分 ${number(p.score)} · 共 ${p.size} 人`);
            d.setText('reward_text', rewardText(prize.reward) || '本次没有物品奖励');
            d.setText('stars_text', prize.stars ? `联赛星 +${prize.stars}` : '');
            d.setVisible('tier_text', false);
            d.setText('claim_label', '领取');
            d.setText('page_text', total > 1 ? `${index + 1}/${total}` : '');
            const gift = d.element('gift'), sprite = gift.getComponent(Sprite)!;
            gift.active = prize.gift !== 'none';
            if (gift.active) this.paintGift(sprite, prize.gift, () => d.isValid);
        };
        const claim = async (d: LayoutView) => {
            const p = pending[index];
            busy = true;
            let result;
            try { result = await this.service.claimSettlement(p.id); }
            catch (error) { busy = false; this.nav.closeDialog(); this.rewards.failure(error, () => void this.showSettlements()); return; }
            claimed = true;
            const rules = this.game.rules, tier = tierRule(rules, result.tierAfter), gift = d.element('gift');
            if (result.gift !== 'none' && result.gift !== 'coin') {
                const open = this.nav.hasFrame(giftOpenArt(result.gift)) ? giftOpenArt(result.gift) : CHEST.open;
                this.nav.loadFrame(open).then(f => { if (gift.isValid) gift.getComponent(Sprite)!.spriteFrame = f as SpriteFrame; }, error => console.error(error));
            }
            if (p.board === 'daily') {
                d.setText('stars_text', tier.starsToNext ? `联赛星 +${result.stars} · ${tier.name} ${result.starsAfter}/${tier.starsToNext}` : `联赛星 +${result.stars} · ${tier.name}`);
                if (p.rank === 1) d.setText('result_info', `你已获得第一名 ${result.firstPlaceCount} 次！`);
            }
            if (result.tierAfter > result.tierBefore) { d.setText('tier_text', `晋升 ${tier.name}！`); d.setVisible('tier_text', true); }
            d.setText('claim_label', index + 1 < total ? '下一个' : '继续');
            const r = result.reward;
            if (result.event && r.coins + r.energy + r.hints > 0) await this.rewards.collect(r, [result.event.id], { owner: d.node, from: gift.active ? gift : d.element('reward_text') }).catch(error => console.error(error));
            else if (result.event) this.game.ackDisplay([result.event.id]);
            busy = false;
            if (this.view?.isValid) void this.render();
        };
        const onClosed = () => { if (this.view?.isValid) void this.render(); this.closed?.(); };
        await this.nav.showDialog('S27', (id, d) => {
            if (id !== 'claim' || busy) return;
            if (!claimed) { void claim(d); return; }
            if (++index < total) paint(d); else { this.nav.closeDialog(); onClosed(); }
        }, paint);
    }
    /** Told when the settlement dialog closes (the activity page repaints its entry). */
    public closed: (() => void) | null = null;

    /** Today's rank for the S19 entry / S21 line ('' before the player scored today). */
    public async todayRank(): Promise<string> {
        const board = await this.service.getBoard('daily');
        return board.joined ? `第${board.me.rank}名` : '';
    }

    private art(v: LayoutView, id: string, file: string, standIn: string): void {
        const asset = this.nav.hasFrame(file) ? file : standIn;
        this.nav.loadFrame(asset).then(f => { if (v.isValid) v.setFrame(id, f); }, error => console.error(error));
    }
}

function countdown(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400);
    const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
    return d ? `${d}天 ${hms}` : hms;
}
