import type { Reward } from './Rules';
import type { DisplayEvent } from './State';

/** Rewards shown (and confirmed) by the page where they are claimed or won, not by the home queue. */
export const OWN_PAGE: ReadonlySet<DisplayEvent['type']> = new Set<DisplayEvent['type']>(['firstClear', 'replay', 'signIn', 'dailyTask', 'dailyChest', 'endlessStage', 'welcome']);

/**
 * What the home queue shows next, in queue order. 'recover': page rewards left over from an
 * earlier run (the app closed before their page confirmed them) get one short summary, all at
 * once. 'show': a home reward; consecutive level ups merge into one. Page rewards of this run
 * belong to their page and are skipped. Nothing is removed here; the caller confirms by id.
 */
export function nextDisplay(queue: readonly DisplayEvent[], fromEarlierRun: (id: string) => boolean): { kind: 'recover' | 'show'; events: DisplayEvent[] } | null {
    const leftover = (e: DisplayEvent) => OWN_PAGE.has(e.type) && fromEarlierRun(e.id);
    const i = queue.findIndex(e => !OWN_PAGE.has(e.type) || leftover(e));
    if (i < 0) return null;
    const first = queue[i];
    if (OWN_PAGE.has(first.type)) return { kind: 'recover', events: queue.filter(leftover) };
    if (first.type !== 'levelUp') return { kind: 'show', events: [first] };
    const run: DisplayEvent[] = [];
    for (const e of queue.slice(i)) {
        if (e.type === 'levelUp') run.push(e);
        else if (!OWN_PAGE.has(e.type)) break;
    }
    return { kind: 'show', events: run };
}

export function sumRewards(events: readonly { readonly reward: Reward }[]): Reward {
    return events.reduce((sum, e) => ({ coins: sum.coins + e.reward.coins, energy: sum.energy + e.reward.energy, hints: sum.hints + e.reward.hints }), { coins: 0, energy: 0, hints: 0 });
}

export function rewardText(r: Reward): string {
    return [r.coins && `金币+${r.coins}`, r.energy && `体力+${r.energy}`, r.hints && `提示+${r.hints}`].filter(Boolean).join(' ');
}

/** What S06 says about a win. A repeated outcome (duplicate) paid nothing now: no card, just that it was paid before. */
export interface WinCopy { readonly line: string; readonly coins: number; readonly status: string | null; readonly card: boolean }
export function winCopy(kind: 'firstClear' | 'replay' | 'duplicate', levelNo: number, challenge: boolean, prize: Reward | null): WinCopy {
    if (kind === 'duplicate') return { line: `第${levelNo}关 · 已完成`, coins: 0, status: '本关奖励已发放', card: false };
    const what = kind === 'replay' ? '复玩完成' : challenge ? '挑战首次通关' : '首次通关';
    const coins = prize?.coins ?? 0, text = prize ? rewardText(prize) : '';
    const status = !text ? null : coins && !prize!.energy && !prize!.hints ? '金币已到账' : `${text} 已到账`;
    return { line: `第${levelNo}关 · ${what}`, coins, status, card: !!status };
}
