import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  createEmptyHubProgress,
  getGameProgress,
  HUB_PROGRESS_STORAGE_KEY,
  readHubProgress,
  recordGameEnd,
  recordGameStart,
  resetHubProgress,
  summarizeHubProgress,
  writeHubProgress,
  type StorageLike,
} from './local-progress';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('local progress', () => {
  it('records game starts without touching other game state', () => {
    const progress = recordGameStart(createEmptyHubProgress(), 'road-racer', '2026-05-12T10:00:00.000Z');

    expect(getGameProgress(progress, 'road-racer')).toMatchObject({
      plays: 1,
      finishes: 0,
      lastPlayedAt: '2026-05-12T10:00:00.000Z',
    });
    expect(getGameProgress(progress, '2048').plays).toBe(0);
    expect(progress.unlockedAchievementIds).toContain('first-run');
  });

  it('records scores, durations, finishes, and best score', () => {
    const started = recordGameStart(createEmptyHubProgress(), '2048');
    const firstEnd = recordGameEnd(started, '2048', { score: 512, durationMs: 20_000 });
    const secondEnd = recordGameEnd(firstEnd, '2048', { score: 128, durationMs: 10_000 });

    expect(getGameProgress(secondEnd, '2048')).toMatchObject({
      plays: 1,
      finishes: 2,
      bestScore: 512,
      totalScore: 640,
      totalPlayTimeMs: 30_000,
    });
  });

  it('does not count an interrupted session as a finish', () => {
    const progress = recordGameEnd(createEmptyHubProgress(), 'snake', {
      durationMs: 5_000,
      completed: false,
    });

    expect(getGameProgress(progress, 'snake')).toMatchObject({
      finishes: 0,
      totalPlayTimeMs: 5_000,
    });
  });

  it('summarizes hub totals and unlocks achievement milestones', () => {
    let progress = createEmptyHubProgress();
    progress = recordGameStart(progress, 'road-racer');
    progress = recordGameStart(progress, '2048');
    progress = recordGameStart(progress, 'snake');
    progress = recordGameEnd(progress, 'snake', { score: 1200, durationMs: 300_000 });

    const summary = summarizeHubProgress(progress);

    expect(summary.totalPlays).toBe(3);
    expect(summary.playedGameCount).toBe(3);
    expect(summary.totalBestScore).toBe(1200);
    expect(summary.unlockedAchievementCount).toBeGreaterThanOrEqual(5);
    expect(progress.unlockedAchievementIds).toEqual(
      expect.arrayContaining(['first-run', 'three-games', 'first-score', 'score-1000', 'five-minutes']),
    );
    expect(summary.achievementCount).toBe(ACHIEVEMENTS.length);
  });

  it('persists, reads, and resets local storage progress', () => {
    const storage = new MemoryStorage();
    const progress = recordGameStart(createEmptyHubProgress(), 'color-match');

    writeHubProgress(storage, progress);
    expect(readHubProgress(storage)).toEqual(progress);

    resetHubProgress(storage);
    expect(storage.getItem(HUB_PROGRESS_STORAGE_KEY)).toBeNull();
    expect(readHubProgress(storage)).toEqual(createEmptyHubProgress());
  });

  it('falls back to empty progress when storage is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem(HUB_PROGRESS_STORAGE_KEY, '{broken');

    expect(readHubProgress(storage)).toEqual(createEmptyHubProgress());
  });
});
