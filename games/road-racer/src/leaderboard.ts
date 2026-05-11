export const leaderboardLimit = 10;
export const leaderboardStorageKey = 'road-racer:leaderboard-json';

export interface LeaderboardEntry {
  initials: string;
  score: number;
  createdAt: string;
}

export interface JsonStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeInitials(value: string): string {
  return value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3);
}

export function isValidInitials(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function createLeaderboardEntry(
  initials: string,
  score: number,
  createdAt = new Date().toISOString()
): LeaderboardEntry {
  const normalizedInitials = normalizeInitials(initials);

  if (!isValidInitials(normalizedInitials)) {
    throw new Error('Leaderboard initials must be exactly three uppercase letters.');
  }

  return {
    initials: normalizedInitials,
    score: Math.max(0, Math.floor(score)),
    createdAt
  };
}

export function isLeaderboardScore(entries: LeaderboardEntry[], score: number): boolean {
  const normalizedEntries = sortLeaderboard(entries);
  const normalizedScore = Math.max(0, Math.floor(score));

  if (normalizedScore <= 0) {
    return false;
  }

  return (
    normalizedEntries.length < leaderboardLimit ||
    normalizedScore >= (normalizedEntries[leaderboardLimit - 1]?.score ?? 0)
  );
}

export function insertLeaderboardEntry(
  entries: LeaderboardEntry[],
  entry: LeaderboardEntry
): LeaderboardEntry[] {
  return sortLeaderboard([...entries, entry]).slice(0, leaderboardLimit);
}

export function serializeLeaderboard(entries: LeaderboardEntry[]): string {
  return JSON.stringify(sortLeaderboard(entries).slice(0, leaderboardLimit));
}

export function parseLeaderboardJson(value: string | null): LeaderboardEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortLeaderboard(
      parsed.flatMap((entry): LeaderboardEntry[] => {
        if (!isLeaderboardEntryDraft(entry)) {
          return [];
        }

        return [
          {
            initials: entry.initials,
            score: Math.max(0, Math.floor(entry.score)),
            createdAt: entry.createdAt
          }
        ];
      })
    ).slice(0, leaderboardLimit);
  } catch {
    return [];
  }
}

export function loadLeaderboard(storage: JsonStorage): LeaderboardEntry[] {
  return parseLeaderboardJson(storage.getItem(leaderboardStorageKey));
}

export function saveLeaderboard(storage: JsonStorage, entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const normalizedEntries = sortLeaderboard(entries).slice(0, leaderboardLimit);

  storage.setItem(leaderboardStorageKey, serializeLeaderboard(normalizedEntries));

  return normalizedEntries;
}

function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => right.entry.score - left.entry.score || left.index - right.index)
    .map(({ entry }) => entry);
}

function isLeaderboardEntryDraft(value: unknown): value is LeaderboardEntry {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const draft = value as Partial<LeaderboardEntry>;

  return (
    typeof draft.initials === 'string' &&
    isValidInitials(draft.initials) &&
    typeof draft.score === 'number' &&
    Number.isFinite(draft.score) &&
    typeof draft.createdAt === 'string' &&
    draft.createdAt.trim().length > 0
  );
}
