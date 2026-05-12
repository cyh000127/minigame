export const GRID_SIZE = 4;
export const CARD_COUNT = GRID_SIZE * GRID_SIZE;
export const PAIR_COUNT = CARD_COUNT / 2;
export const GAME_DURATION_MS = 90_000;
export const MATCH_SCORE = 120;
export const COMBO_BONUS = 30;
export const MISMATCH_PENALTY = 10;

export const CARD_SYMBOLS = [
  'SUN',
  'MOON',
  'STAR',
  'COMET',
  'CROWN',
  'HEART',
  'BOLT',
  'GEM',
] as const;

export type CardSymbol = (typeof CARD_SYMBOLS)[number];
export type GamePhase = 'ready' | 'playing' | 'checking' | 'paused' | 'won' | 'game-over';
type ActivePhase = 'playing' | 'checking';
export type RandomSource = () => number;

export interface MemoryCard {
  id: number;
  symbol: CardSymbol;
  isFaceUp: boolean;
  isMatched: boolean;
}

export interface MemoryFlipState {
  phase: GamePhase;
  pausedFrom: ActivePhase | null;
  cards: MemoryCard[];
  selectedIds: number[];
  moves: number;
  matches: number;
  score: number;
  bestScore: number;
  combo: number;
  remainingMs: number;
}

const KEY_TO_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Digit9: 8,
  KeyQ: 9,
  KeyW: 10,
  KeyE: 11,
  KeyA: 12,
  KeyS: 13,
  KeyD: 14,
  KeyF: 15,
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  q: 9,
  w: 10,
  e: 11,
  a: 12,
  s: 13,
  d: 14,
  f: 15,
  Q: 9,
  W: 10,
  E: 11,
  A: 12,
  S: 13,
  D: 14,
  F: 15,
};

function shuffleSymbols(random: RandomSource): CardSymbol[] {
  const symbols = [...CARD_SYMBOLS, ...CARD_SYMBOLS];

  for (let index = symbols.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(Math.max(random(), 0), 0.999999);
    const swapIndex = Math.floor(randomValue * (index + 1));
    [symbols[index], symbols[swapIndex]] = [symbols[swapIndex], symbols[index]];
  }

  return symbols;
}

function updateBestScore(state: MemoryFlipState, score: number): number {
  return Math.max(state.bestScore, score);
}

function findCard(cards: MemoryCard[], id: number): MemoryCard | undefined {
  return cards.find((card) => card.id === id);
}

export function createGameState(random: RandomSource = Math.random, bestScore = 0): MemoryFlipState {
  return {
    phase: 'ready',
    pausedFrom: null,
    cards: shuffleSymbols(random).map((symbol, id) => ({
      id,
      symbol,
      isFaceUp: false,
      isMatched: false,
    })),
    selectedIds: [],
    moves: 0,
    matches: 0,
    score: 0,
    bestScore,
    combo: 0,
    remainingMs: GAME_DURATION_MS,
  };
}

export function startGame(state: MemoryFlipState): MemoryFlipState {
  if (state.phase === 'ready') {
    return {
      ...state,
      phase: 'playing',
      pausedFrom: null,
    };
  }

  if (state.phase === 'paused') {
    return resumeGame(state);
  }

  return state;
}

export function pauseGame(state: MemoryFlipState): MemoryFlipState {
  if (state.phase !== 'playing' && state.phase !== 'checking') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
    pausedFrom: state.phase,
  };
}

export function resumeGame(state: MemoryFlipState): MemoryFlipState {
  if (state.phase !== 'paused') {
    return state;
  }

  return {
    ...state,
    phase: state.pausedFrom ?? 'playing',
    pausedFrom: null,
  };
}

export function tickGame(state: MemoryFlipState, deltaMs: number): MemoryFlipState {
  if (state.phase !== 'playing' && state.phase !== 'checking') {
    return state;
  }

  const remainingMs = Math.max(0, state.remainingMs - Math.max(0, deltaMs));

  if (remainingMs === 0) {
    return {
      ...state,
      phase: 'game-over',
      pausedFrom: null,
      selectedIds: [],
      remainingMs,
      bestScore: updateBestScore(state, state.score),
    };
  }

  return {
    ...state,
    remainingMs,
  };
}

export function selectCard(state: MemoryFlipState, cardId: number): MemoryFlipState {
  if (state.phase !== 'playing' || state.selectedIds.length >= 2) {
    return state;
  }

  const targetCard = findCard(state.cards, cardId);

  if (!targetCard || targetCard.isFaceUp || targetCard.isMatched) {
    return state;
  }

  const cards = state.cards.map((card) =>
    card.id === cardId
      ? {
          ...card,
          isFaceUp: true,
        }
      : card,
  );
  const selectedIds = [...state.selectedIds, cardId];

  if (selectedIds.length < 2) {
    return {
      ...state,
      cards,
      selectedIds,
    };
  }

  const firstCard = findCard(cards, selectedIds[0]);
  const secondCard = findCard(cards, selectedIds[1]);

  if (!firstCard || !secondCard) {
    return state;
  }

  const moves = state.moves + 1;

  if (firstCard.symbol === secondCard.symbol) {
    const combo = state.combo + 1;
    const score = state.score + MATCH_SCORE + combo * COMBO_BONUS;
    const matches = state.matches + 1;
    const matchedCards = cards.map((card) =>
      selectedIds.includes(card.id)
        ? {
            ...card,
            isMatched: true,
            isFaceUp: true,
          }
        : card,
    );

    return {
      ...state,
      phase: matches === PAIR_COUNT ? 'won' : 'playing',
      pausedFrom: null,
      cards: matchedCards,
      selectedIds: [],
      moves,
      matches,
      combo,
      score,
      bestScore: updateBestScore(state, score),
    };
  }

  const score = Math.max(0, state.score - MISMATCH_PENALTY);

  return {
    ...state,
    phase: 'checking',
    cards,
    selectedIds,
    moves,
    combo: 0,
    score,
    bestScore: updateBestScore(state, score),
  };
}

export function resolveSelection(state: MemoryFlipState): MemoryFlipState {
  if (state.phase !== 'checking') {
    return state;
  }

  return {
    ...state,
    phase: 'playing',
    pausedFrom: null,
    cards: state.cards.map((card) =>
      state.selectedIds.includes(card.id) && !card.isMatched
        ? {
            ...card,
            isFaceUp: false,
          }
        : card,
    ),
    selectedIds: [],
  };
}

export function forceGameOver(state: MemoryFlipState): MemoryFlipState {
  if (state.phase === 'won' || state.phase === 'game-over') {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    pausedFrom: null,
    selectedIds: [],
    bestScore: updateBestScore(state, state.score),
  };
}

export function getKeyboardCardIndex(input: string): number | null {
  return KEY_TO_INDEX[input] ?? null;
}
