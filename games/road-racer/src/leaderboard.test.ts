import { describe, expect, it } from 'vitest';
import {
  createLeaderboardEntry,
  insertLeaderboardEntry,
  isLeaderboardScore,
  loadLeaderboard,
  normalizeInitials,
  parseLeaderboardJson,
  saveLeaderboard,
  serializeLeaderboard,
  type JsonStorage
} from './leaderboard';

class MemoryStorage implements JsonStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('road racer leaderboard', () => {
  it('normalizes initials into three uppercase alphabet letters', () => {
    expect(normalizeInitials('a1b-cd')).toBe('ABC');
    expect(createLeaderboardEntry('xyz', 12.8, '2026-05-11T00:00:00.000Z')).toEqual({
      initials: 'XYZ',
      score: 12,
      createdAt: '2026-05-11T00:00:00.000Z'
    });
  });

  it('keeps only the best ten scores and drops the eleventh record', () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      createLeaderboardEntry('AAA', 100 - index, `2026-05-11T00:00:${index.toString().padStart(2, '0')}.000Z`)
    );
    const updated = insertLeaderboardEntry(entries, createLeaderboardEntry('ZZZ', 95, '2026-05-11T00:01:00.000Z'));

    expect(updated).toHaveLength(10);
    expect(updated.map((entry) => entry.score)).toEqual([100, 99, 98, 97, 96, 95, 95, 94, 93, 92]);
    expect(updated.at(-1)?.score).toBe(92);
  });

  it('decides whether a score can enter the top ten', () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      createLeaderboardEntry('AAA', 100 - index, `2026-05-11T00:00:${index.toString().padStart(2, '0')}.000Z`)
    );

    expect(isLeaderboardScore(entries, 91)).toBe(true);
    expect(isLeaderboardScore(entries, 90)).toBe(false);
    expect(isLeaderboardScore([], 1)).toBe(true);
    expect(isLeaderboardScore([], 0)).toBe(false);
  });

  it('loads and saves leaderboard data as JSON', () => {
    const storage = new MemoryStorage();
    const entries = [
      createLeaderboardEntry('BBB', 80, '2026-05-11T00:00:00.000Z'),
      createLeaderboardEntry('AAA', 120, '2026-05-11T00:00:01.000Z')
    ];

    saveLeaderboard(storage, entries);

    expect(loadLeaderboard(storage).map((entry) => entry.initials)).toEqual(['AAA', 'BBB']);
    expect(parseLeaderboardJson('not-json')).toEqual([]);
    expect(parseLeaderboardJson(serializeLeaderboard(entries))).toHaveLength(2);
  });
});
