import type { LevelDefinition } from '../features/puzzle/data/LevelDefinition';
import { PuzzleSession } from '../features/puzzle/session/PuzzleSession';

export interface PreparedPuzzleAttempt {
    readonly session: PuzzleSession;
    /** Navigation calls this only after the fully prepared view is accepted. */
    commit(): void;
}

/** Process-local attempts. No nodes, resource scopes, storage or reward ownership. */
export class PuzzleAttemptStore {
    private readonly sessions = new Map<string, PuzzleSession>();
    private sequence = 0;
    private preparation = 0;
    private currentSession: PuzzleSession | null = null;

    public get current(): PuzzleSession | null { return this.currentSession; }
    public get(levelId: string): PuzzleSession | null { return this.sessions.get(levelId) || null; }

    public prepare(level: LevelDefinition, restart = false): PreparedPuzzleAttempt {
        const token = ++this.preparation;
        const session = !restart && this.sessions.get(level.id) || new PuzzleSession(level, `attempt-${++this.sequence}`);
        let committed = false;
        return {
            session,
            commit: () => {
                if (committed) return;
                if (token !== this.preparation) throw new Error('Cannot commit an obsolete puzzle preparation');
                committed = true;
                this.sessions.set(level.id, session);
                this.currentSession = session;
            },
        };
    }

    public clear(): void {
        this.preparation++;
        this.sessions.clear();
        this.currentSession = null;
    }
}
