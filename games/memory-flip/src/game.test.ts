import { describe, expect, it } from 'vitest';
import {
  CARD_SYMBOLS,
  COMBO_BONUS,
  GAME_DURATION_MS,
  MATCH_SCORE,
  MISMATCH_PENALTY,
  PAIR_COUNT,
  createGameState,
  forceGameOver,
  getKeyboardCardIndex,
  pauseGame,
  resolveSelection,
  resumeGame,
  selectCard,
  startGame,
  tickGame,
  type MemoryCard,
  type MemoryFlipState,
} from './game';

function pairCounts(state: MemoryFlipState): Record<string, number> {
  return state.cards.reduce<Record<string, number>>((counts, card) => {
    counts[card.symbol] = (counts[card.symbol] ?? 0) + 1;
    return counts;
  }, {});
}

function createTestCard(id: number, symbolIndex: number): MemoryCard {
  return {
    id,
    symbol: CARD_SYMBOLS[symbolIndex],
    isFaceUp: false,
    isMatched: false,
  };
}

function createPairState(): MemoryFlipState {
  const state = createGameState(() => 0.5, 300);

  return {
    ...state,
    phase: 'playing',
    cards: [
      createTestCard(0, 0),
      createTestCard(1, 0),
      createTestCard(2, 1),
      createTestCard(3, 2),
      createTestCard(4, 3),
      createTestCard(5, 3),
      createTestCard(6, 4),
      createTestCard(7, 4),
      createTestCard(8, 5),
      createTestCard(9, 5),
      createTestCard(10, 6),
      createTestCard(11, 6),
      createTestCard(12, 7),
      createTestCard(13, 7),
      createTestCard(14, 1),
      createTestCard(15, 2),
    ],
  };
}

describe('Memory Flip game engine', () => {
  it('creates a shuffled deck with eight pairs', () => {
    const state = createGameState(() => 0.25, 900);

    expect(state.phase).toBe('ready');
    expect(state.bestScore).toBe(900);
    expect(state.cards).toHaveLength(16);
    expect(Object.values(pairCounts(state))).toEqual(Array.from({ length: PAIR_COUNT }, () => 2));
  });

  it('starts, pauses, and resumes active play', () => {
    const playing = startGame(createGameState(() => 0.5));
    const paused = pauseGame(playing);
    const resumed = resumeGame(paused);

    expect(playing.phase).toBe('playing');
    expect(paused.phase).toBe('paused');
    expect(resumed.phase).toBe('playing');
  });

  it('flips the first selected card', () => {
    const state = createPairState();
    const selected = selectCard(state, 0);

    expect(selected.cards[0].isFaceUp).toBe(true);
    expect(selected.selectedIds).toEqual([0]);
    expect(selected.moves).toBe(0);
  });

  it('scores a matching pair and increases combo', () => {
    const firstPick = selectCard(createPairState(), 0);
    const secondPick = selectCard(firstPick, 1);

    expect(secondPick.phase).toBe('playing');
    expect(secondPick.matches).toBe(1);
    expect(secondPick.moves).toBe(1);
    expect(secondPick.combo).toBe(1);
    expect(secondPick.score).toBe(MATCH_SCORE + COMBO_BONUS);
    expect(secondPick.cards[0].isMatched).toBe(true);
    expect(secondPick.cards[1].isMatched).toBe(true);
  });

  it('marks mismatches for delayed resolution', () => {
    const firstPick = selectCard(createPairState(), 0);
    const secondPick = selectCard(firstPick, 2);

    expect(secondPick.phase).toBe('checking');
    expect(secondPick.moves).toBe(1);
    expect(secondPick.combo).toBe(0);
    expect(secondPick.score).toBe(0);
    expect(secondPick.selectedIds).toEqual([0, 2]);
  });

  it('applies mismatch penalty without going below zero', () => {
    const state = {
      ...createPairState(),
      score: MISMATCH_PENALTY + 5,
      combo: 3,
    };
    const firstPick = selectCard(state, 0);
    const secondPick = selectCard(firstPick, 2);

    expect(secondPick.score).toBe(5);
    expect(secondPick.combo).toBe(0);
  });

  it('turns mismatched cards face down after resolution', () => {
    const firstPick = selectCard(createPairState(), 0);
    const secondPick = selectCard(firstPick, 2);
    const resolved = resolveSelection(secondPick);

    expect(resolved.phase).toBe('playing');
    expect(resolved.selectedIds).toEqual([]);
    expect(resolved.cards[0].isFaceUp).toBe(false);
    expect(resolved.cards[2].isFaceUp).toBe(false);
  });

  it('ignores cards that are already selected or matched', () => {
    const firstPick = selectCard(createPairState(), 0);
    const duplicatePick = selectCard(firstPick, 0);
    const matched = selectCard(firstPick, 1);
    const ignoredMatched = selectCard(matched, 0);

    expect(duplicatePick).toEqual(firstPick);
    expect(ignoredMatched).toEqual(matched);
  });

  it('wins when the final pair is matched', () => {
    const state = {
      ...createPairState(),
      matches: PAIR_COUNT - 1,
      cards: createPairState().cards.map((card) =>
        card.id === 0 || card.id === 1
          ? card
          : {
              ...card,
              isFaceUp: true,
              isMatched: true,
            },
      ),
    };
    const firstPick = selectCard(state, 0);
    const secondPick = selectCard(firstPick, 1);

    expect(secondPick.phase).toBe('won');
    expect(secondPick.matches).toBe(PAIR_COUNT);
  });

  it('reduces remaining time and ends the game at zero', () => {
    const state = startGame(createGameState(() => 0.5));
    const ticked = tickGame(state, 1_500);
    const expired = tickGame(ticked, GAME_DURATION_MS);

    expect(ticked.remainingMs).toBe(GAME_DURATION_MS - 1_500);
    expect(expired.phase).toBe('game-over');
    expect(expired.remainingMs).toBe(0);
  });

  it('forces game over without changing completed states', () => {
    const gameOver = forceGameOver({
      ...startGame(createGameState(() => 0.5)),
      score: 500,
    });
    const stillGameOver = forceGameOver(gameOver);

    expect(gameOver.phase).toBe('game-over');
    expect(gameOver.bestScore).toBe(500);
    expect(stillGameOver).toEqual(gameOver);
  });

  it('maps keyboard keys to board indexes', () => {
    expect(getKeyboardCardIndex('Digit1')).toBe(0);
    expect(getKeyboardCardIndex('9')).toBe(8);
    expect(getKeyboardCardIndex('KeyQ')).toBe(9);
    expect(getKeyboardCardIndex('F')).toBe(15);
    expect(getKeyboardCardIndex('ArrowLeft')).toBeNull();
  });
});
