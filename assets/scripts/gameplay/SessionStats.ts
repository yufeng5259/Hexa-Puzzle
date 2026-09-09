export type DropOutcome = 'correct' | 'wrong-valid' | 'invalid-return' | 'cancelled' | 'same-position' | 'tray-return';

export interface SessionStatsSnapshot {
  moves: number;
  errors: number;
  hintsUsed: number;
  completed: boolean;
  committed: boolean;
}

export class SessionStats {
  private movesValue = 0;
  private errorsValue = 0;
  private hintsUsedValue = 0;
  private completedValue = false;
  private committedValue = false;

  public recordDrop(outcome: DropOutcome): SessionStatsSnapshot {
    if (this.completedValue || this.committedValue) return this.snapshot();
    if (outcome === 'invalid-return') this.errorsValue += 1;
    if (outcome === 'correct' || outcome === 'wrong-valid' || outcome === 'tray-return') this.movesValue += 1;
    return this.snapshot();
  }

  public recordHintUse(): SessionStatsSnapshot {
    if (this.completedValue || this.committedValue) return this.snapshot();
    this.hintsUsedValue += 1;
    return this.snapshot();
  }

  public markCompleted(): SessionStatsSnapshot {
    if (!this.committedValue) this.completedValue = true;
    return this.snapshot();
  }

  public markCommitted(): SessionStatsSnapshot {
    this.completedValue = true;
    this.committedValue = true;
    return this.snapshot();
  }

  public reset(): SessionStatsSnapshot {
    if (this.committedValue) return this.snapshot();
    this.movesValue = 0;
    this.errorsValue = 0;
    this.hintsUsedValue = 0;
    this.completedValue = false;
    return this.snapshot();
  }

  public snapshot(): SessionStatsSnapshot {
    return {
      moves: this.movesValue,
      errors: this.errorsValue,
      hintsUsed: this.hintsUsedValue,
      completed: this.completedValue,
      committed: this.committedValue,
    };
  }

  public restore(snapshot: SessionStatsSnapshot): void {
    if ([snapshot.moves, snapshot.errors, snapshot.hintsUsed].some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid session counters');
    this.movesValue = snapshot.moves;
    this.errorsValue = snapshot.errors;
    this.hintsUsedValue = snapshot.hintsUsed;
    this.completedValue = snapshot.completed;
    this.committedValue = snapshot.committed;
  }
}
