export const LEVELS_PER_PAGE = 20;

export type AppRoute =
  | { name: 'home' }
  | { name: 'maps' }
  | { name: 'levels'; mapId: string; page: number }
  | { name: 'gameplay'; mapId: string; levelIndex: number };

export type LevelButtonState = 'completed' | 'available' | 'locked';

export function pageCount(levelCount: number, pageSize = LEVELS_PER_PAGE): number {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > LEVELS_PER_PAGE) throw new RangeError('Invalid level page size');
  return Math.max(1, Math.ceil(levelCount / pageSize));
}

export function clampPage(page: number, levelCount: number, pageSize = LEVELS_PER_PAGE): number {
  return Math.max(0, Math.min(pageCount(levelCount, pageSize) - 1, Math.trunc(page)));
}

export function pageLevelIndices(page: number, levelCount: number, pageSize = LEVELS_PER_PAGE): number[] {
  const start = clampPage(page, levelCount, pageSize) * pageSize;
  return Array.from({ length: Math.min(pageSize, levelCount - start) }, (_, index) => start + index);
}

export function levelButtonState(levelIndex: number, maxCompleted: number): LevelButtonState {
  if (levelIndex < maxCompleted) return 'completed';
  if (levelIndex === maxCompleted) return 'available';
  return 'locked';
}

export function nextLevelIndex(levelIndex: number, levelCount: number): number | null {
  return levelIndex + 1 < levelCount ? levelIndex + 1 : null;
}

export class PageFlow {
  private stack: AppRoute[] = [{ name: 'home' }];

  public get current(): AppRoute { return this.stack[this.stack.length - 1]; }
  public get depth(): number { return this.stack.length; }

  public push(route: AppRoute): AppRoute {
    this.stack.push(route);
    return this.current;
  }

  public replace(route: AppRoute): AppRoute {
    this.stack[this.stack.length - 1] = route;
    return this.current;
  }

  public back(): AppRoute {
    if (this.stack.length > 1) this.stack.pop();
    return this.current;
  }
}
