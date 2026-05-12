export type PadId = 'up' | 'right' | 'down' | 'left';
export type GamePhase = 'ready' | 'showing' | 'input' | 'paused' | 'game-over';
export type RandomSource = () => number;

export interface SimonState {
  readonly phase: GamePhase;
  readonly previousPhase: Exclude<GamePhase, 'paused'> | null;
  readonly sequence: readonly PadId[];
  readonly inputIndex: number;
  readonly round: number;
  readonly score: number;
  readonly bestScore: number;
  readonly streak: number;
}

export const PADS: readonly PadId[] = ['up', 'right', 'down', 'left'];
export const CORRECT_INPUT_SCORE = 10;
export const ROUND_BONUS_SCORE = 50;
export const SPEED_UP_EVERY_ROUNDS = 3;
export const INITIAL_CUE_MS = 620;
export const MIN_CUE_MS = 260;
export const INITIAL_GAP_MS = 180;
export const MIN_GAP_MS = 90;

export function createGameState(bestScore = 0): SimonState {
  return {
    phase: 'ready',
    previousPhase: null,
    sequence: [],
    inputIndex: 0,
    round: 0,
    score: 0,
    bestScore,
    streak: 0,
  };
}

export function startGame(
  state: SimonState,
  random: RandomSource = Math.random,
): SimonState {
  if (state.phase === 'paused') {
    return resumeGame(state);
  }

  if (state.phase !== 'ready') {
    return state;
  }

  return {
    ...state,
    phase: 'showing',
    previousPhase: null,
    sequence: [getRandomPad(random)],
    inputIndex: 0,
    round: 1,
    streak: 0,
  };
}

export function pauseGame(state: SimonState): SimonState {
  if (state.phase !== 'showing' && state.phase !== 'input') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
    previousPhase: state.phase,
  };
}

export function resumeGame(state: SimonState): SimonState {
  if (state.phase !== 'paused' || !state.previousPhase) {
    return state;
  }

  return {
    ...state,
    phase: state.previousPhase,
    previousPhase: null,
  };
}

export function finishShowing(state: SimonState): SimonState {
  if (state.phase !== 'showing') {
    return state;
  }

  return {
    ...state,
    phase: 'input',
    inputIndex: 0,
  };
}

export function pressPad(
  state: SimonState,
  pad: PadId,
  random: RandomSource = Math.random,
): SimonState {
  if (state.phase !== 'input') {
    return state;
  }

  const expectedPad = state.sequence[state.inputIndex];

  if (expectedPad !== pad) {
    return {
      ...state,
      phase: 'game-over',
      previousPhase: null,
      bestScore: Math.max(state.bestScore, state.score),
      streak: 0,
    };
  }

  const inputScore = getCorrectInputScore(state.round);
  const isRoundComplete = state.inputIndex === state.sequence.length - 1;

  if (!isRoundComplete) {
    const score = state.score + inputScore;

    return {
      ...state,
      inputIndex: state.inputIndex + 1,
      score,
      bestScore: Math.max(state.bestScore, score),
      streak: state.streak + 1,
    };
  }

  const score = state.score + inputScore + getRoundBonusScore(state.round);

  return {
    ...state,
    phase: 'showing',
    previousPhase: null,
    sequence: [...state.sequence, getRandomPad(random)],
    inputIndex: 0,
    round: state.round + 1,
    score,
    bestScore: Math.max(state.bestScore, score),
    streak: state.streak + 1,
  };
}

export function forceGameOver(state: SimonState): SimonState {
  if (state.phase === 'game-over') {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    previousPhase: null,
    bestScore: Math.max(state.bestScore, state.score),
    streak: 0,
  };
}

export function getCorrectInputScore(round: number): number {
  return CORRECT_INPUT_SCORE * Math.max(1, round);
}

export function getRoundBonusScore(round: number): number {
  return ROUND_BONUS_SCORE * Math.max(1, round);
}

export function getSpeedLevel(round: number): number {
  return Math.floor(Math.max(0, round - 1) / SPEED_UP_EVERY_ROUNDS) + 1;
}

export function getCueDurationMs(round: number): number {
  const level = getSpeedLevel(round);
  return Math.max(MIN_CUE_MS, INITIAL_CUE_MS - (level - 1) * 60);
}

export function getCueGapMs(round: number): number {
  const level = getSpeedLevel(round);
  return Math.max(MIN_GAP_MS, INITIAL_GAP_MS - (level - 1) * 18);
}

export function getRandomPad(random: RandomSource = Math.random): PadId {
  const index = Math.min(PADS.length - 1, Math.floor(random() * PADS.length));
  const pad = PADS[index];

  if (!pad) {
    throw new Error('Unable to select pad.');
  }

  return pad;
}

export function getKeyboardPad(key: string): PadId | null {
  const keyMap: Record<string, PadId> = {
    ArrowUp: 'up',
    KeyW: 'up',
    w: 'up',
    W: 'up',
    ArrowRight: 'right',
    KeyD: 'right',
    d: 'right',
    D: 'right',
    ArrowDown: 'down',
    KeyS: 'down',
    s: 'down',
    S: 'down',
    ArrowLeft: 'left',
    KeyA: 'left',
    a: 'left',
    A: 'left',
  };

  return keyMap[key] ?? null;
}
