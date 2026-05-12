export const HUB_PROGRESS_STORAGE_KEY = 'minigame:hub:progress:v1';
export const HUB_PROGRESS_VERSION = 1 as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface GameProgress {
  slug: string;
  plays: number;
  finishes: number;
  bestScore: number;
  totalScore: number;
  totalPlayTimeMs: number;
  lastPlayedAt: string | null;
}

export interface HubProgress {
  version: typeof HUB_PROGRESS_VERSION;
  games: Record<string, GameProgress>;
  unlockedAchievementIds: string[];
}

export interface RecordGameEndOptions {
  score?: number;
  durationMs?: number;
  completed?: boolean;
}

export interface HubProgressSummary {
  totalPlays: number;
  totalFinishes: number;
  totalBestScore: number;
  totalScore: number;
  totalPlayTimeMs: number;
  playedGameCount: number;
  unlockedAchievementCount: number;
  achievementCount: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  isUnlocked(progress: HubProgress): boolean;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first-run',
    title: '첫 실행',
    description: '허브에서 아무 게임이나 1회 실행',
    isUnlocked: (progress) => summarizeHubProgress(progress).totalPlays >= 1,
  },
  {
    id: 'three-games',
    title: '탐험가',
    description: '서로 다른 게임 3개 실행',
    isUnlocked: (progress) => summarizeHubProgress(progress).playedGameCount >= 3,
  },
  {
    id: 'ten-plays',
    title: '워밍업 완료',
    description: '누적 실행 10회 달성',
    isUnlocked: (progress) => summarizeHubProgress(progress).totalPlays >= 10,
  },
  {
    id: 'first-score',
    title: '기록 등록',
    description: '점수가 있는 게임 결과 1회 저장',
    isUnlocked: (progress) => Object.values(progress.games).some((game) => game.totalScore > 0),
  },
  {
    id: 'score-1000',
    title: '천점 돌파',
    description: '한 게임에서 최고 점수 1000점 이상 달성',
    isUnlocked: (progress) => Object.values(progress.games).some((game) => game.bestScore >= 1000),
  },
  {
    id: 'five-minutes',
    title: '로컬 단련',
    description: '누적 플레이 시간 5분 달성',
    isUnlocked: (progress) => summarizeHubProgress(progress).totalPlayTimeMs >= 300_000,
  },
];

export function createEmptyHubProgress(): HubProgress {
  return {
    version: HUB_PROGRESS_VERSION,
    games: {},
    unlockedAchievementIds: [],
  };
}

export function createEmptyGameProgress(slug: string): GameProgress {
  return {
    slug,
    plays: 0,
    finishes: 0,
    bestScore: 0,
    totalScore: 0,
    totalPlayTimeMs: 0,
    lastPlayedAt: null,
  };
}

export function getGameProgress(progress: HubProgress, slug: string): GameProgress {
  return progress.games[slug] ?? createEmptyGameProgress(slug);
}

export function recordGameStart(
  progress: HubProgress,
  slug: string,
  playedAt = new Date().toISOString(),
): HubProgress {
  const current = getGameProgress(progress, slug);
  const nextGame: GameProgress = {
    ...current,
    plays: current.plays + 1,
    lastPlayedAt: playedAt,
  };

  return refreshAchievementUnlocks({
    ...progress,
    games: {
      ...progress.games,
      [slug]: nextGame,
    },
  });
}

export function recordGameEnd(progress: HubProgress, slug: string, options: RecordGameEndOptions = {}): HubProgress {
  const current = getGameProgress(progress, slug);
  const score = normalizeScore(options.score);
  const durationMs = normalizeDuration(options.durationMs);
  const nextGame: GameProgress = {
    ...current,
    finishes: options.completed === false ? current.finishes : current.finishes + 1,
    bestScore: Math.max(current.bestScore, score),
    totalScore: current.totalScore + score,
    totalPlayTimeMs: current.totalPlayTimeMs + durationMs,
  };

  return refreshAchievementUnlocks({
    ...progress,
    games: {
      ...progress.games,
      [slug]: nextGame,
    },
  });
}

export function summarizeHubProgress(progress: HubProgress): HubProgressSummary {
  const games = Object.values(progress.games);

  return {
    totalPlays: games.reduce((sum, game) => sum + game.plays, 0),
    totalFinishes: games.reduce((sum, game) => sum + game.finishes, 0),
    totalBestScore: games.reduce((best, game) => Math.max(best, game.bestScore), 0),
    totalScore: games.reduce((sum, game) => sum + game.totalScore, 0),
    totalPlayTimeMs: games.reduce((sum, game) => sum + game.totalPlayTimeMs, 0),
    playedGameCount: games.filter((game) => game.plays > 0).length,
    unlockedAchievementCount: progress.unlockedAchievementIds.length,
    achievementCount: ACHIEVEMENTS.length,
  };
}

export function refreshAchievementUnlocks(progress: HubProgress): HubProgress {
  const unlocked = new Set(progress.unlockedAchievementIds);

  for (const achievement of ACHIEVEMENTS) {
    if (achievement.isUnlocked(progress)) {
      unlocked.add(achievement.id);
    }
  }

  const unlockedAchievementIds = ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id)).map(
    (achievement) => achievement.id,
  );

  return {
    ...progress,
    unlockedAchievementIds,
  };
}

export function readHubProgress(storage: StorageLike): HubProgress {
  const raw = storage.getItem(HUB_PROGRESS_STORAGE_KEY);

  if (!raw) {
    return createEmptyHubProgress();
  }

  try {
    return refreshAchievementUnlocks(normalizeHubProgress(JSON.parse(raw)));
  } catch {
    return createEmptyHubProgress();
  }
}

export function writeHubProgress(storage: StorageLike, progress: HubProgress): HubProgress {
  const nextProgress = refreshAchievementUnlocks(progress);
  storage.setItem(HUB_PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
  return nextProgress;
}

export function resetHubProgress(storage: StorageLike): HubProgress {
  const nextProgress = createEmptyHubProgress();

  if (storage.removeItem) {
    storage.removeItem(HUB_PROGRESS_STORAGE_KEY);
  } else {
    storage.setItem(HUB_PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
  }

  return nextProgress;
}

function normalizeHubProgress(value: unknown): HubProgress {
  if (!isRecord(value) || value.version !== HUB_PROGRESS_VERSION || !isRecord(value.games)) {
    return createEmptyHubProgress();
  }

  const games = Object.entries(value.games).reduce<Record<string, GameProgress>>((acc, [slug, game]) => {
    if (!isRecord(game)) {
      return acc;
    }

    acc[slug] = {
      slug,
      plays: normalizeCount(game.plays),
      finishes: normalizeCount(game.finishes),
      bestScore: normalizeScore(game.bestScore),
      totalScore: normalizeScore(game.totalScore),
      totalPlayTimeMs: normalizeDuration(game.totalPlayTimeMs),
      lastPlayedAt: typeof game.lastPlayedAt === 'string' ? game.lastPlayedAt : null,
    };

    return acc;
  }, {});

  const knownAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
  const unlockedAchievementIds = Array.isArray(value.unlockedAchievementIds)
    ? value.unlockedAchievementIds.filter((id): id is string => typeof id === 'string' && knownAchievementIds.has(id))
    : [];

  return {
    version: HUB_PROGRESS_VERSION,
    games,
    unlockedAchievementIds,
  };
}

function normalizeCount(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function normalizeScore(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function normalizeDuration(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
