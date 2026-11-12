import { DailyTaskType, reward, RuleError, Rules } from './Rules';
import { DailyTask, GameState, grantAndShow } from './State';
import { allBuildingsDone, dailyUnlocked, endlessUnlocked } from './Progress';

/** Small deterministic hash so a day always rotates to the same task. */
function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** Picks today's tasks: fixed ones plus one rotating task chosen by availability. */
export function pickDailyTasks(state: GameState, rules: Rules, day: string): DailyTask[] {
    const rows = rules.daily.tasks, fixed = rows.filter(t => t.slot === 'fixed');
    const endless = endlessUnlocked(state, rules), canBuild = !allBuildingsDone(state, rules);
    // Build needs something left to build; endless tasks need endless open. Neither => fallback task.
    const allowed = (type: DailyTaskType) => type === 'build' ? canBuild : type === 'endlessLines' || type === 'endlessScore' ? endless : true;
    let pool = rows.filter(t => t.slot === 'rotate' && allowed(t.type));
    if (!pool.length) pool = rows.filter(t => t.slot === 'fallback');
    const picked = [...fixed];
    if (pool.length && picked.length < rules.daily.count) {
        const total = pool.reduce((sum, t) => sum + t.weight, 0);
        let roll = hash(day) % Math.max(1, total);
        picked.push(pool.find(t => (roll -= t.weight) < 0) ?? pool[0]);
    }
    return picked.slice(0, rules.daily.count).map(t => ({ id: t.id, type: t.type, target: t.target, progress: 0, claimed: false }));
}

/** Resets tasks on a new local day. Unclaimed rewards of the old day expire. */
export function refreshDaily(state: GameState, rules: Rules, day: string): void {
    if (!dailyUnlocked(state) || state.daily.day === day) return;
    state.daily = { day, tasks: pickDailyTasks(state, rules, day), chestClaimed: false };
}

/** Feeds a gameplay event into today's tasks. Events before daily unlock are not counted. */
export function recordDaily(state: GameState, rules: Rules, day: string, type: DailyTaskType, amount: number): void {
    if (!dailyUnlocked(state) || amount <= 0) return;
    refreshDaily(state, rules, day);
    for (const task of state.daily.tasks) if (task.type === type) task.progress = Math.min(task.target, task.progress + amount);
}

export function claimDailyTask(state: GameState, rules: Rules, day: string, taskId: string): void {
    refreshDaily(state, rules, day);
    const task = state.daily.tasks.find(t => t.id === taskId);
    const row = rules.daily.tasks.find(t => t.id === taskId);
    if (!task || !row) throw new RuleError('invalid', `No task ${taskId} today`);
    if (task.claimed) throw new RuleError('claimed', 'Task reward already claimed');
    if (task.progress < task.target) throw new RuleError('locked', 'Task not complete');
    task.claimed = true;
    grantAndShow(state, { id: `daily:${day}:${taskId}`, type: 'dailyTask', reward: reward(rules, row.rewardId), detail: { taskId } });
}

export function claimDailyChest(state: GameState, rules: Rules, day: string): void {
    refreshDaily(state, rules, day);
    if (state.daily.chestClaimed) throw new RuleError('claimed', 'Chest already claimed');
    if (!state.daily.tasks.length || state.daily.tasks.some(t => t.progress < t.target)) throw new RuleError('locked', 'Not all tasks complete');
    state.daily.chestClaimed = true;
    grantAndShow(state, { id: `dailyChest:${day}`, type: 'dailyChest', reward: reward(rules, rules.daily.chestRewardId) });
}

/** Seven-day cumulative sign-in: one claim per local day, missed days are not lost or refilled. */
export function canSignIn(state: GameState, day: string): boolean {
    return state.guide.completed && (state.signIn.lastClaimDay === null || day > state.signIn.lastClaimDay);
}

export function signInSlot(state: GameState, rules: Rules): number { return state.signIn.claimedCount % rules.signIn.length; }

export function claimSignIn(state: GameState, rules: Rules, day: string): void {
    if (!canSignIn(state, day)) throw new RuleError('claimed', 'Already signed in today');
    const slot = signInSlot(state, rules);
    state.signIn.claimedCount += 1;
    state.signIn.lastClaimDay = day;
    grantAndShow(state, { id: `signIn:${state.signIn.claimedCount}`, type: 'signIn', reward: reward(rules, rules.signIn[slot]), detail: { day: slot + 1 } });
}
