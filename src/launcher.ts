export type MiniGameCommand = 'start' | 'pause' | 'gameOver';
export type GameStatus = 'playable' | 'needs-server';

export interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: MiniGameCommand;
  readonly gameSlug: string;
}

export interface MiniGameRuntime {
  start(game: GameEntry): void;
  pause(): void;
  gameOver(): void;
}

export interface GameEntry {
  readonly slug: string;
  readonly title: string;
  readonly genre: string;
  readonly description: string;
  readonly controls: readonly string[];
  readonly accent: string;
  readonly status: GameStatus;
}

export const GAMES: readonly GameEntry[] = [
  {
    slug: 'quoridor',
    title: 'Quoridor',
    genre: 'Strategy Board',
    description: '벽을 세우고 말의 경로를 관리하는 2인 전략 보드게임',
    controls: ['Mouse'],
    accent: '#f3b95f',
    status: 'needs-server',
  },
  {
    slug: 'road-racer',
    title: 'Road Racer',
    genre: 'Lane Racing',
    description: '차선을 바꾸며 마주 오는 차와 장애물을 피하는 레이싱 게임',
    controls: ['Arrow Left', 'Arrow Right'],
    accent: '#45d6ff',
    status: 'playable',
  },
  {
    slug: 'brick-breaker',
    title: 'Brick Breaker',
    genre: 'Arcade Action',
    description: '랜덤 맵의 벽돌을 공과 패들로 깨는 neon boardgame 게임',
    controls: ['Mouse', 'Touch', 'Enter'],
    accent: '#ff4f86',
    status: 'playable',
  },
  {
    slug: 'color-match',
    title: 'Color Match',
    genre: 'Reaction',
    description: '중앙 캐릭터 색상과 규칙에 맞는 방향키를 빠르게 누르는 순발력 게임',
    controls: ['Arrow Up', 'Arrow Right', 'Arrow Down', 'Arrow Left'],
    accent: '#58f08b',
    status: 'playable',
  },
] as const;

export const DEFAULT_GAME = getDefaultGame();

export function createGameUrl(slug: string): string {
  return `/games/${encodeURIComponent(slug)}/index.html`;
}

export function createLifecycleMessage(
  command: MiniGameCommand,
  gameSlug: string,
): MiniGameLifecycleMessage {
  return {
    source: 'minigame-hub',
    command,
    gameSlug,
  };
}

export function findGameBySlug(slug: string): GameEntry {
  const game = GAMES.find((entry) => entry.slug === slug);

  if (!game) {
    return DEFAULT_GAME;
  }

  return game;
}

export function hasDuplicateSlugs(games: readonly GameEntry[] = GAMES): boolean {
  const slugs = new Set<string>();

  for (const game of games) {
    if (slugs.has(game.slug)) {
      return true;
    }

    slugs.add(game.slug);
  }

  return false;
}

function getDefaultGame(): GameEntry {
  const game = GAMES[0];

  if (!game) {
    throw new Error('Game registry must contain at least one game.');
  }

  return game;
}
