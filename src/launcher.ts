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
  {
    slug: '2048',
    title: '2048',
    genre: 'Number Puzzle',
    description: '같은 숫자 타일을 합쳐 2048 타일을 만드는 퍼즐 게임',
    controls: ['Arrow Keys', 'Swipe'],
    accent: '#edc22e',
    status: 'playable',
  },
  {
    slug: 'minesweeper',
    title: 'Minesweeper',
    genre: 'Logic Puzzle',
    description: '지뢰 위치를 추론하며 모든 안전 칸을 여는 클래식 퍼즐 게임',
    controls: ['Click', 'Right Click', 'Long Press'],
    accent: '#5ce6b8',
    status: 'playable',
  },
  {
    slug: 'sudoku',
    title: 'Sudoku',
    genre: 'Logic Puzzle',
    description: 'Easy, Normal, Hard 난이도에서 유일해 스도쿠 퍼즐을 푸는 숫자 논리 게임',
    controls: ['Click', 'Number Keys', 'Arrow Keys', 'H'],
    accent: '#a7f3d0',
    status: 'playable',
  },
  {
    slug: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    genre: 'Logic Puzzle',
    description: '빈 칸을 움직여 숫자 타일을 순서대로 맞추는 solvable 슬라이딩 퍼즐',
    controls: ['Click', 'Arrow Keys', 'WASD', 'N'],
    accent: '#7dd3fc',
    status: 'playable',
  },
  {
    slug: 'lights-out',
    title: 'Lights Out',
    genre: 'Logic Puzzle',
    description: '자기 칸과 상하좌우 불을 토글해 모든 불을 끄는 격자 퍼즐',
    controls: ['Click', 'Arrow Keys', 'WASD', 'Space'],
    accent: '#facc15',
    status: 'playable',
  },
  {
    slug: 'tower-of-hanoi',
    title: 'Tower of Hanoi',
    genre: 'Logic Puzzle',
    description: '작은 원반 위에 큰 원반을 놓지 않으며 모든 원반을 옮기는 고전 퍼즐',
    controls: ['Click', 'Arrow Keys', 'Space', 'N'],
    accent: '#c084fc',
    status: 'playable',
  },
  {
    slug: 'circuit-connect',
    title: 'Circuit Connect',
    genre: 'Rotation Puzzle',
    description: '회로 타일을 회전해 전원에서 배터리까지 모든 전류를 연결하는 퍼즐',
    controls: ['Click', 'Arrow Keys', 'Space', 'N'],
    accent: '#2dd4bf',
    status: 'playable',
  },
  {
    slug: 'math-rush',
    title: 'Math Rush',
    genre: 'Arithmetic Reflex',
    description: '수식의 정답을 네 방향키 중 하나로 빠르게 고르는 산술 반응 게임',
    controls: ['Arrow Keys', 'Click', 'Space', 'N'],
    accent: '#38bdf8',
    status: 'playable',
  },
  {
    slug: 'maze-sweep',
    title: 'Maze Sweep',
    genre: 'Grid Escape',
    description: '랜덤 미로에서 오브를 모아 출구로 탈출하는 스테이지형 격자 게임',
    controls: ['Arrow Keys', 'N', 'P'],
    accent: '#f97316',
    status: 'playable',
  },
  {
    slug: 'signal-decoder',
    title: 'Signal Decoder',
    genre: 'Reaction Sequence',
    description: '방향 신호 시퀀스를 순서대로 해독하는 스테이지형 반응 게임',
    controls: ['Arrow Keys', 'Click', 'N', 'P'],
    accent: '#22d3ee',
    status: 'playable',
  },
  {
    slug: 'snake',
    title: 'Snake',
    genre: 'Arcade Survival',
    description: '먹이를 먹으며 길어지는 뱀을 벽과 몸에 부딪히지 않게 조종하는 게임',
    controls: ['Arrow Keys', 'WASD', 'Space'],
    accent: '#5bff7d',
    status: 'playable',
  },
  {
    slug: 'simon-says',
    title: 'Simon Says',
    genre: 'Memory Rhythm',
    description: '빛나는 패드 순서를 기억하고 같은 순서로 입력하는 기억력 게임',
    controls: ['Arrow Keys', 'WASD', 'Click', 'Space'],
    accent: '#f97316',
    status: 'playable',
  },
  {
    slug: 'perfect-stop',
    title: 'Perfect Stop',
    genre: 'Timing Reflex',
    description: '움직이는 커서를 목표 구간 안에서 멈추는 타이밍 반응 게임',
    controls: ['Space', 'Click', 'Touch'],
    accent: '#22d3ee',
    status: 'playable',
  },
  {
    slug: 'type-rain',
    title: 'Type Rain',
    genre: 'Typing Action',
    description: '떨어지는 단어를 입력해 제거하는 키보드 반응 게임',
    controls: ['Keyboard', 'Enter', 'Backspace', 'Space'],
    accent: '#38bdf8',
    status: 'playable',
  },
  {
    slug: 'whack-mole',
    title: 'Whack Mole',
    genre: 'Reaction Arcade',
    description: '3x3 구멍에 나타나는 두더지를 빠르게 잡는 반응 게임',
    controls: ['Click', 'Touch', 'Number Keys', 'Space'],
    accent: '#84cc16',
    status: 'playable',
  },
  {
    slug: 'pong-duel',
    title: 'Pong Duel',
    genre: 'Arcade Sports',
    description: '왼쪽 패들을 조작해 AI와 공을 주고받는 클래식 Pong 게임',
    controls: ['Arrow Up', 'Arrow Down', 'W', 'S', 'Space'],
    accent: '#22d3ee',
    status: 'playable',
  },
  {
    slug: 'memory-flip',
    title: 'Memory Flip',
    genre: 'Memory Puzzle',
    description: '4x4 카드판에서 같은 그림 쌍을 기억해 모두 맞추는 카드 매칭 게임',
    controls: ['Click', 'Touch', 'Number Keys', 'Space'],
    accent: '#f97316',
    status: 'playable',
  },
  {
    slug: 'laser-grid',
    title: 'Laser Grid',
    genre: 'Grid Survival',
    description: '5x5 격자에서 경고 후 발사되는 행/열 레이저를 피해 오래 버티는 회피 게임',
    controls: ['Arrow Keys', 'WASD', 'Space'],
    accent: '#38bdf8',
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
