import { EconomyConfig } from '../config/EconomyConfig';
import { SaveData } from '../save/SaveData';
import { SaveService } from '../save/SaveService';
import type { Activity } from './Activity';
import { weekKey } from './Clock';
import { addHints, addHoney } from './Wallet';

export type TaskKind = 'play' | 'build' | 'featured' | 'endless' | 'level';
export interface TaskRule { target: number; honey: number; titleKey: string; }
export interface SigninRule { honey: number; hints?: number; outfit?: string; }
export interface AchievementRule { id: string; kind: 'levels' | 'endlessBest' | 'chapter'; target: number; }
export interface MailRule { id: string; titleKey: string; detailTitleKey: string; bodyKeys: string[]; signatureKey: string; }

/** Shape of bundles/common/config/daily.json. */
export interface DailyRules {
    tasks: Record<TaskKind, TaskRule>;
    weekly: { games: number; activeDays: number; honey: number };
    signin: SigninRule[];
    achievements: AchievementRule[];
    picnic: { openChapter: number; perGame: number; target: number; honey: number; marks: number[] };
    mails: MailRule[];
    supply: { freeHints: number };
}

/**
 * Daily systems state (F041–F045, F050, F057): tasks, weekly goal, seven-day sign-in, achievements,
 * picnic event, mailbox.
 */
export interface DailyState {
    /** Business day of `counts` and `variants`. */
    day: string;
    /** Raw activity counts of the day by task kind (targets applied when read). */
    counts: Record<TaskKind, number>;
    /** Task kinds locked for `day` by startDay; empty until then. */
    variants: TaskKind[];
    /** Week (Monday dayKey) of the weekly counters; a new week discards the old one, claimed or not (D06). */
    week: string;
    weekGames: number;
    /** Days of `week` with at least one valid game. */
    activeDays: string[];
    /** Weeks whose stamp was claimed. */
    stamps: string[];
    /** Login days counted toward the seven-day gift (D05: cumulative, one per new business day, max 7). */
    signinDays: number;
    lastLoginDay: string;
    /** Lifetime valid games by the garden chapter they were played in (picnic counts chapters ≥ openChapter, F045). */
    validByChapter: number[];
    /** Outfit ids granted by daily rewards (day-7 picnic hat); the collection module reads this. */
    outfits: string[];
    mailRead: string[];
}

export function newDailyState(): DailyState {
    return { day: '', counts: { play: 0, build: 0, featured: 0, endless: 0, level: 0 }, variants: [], week: '', weekGames: 0, activeDays: [], stamps: [], signinDays: 0, lastLoginDay: '', validByChapter: [], outfits: [], mailRead: [] };
}

let rules: DailyRules;
let economy: EconomyConfig;

/** Called once after both config files are loaded (and by tests). */
export function configureDaily(daily: DailyRules, econ: EconomyConfig): void {
    rules = daily;
    economy = econ;
}

export function dailyRules(): DailyRules {
    return rules;
}

const parseDay = (day: string): Date => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d);
};
export const weekOf = (day: string): string => weekKey(parseDay(day));

function endlessUnlocked(save: Readonly<SaveData>): boolean {
    return save.mainline.cleared.indexOf(economy.mainline.endlessUnlockLevel) >= 0;
}

function journeyComplete(save: Readonly<SaveData>): boolean {
    const g = economy.garden;
    return save.garden.chapter >= g.themes.length - 1 && save.garden.buildings.every(level => level >= g.maxLevel);
}

/** The three tasks of a day: play, build (or featured once the journey is complete), endless (or one more level before it unlocks). */
export function taskKinds(save: Readonly<SaveData>): TaskKind[] {
    return ['play', journeyComplete(save) ? 'featured' : 'build', endlessUnlocked(save) ? 'endless' : 'level'];
}

/** Today's three tasks with capped progress; variants are the locked ones, or the current ones before startDay. */
export function tasksOf(save: Readonly<SaveData>, today: string): { kind: TaskKind; progress: number }[] {
    const d = save.daily;
    const current = d.day === today;
    const kinds = current && d.variants.length ? d.variants : taskKinds(save);
    return kinds.map(kind => ({ kind, progress: Math.min(rules.tasks[kind].target, current ? d.counts[kind] : 0) }));
}

function rollDay(draft: SaveData, today: string): void {
    if (draft.daily.day === today) return;
    draft.daily.day = today;
    draft.daily.counts = { play: 0, build: 0, featured: 0, endless: 0, level: 0 };
    draft.daily.variants = [];
}

function rollWeek(draft: SaveData, today: string): void {
    const week = weekOf(today);
    if (draft.daily.week === week) return;
    draft.daily.week = week;
    draft.daily.weekGames = 0;
    draft.daily.activeDays = [];
}

/** Day start (launch, or opening a daily page): counts today as a login day and locks today's task variants. */
export function startDay(draft: SaveData, today: string): void {
    rollDay(draft, today);
    if (!draft.daily.variants.length) draft.daily.variants = taskKinds(draft);
    recordLogin(draft, today);
}

export function picnicOpen(save: Readonly<SaveData>): boolean {
    return save.garden.chapter >= rules.picnic.openChapter;
}

export function picnicPoints(save: Readonly<SaveData>): number {
    const games = save.daily.validByChapter.reduce((sum, n, chapter) => sum + (chapter >= rules.picnic.openChapter ? n : 0), 0);
    return Math.min(rules.picnic.target, games * rules.picnic.perGame);
}

/** Record raw counts only, so recording never depends on loaded config. */
export function applyDailyActivity(draft: SaveData, activity: Activity, today: string): void {
    rollDay(draft, today);
    rollWeek(draft, today);
    const d = draft.daily;
    const valid = activity.kind === 'puzzleWin' || (activity.kind === 'endlessRun' && activity.valid);
    if (valid) {
        d.counts.play++;
        d.weekGames++;
        if (d.activeDays.indexOf(today) < 0) d.activeDays.push(today);
        const c = draft.garden.chapter;
        while (d.validByChapter.length <= c) d.validByChapter.push(0);
        d.validByChapter[c]++;
    }
    if (activity.kind === 'puzzleWin') {
        d.counts.level++;
        if (!activity.firstClear) d.counts.featured++;
    }
    if (activity.kind === 'build') d.counts.build++;
    if (activity.kind === 'endlessPlace') d.counts.endless++;
}

// ---------- tasks (F041) ----------

export const taskClaimKey = (today: string, index: number, kind: TaskKind): string => `daily:${today}:${index}:${kind}`;

export function taskClaimed(save: Readonly<SaveData>, today: string, index: number): boolean {
    const task = tasksOf(save, today)[index];
    return save.claims[taskClaimKey(today, index, task.kind)] !== undefined;
}

export function taskDone(save: Readonly<SaveData>, today: string, index: number): boolean {
    const task = tasksOf(save, today)[index];
    return task.progress >= rules.tasks[task.kind].target;
}

export function claimTask(save: SaveService, today: string, index: number): number {
    if (save.data.daily.day !== today || !save.data.daily.variants.length || !taskDone(save.data, today, index)) throw new Error('Task not complete');
    const kind = save.data.daily.variants[index];
    return save.claim(taskClaimKey(today, index, kind), draft => {
        addHoney(draft, rules.tasks[kind].honey);
        return rules.tasks[kind].honey;
    });
}

// ---------- weekly (F042) ----------

export function weeklyProgress(save: Readonly<SaveData>, today: string): { games: number; activeDays: number } {
    const current = save.daily.week === weekOf(today);
    return { games: current ? save.daily.weekGames : 0, activeDays: current ? save.daily.activeDays.length : 0 };
}

export function weeklyDone(save: Readonly<SaveData>, today: string): boolean {
    const p = weeklyProgress(save, today);
    return p.games >= rules.weekly.games && p.activeDays >= rules.weekly.activeDays;
}

export function weeklyClaimed(save: Readonly<SaveData>, today: string): boolean {
    return save.claims['weekly:' + weekOf(today)] !== undefined;
}

export function claimWeekly(save: SaveService, today: string): void {
    if (!weeklyDone(save.data, today)) throw new Error('Weekly goal not reached');
    const week = weekOf(today);
    save.claim('weekly:' + week, draft => {
        addHoney(draft, rules.weekly.honey);
        draft.daily.stamps.push(week);
        return { honey: rules.weekly.honey, stamp: week };
    });
}

// ---------- seven-day sign-in (F043) ----------

/** Login days including today, without mutating (today counts as soon as the game is opened). */
export function signinDays(save: Readonly<SaveData>, today: string): number {
    const d = save.daily;
    return d.lastLoginDay !== today && today > d.lastLoginDay ? Math.min(rules.signin.length, d.signinDays + 1) : d.signinDays;
}

/** Count today as a login day (D05); idempotent within a day. */
export function recordLogin(draft: SaveData, today: string): void {
    draft.daily.signinDays = signinDays(draft, today);
    if (today > draft.daily.lastLoginDay) draft.daily.lastLoginDay = today;
}

export function signinClaimedCount(save: Readonly<SaveData>): number {
    let n = 0;
    while (n < rules.signin.length && save.claims['signin:' + (n + 1)] !== undefined) n++;
    return n;
}

/** Claim the next unclaimed day in order (missed days stay claimable). Returns the day number. */
export function claimSignin(save: SaveService, today: string): number {
    const day = signinClaimedCount(save.data) + 1;
    if (day > save.data.daily.signinDays || save.data.daily.lastLoginDay !== today) throw new Error('No sign-in gift to claim');
    const rule = rules.signin[day - 1];
    save.claim('signin:' + day, draft => {
        addHoney(draft, rule.honey);
        if (rule.hints) addHints(draft, rule.hints);
        if (rule.outfit && draft.daily.outfits.indexOf(rule.outfit) < 0) draft.daily.outfits.push(rule.outfit);
        return rule;
    });
    return day;
}

// ---------- achievements (F044) ----------

export function achievementProgress(save: Readonly<SaveData>, rule: AchievementRule): number {
    if (rule.kind === 'levels') return save.mainline.cleared.length;
    if (rule.kind === 'endlessBest') return save.endless.best;
    return save.garden.chapter;
}

export function achievementCollected(save: Readonly<SaveData>, id: string): boolean {
    return save.claims['achievement:' + id] !== undefined;
}

/** Badges only, no currency. */
export function collectAchievement(save: SaveService, id: string): void {
    const rule = rules.achievements.find(a => a.id === id)!;
    if (achievementProgress(save.data, rule) < rule.target) throw new Error('Achievement not reached');
    save.claim('achievement:' + id, () => ({ id }));
}

// ---------- picnic (F045) ----------

export function picnicClaimed(save: Readonly<SaveData>): boolean {
    return save.claims['event:picnic'] !== undefined;
}

export function claimPicnic(save: SaveService): void {
    if (!picnicOpen(save.data) || picnicPoints(save.data) < rules.picnic.target) throw new Error('Picnic not ready');
    save.claim('event:picnic', draft => {
        addHoney(draft, rules.picnic.honey);
        return { honey: rules.picnic.honey };
    });
}

// ---------- mailbox (F050) ----------

export function markMailRead(draft: SaveData, id: string): void {
    if (draft.daily.mailRead.indexOf(id) < 0) draft.daily.mailRead.push(id);
}

// ---------- map red dots ----------

export type DailyEntry = 'signin' | 'tasks' | 'event' | 'achievement' | 'mail' | 'supply';

export function dailyRedDots(save: Readonly<SaveData>, today: string): Record<DailyEntry, boolean> {
    const tasks = tasksOf(save, today);
    return {
        signin: signinClaimedCount(save) < signinDays(save, today),
        tasks: tasks.some((t, i) => t.progress >= rules.tasks[t.kind].target && save.claims[taskClaimKey(today, i, t.kind)] === undefined)
            || (weeklyDone(save, today) && !weeklyClaimed(save, today)),
        event: picnicOpen(save) && picnicPoints(save) >= rules.picnic.target && !picnicClaimed(save),
        achievement: rules.achievements.some(a => achievementProgress(save, a) >= a.target && !achievementCollected(save, a.id)),
        mail: rules.mails.some(m => save.daily.mailRead.indexOf(m.id) < 0),
        supply: save.claims['freehint:' + today] === undefined,
    };
}
