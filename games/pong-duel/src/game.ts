export type GamePhase = 'ready' | 'playing' | 'paused' | 'round-over' | 'game-over';
export type PlayerInput = 'up' | 'down' | 'none';
export type Scorer = 'player' | 'ai';

export interface Vector {
  readonly x: number;
  readonly y: number;
}

export interface Paddle {
  readonly y: number;
  readonly height: number;
}

export interface Ball {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly velocity: Vector;
}

export interface PongState {
  readonly phase: GamePhase;
  readonly previousPhase: Exclude<GamePhase, 'paused'> | null;
  readonly player: Paddle;
  readonly ai: Paddle;
  readonly ball: Ball;
  readonly playerScore: number;
  readonly aiScore: number;
  readonly round: number;
  readonly targetScore: number;
  readonly rally: number;
  readonly lastScorer: Scorer | null;
}

export const PADDLE_HEIGHT = 0.22;
export const PADDLE_WIDTH = 0.025;
export const PLAYER_X = 0.06;
export const AI_X = 0.94;
export const BALL_RADIUS = 0.018;
export const PADDLE_SPEED = 0.78;
export const AI_SPEED = 0.58;
export const INITIAL_BALL_SPEED = 0.56;
export const BALL_SPEED_UP = 1.045;
export const MAX_BALL_SPEED = 1.08;
export const TARGET_SCORE = 5;

export function createGameState(): PongState {
  return {
    phase: 'ready',
    previousPhase: null,
    player: createPaddle(),
    ai: createPaddle(),
    ball: createBall('player', 1),
    playerScore: 0,
    aiScore: 0,
    round: 1,
    targetScore: TARGET_SCORE,
    rally: 0,
    lastScorer: null,
  };
}

export function startGame(state: PongState): PongState {
  if (state.phase === 'paused') {
    return resumeGame(state);
  }

  if (state.phase !== 'ready' && state.phase !== 'round-over') {
    return state;
  }

  return {
    ...state,
    phase: 'playing',
    previousPhase: null,
    lastScorer: null,
  };
}

export function pauseGame(state: PongState): PongState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
    previousPhase: 'playing',
  };
}

export function resumeGame(state: PongState): PongState {
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
  state: PongState,
  deltaMs: number,
  playerInput: PlayerInput = 'none',
): PongState {
  if (state.phase !== 'playing') {
    return state;
  }

  const deltaSeconds = Math.max(0, deltaMs) / 1000;
  const player = movePlayerPaddle(state.player, playerInput, deltaSeconds);
  const ai = moveAiPaddle(state.ai, state.ball, deltaSeconds);
  const movedBall = moveBall(state.ball, deltaSeconds);
  const wallBall = bounceWall(movedBall);
  const paddleBall = bouncePaddles(wallBall, player, ai, state.rally);
  const rally = paddleBall.velocity.x !== wallBall.velocity.x ? state.rally + 1 : state.rally;

  if (paddleBall.x < -BALL_RADIUS) {
    return scorePoint(state, 'ai', player, ai);
  }

  if (paddleBall.x > 1 + BALL_RADIUS) {
    return scorePoint(state, 'player', player, ai);
  }

  return {
    ...state,
    player,
    ai,
    ball: paddleBall,
    rally,
  };
}

export function forceGameOver(state: PongState): PongState {
  if (state.phase === 'game-over') {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    previousPhase: null,
  };
}

export function getKeyboardInput(key: string): PlayerInput | null {
  const keyMap: Record<string, PlayerInput> = {
    ArrowUp: 'up',
    KeyW: 'up',
    w: 'up',
    W: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    s: 'down',
    S: 'down',
  };

  return keyMap[key] ?? null;
}

export function getBallSpeed(ball: Ball): number {
  return Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
}

export function resetRound(state: PongState): PongState {
  if (state.phase !== 'round-over') {
    return state;
  }

  return {
    ...state,
    phase: 'playing',
    previousPhase: null,
    player: createPaddle(),
    ai: createPaddle(),
    ball: createBall(state.lastScorer ?? 'player', state.round),
    rally: 0,
  };
}

function createPaddle(): Paddle {
  return {
    y: 0.5 - PADDLE_HEIGHT / 2,
    height: PADDLE_HEIGHT,
  };
}

function createBall(direction: Scorer, round: number): Ball {
  const horizontalDirection = direction === 'player' ? 1 : -1;
  const verticalDirection = round % 2 === 0 ? -1 : 1;
  const speed = Math.min(MAX_BALL_SPEED, INITIAL_BALL_SPEED + (round - 1) * 0.035);

  return {
    x: 0.5,
    y: 0.5,
    radius: BALL_RADIUS,
    velocity: {
      x: horizontalDirection * speed,
      y: verticalDirection * speed * 0.34,
    },
  };
}

function movePlayerPaddle(paddle: Paddle, input: PlayerInput, deltaSeconds: number): Paddle {
  if (input === 'none') {
    return paddle;
  }

  const direction = input === 'up' ? -1 : 1;

  return {
    ...paddle,
    y: clampPaddleY(paddle.y + direction * PADDLE_SPEED * deltaSeconds, paddle.height),
  };
}

function moveAiPaddle(paddle: Paddle, ball: Ball, deltaSeconds: number): Paddle {
  const paddleCenter = paddle.y + paddle.height / 2;
  const delta = ball.y - paddleCenter;

  if (Math.abs(delta) < 0.01) {
    return paddle;
  }

  const direction = delta > 0 ? 1 : -1;

  return {
    ...paddle,
    y: clampPaddleY(paddle.y + direction * AI_SPEED * deltaSeconds, paddle.height),
  };
}

function moveBall(ball: Ball, deltaSeconds: number): Ball {
  return {
    ...ball,
    x: ball.x + ball.velocity.x * deltaSeconds,
    y: ball.y + ball.velocity.y * deltaSeconds,
  };
}

function bounceWall(ball: Ball): Ball {
  if (ball.y - ball.radius <= 0 && ball.velocity.y < 0) {
    return {
      ...ball,
      y: ball.radius,
      velocity: {
        ...ball.velocity,
        y: Math.abs(ball.velocity.y),
      },
    };
  }

  if (ball.y + ball.radius >= 1 && ball.velocity.y > 0) {
    return {
      ...ball,
      y: 1 - ball.radius,
      velocity: {
        ...ball.velocity,
        y: -Math.abs(ball.velocity.y),
      },
    };
  }

  return ball;
}

function bouncePaddles(ball: Ball, player: Paddle, ai: Paddle, rally: number): Ball {
  if (ball.velocity.x < 0 && overlapsPaddle(ball, PLAYER_X, player)) {
    return bouncePaddle(ball, PLAYER_X + PADDLE_WIDTH / 2 + ball.radius, player, 1, rally);
  }

  if (ball.velocity.x > 0 && overlapsPaddle(ball, AI_X, ai)) {
    return bouncePaddle(ball, AI_X - PADDLE_WIDTH / 2 - ball.radius, ai, -1, rally);
  }

  return ball;
}

function overlapsPaddle(ball: Ball, paddleX: number, paddle: Paddle): boolean {
  const paddleLeft = paddleX - PADDLE_WIDTH / 2;
  const paddleRight = paddleX + PADDLE_WIDTH / 2;
  const paddleTop = paddle.y;
  const paddleBottom = paddle.y + paddle.height;

  return (
    ball.x + ball.radius >= paddleLeft &&
    ball.x - ball.radius <= paddleRight &&
    ball.y + ball.radius >= paddleTop &&
    ball.y - ball.radius <= paddleBottom
  );
}

function bouncePaddle(
  ball: Ball,
  x: number,
  paddle: Paddle,
  direction: 1 | -1,
  rally: number,
): Ball {
  const paddleCenter = paddle.y + paddle.height / 2;
  const hitOffset = clamp((ball.y - paddleCenter) / (paddle.height / 2), -1, 1);
  const speed = Math.min(MAX_BALL_SPEED, getBallSpeed(ball) * BALL_SPEED_UP + rally * 0.002);

  return {
    ...ball,
    x,
    velocity: {
      x: direction * speed,
      y: hitOffset * speed * 0.72,
    },
  };
}

function scorePoint(state: PongState, scorer: Scorer, player: Paddle, ai: Paddle): PongState {
  const playerScore = state.playerScore + (scorer === 'player' ? 1 : 0);
  const aiScore = state.aiScore + (scorer === 'ai' ? 1 : 0);
  const phase = playerScore >= state.targetScore || aiScore >= state.targetScore ? 'game-over' : 'round-over';

  return {
    ...state,
    phase,
    previousPhase: null,
    player,
    ai,
    ball: createBall(scorer, state.round + 1),
    playerScore,
    aiScore,
    round: state.round + 1,
    rally: 0,
    lastScorer: scorer,
  };
}

function clampPaddleY(y: number, height: number): number {
  return clamp(y, 0, 1 - height);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
