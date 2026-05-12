export type GamePhase = 'ready' | 'playing' | 'paused' | 'game-over';
export type RandomSource = () => number;

export interface FallingWord {
  readonly id: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly speed: number;
}

export interface TypeRainState {
  readonly phase: GamePhase;
  readonly previousPhase: Exclude<GamePhase, 'paused'> | null;
  readonly words: readonly FallingWord[];
  readonly input: string;
  readonly score: number;
  readonly bestScore: number;
  readonly lives: number;
  readonly level: number;
  readonly streak: number;
  readonly nextWordId: number;
  readonly spawnCooldownMs: number;
  readonly elapsedMs: number;
}

export const INITIAL_LIVES = 3;
export const BASE_WORD_SPEED = 0.12;
export const SPEED_PER_LEVEL = 0.025;
export const INITIAL_SPAWN_INTERVAL_MS = 1400;
export const MIN_SPAWN_INTERVAL_MS = 620;
export const SCORE_PER_LEVEL = 240;
export const WORD_BANK: readonly string[] = [
  'CODE',
  'GAME',
  'TYPE',
  'STACK',
  'LEVEL',
  'SCORE',
  'COMBO',
  'INPUT',
  'PIXEL',
  'ARCADE',
  'SPRINT',
  'VECTOR',
];

export function createGameState(bestScore = 0): TypeRainState {
  return {
    phase: 'ready',
    previousPhase: null,
    words: [],
    input: '',
    score: 0,
    bestScore,
    lives: INITIAL_LIVES,
    level: 1,
    streak: 0,
    nextWordId: 1,
    spawnCooldownMs: 0,
    elapsedMs: 0,
  };
}

export function startGame(
  state: TypeRainState,
  random: RandomSource = Math.random,
): TypeRainState {
  if (state.phase === 'paused') {
    return resumeGame(state);
  }

  if (state.phase !== 'ready') {
    return state;
  }

  const firstWord = createFallingWord(1, 1, random);

  return {
    ...state,
    phase: 'playing',
    previousPhase: null,
    words: [firstWord],
    input: '',
    score: 0,
    lives: INITIAL_LIVES,
    level: 1,
    streak: 0,
    nextWordId: 2,
    spawnCooldownMs: getSpawnIntervalMs(1),
    elapsedMs: 0,
  };
}

export function pauseGame(state: TypeRainState): TypeRainState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
    previousPhase: 'playing',
  };
}

export function resumeGame(state: TypeRainState): TypeRainState {
  if (state.phase !== 'paused' || !state.previousPhase) {
    return state;
  }

  return {
    ...state,
    phase: state.previousPhase,
    previousPhase: null,
  };
}

export function tickGame(
  state: TypeRainState,
  deltaMs: number,
  random: RandomSource = Math.random,
): TypeRainState {
  if (state.phase !== 'playing') {
    return state;
  }

  const deltaSeconds = Math.max(0, deltaMs) / 1000;
  const movedWords = state.words.map((word) => ({
    ...word,
    y: word.y + word.speed * deltaSeconds,
  }));
  const activeWords = movedWords.filter((word) => word.y < 1);
  const missedCount = movedWords.length - activeWords.length;
  const lives = state.lives - missedCount;

  if (lives <= 0) {
    return {
      ...state,
      phase: 'game-over',
      previousPhase: null,
      words: activeWords,
      lives: 0,
      streak: 0,
      input: '',
      elapsedMs: state.elapsedMs + deltaMs,
      bestScore: Math.max(state.bestScore, state.score),
    };
  }

  const elapsedMs = state.elapsedMs + deltaMs;
  let words = activeWords;
  let nextWordId = state.nextWordId;
  let spawnCooldownMs = state.spawnCooldownMs - deltaMs;

  while (spawnCooldownMs <= 0 && words.length < 8) {
    words = [...words, createFallingWord(nextWordId, state.level, random)];
    nextWordId += 1;
    spawnCooldownMs += getSpawnIntervalMs(state.level);
  }

  return {
    ...state,
    words,
    lives,
    streak: missedCount > 0 ? 0 : state.streak,
    nextWordId,
    spawnCooldownMs,
    elapsedMs,
  };
}

export function typeCharacter(state: TypeRainState, character: string): TypeRainState {
  if (state.phase !== 'playing') {
    return state;
  }

  const normalized = character.toUpperCase();

  if (!/^[A-Z]$/.test(normalized)) {
    return state;
  }

  return {
    ...state,
    input: `${state.input}${normalized}`.slice(0, 12),
  };
}

export function deleteCharacter(state: TypeRainState): TypeRainState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    input: state.input.slice(0, -1),
  };
}

export function clearInput(state: TypeRainState): TypeRainState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    input: '',
  };
}

export function submitInput(state: TypeRainState): TypeRainState {
  if (state.phase !== 'playing' || state.input.length === 0) {
    return state;
  }

  const wordIndex = state.words.findIndex((word) => word.text === state.input);

  if (wordIndex === -1) {
    return {
      ...state,
      input: '',
      streak: 0,
    };
  }

  const matchedWord = state.words[wordIndex];

  if (!matchedWord) {
    throw new Error('Matched word was not found.');
  }

  const points = getWordScore(matchedWord.text, state.level, state.streak);
  const score = state.score + points;
  const level = getLevel(score);

  return {
    ...state,
    words: state.words.filter((word) => word.id !== matchedWord.id),
    input: '',
    score,
    bestScore: Math.max(state.bestScore, score),
    level,
    streak: state.streak + 1,
    spawnCooldownMs: Math.min(state.spawnCooldownMs, getSpawnIntervalMs(level)),
  };
}

export function forceGameOver(state: TypeRainState): TypeRainState {
  if (state.phase === 'game-over') {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    previousPhase: null,
    input: '',
    bestScore: Math.max(state.bestScore, state.score),
  };
}

export function createFallingWord(
  id: number,
  level: number,
  random: RandomSource = Math.random,
): FallingWord {
  const textIndex = Math.min(WORD_BANK.length - 1, Math.floor(random() * WORD_BANK.length));
  const text = WORD_BANK[textIndex];

  if (!text) {
    throw new Error('Unable to select word.');
  }

  return {
    id,
    text,
    x: 0.08 + random() * 0.84,
    y: -0.08,
    speed: getWordSpeed(level),
  };
}

export function getWordScore(word: string, level: number, streak: number): number {
  return word.length * 16 + level * 12 + streak * 8;
}

export function getLevel(score: number): number {
  return Math.floor(score / SCORE_PER_LEVEL) + 1;
}

export function getWordSpeed(level: number): number {
  return BASE_WORD_SPEED + Math.max(0, level - 1) * SPEED_PER_LEVEL;
}

export function getSpawnIntervalMs(level: number): number {
  return Math.max(
    MIN_SPAWN_INTERVAL_MS,
    INITIAL_SPAWN_INTERVAL_MS - Math.max(0, level - 1) * 90,
  );
}
