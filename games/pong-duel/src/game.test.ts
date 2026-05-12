import { describe, expect, it } from 'vitest';
import {
  AI_X,
  BALL_RADIUS,
  PLAYER_X,
  PADDLE_WIDTH,
  createGameState,
  forceGameOver,
  getBallSpeed,
  getKeyboardInput,
  pauseGame,
  resetRound,
  resumeGame,
  startGame,
  tickGame,
  type PongState,
} from './game';

describe('pong duel engine', () => {
  it('creates a ready state', () => {
    const state = createGameState();

    expect(state.phase).toBe('ready');
    expect(state.playerScore).toBe(0);
    expect(state.aiScore).toBe(0);
    expect(state.ball.x).toBe(0.5);
  });

  it('starts and pauses the game', () => {
    const playing = startGame(createGameState());
    const paused = pauseGame(playing);

    expect(playing.phase).toBe('playing');
    expect(paused.phase).toBe('paused');
    expect(resumeGame(paused).phase).toBe('playing');
  });

  it('moves the player paddle by input', () => {
    const state = startGame(createGameState());
    const down = tickGame(state, 500, 'down');
    const up = tickGame(down, 500, 'up');

    expect(down.player.y).toBeGreaterThan(state.player.y);
    expect(up.player.y).toBeLessThan(down.player.y);
  });

  it('moves the ai paddle toward the ball', () => {
    const state: PongState = {
      ...startGame(createGameState()),
      ball: { ...createGameState().ball, y: 0.85 },
    };
    const nextState = tickGame(state, 500);

    expect(nextState.ai.y).toBeGreaterThan(state.ai.y);
  });

  it('bounces the ball off the top and bottom walls', () => {
    const topState: PongState = {
      ...startGame(createGameState()),
      ball: { x: 0.5, y: BALL_RADIUS / 2, radius: BALL_RADIUS, velocity: { x: 0.3, y: -0.4 } },
    };
    const bottomState: PongState = {
      ...startGame(createGameState()),
      ball: { x: 0.5, y: 1 - BALL_RADIUS / 2, radius: BALL_RADIUS, velocity: { x: 0.3, y: 0.4 } },
    };

    expect(tickGame(topState, 16).ball.velocity.y).toBeGreaterThan(0);
    expect(tickGame(bottomState, 16).ball.velocity.y).toBeLessThan(0);
  });

  it('bounces from the player paddle and increases rally', () => {
    const state: PongState = {
      ...startGame(createGameState()),
      player: { y: 0.39, height: 0.22 },
      ball: {
        x: PLAYER_X + PADDLE_WIDTH / 2,
        y: 0.5,
        radius: BALL_RADIUS,
        velocity: { x: -0.5, y: 0 },
      },
    };

    const nextState = tickGame(state, 16);

    expect(nextState.ball.velocity.x).toBeGreaterThan(0);
    expect(nextState.rally).toBe(1);
    expect(getBallSpeed(nextState.ball)).toBeGreaterThan(0.5);
  });

  it('bounces from the ai paddle', () => {
    const state: PongState = {
      ...startGame(createGameState()),
      ai: { y: 0.39, height: 0.22 },
      ball: {
        x: AI_X - PADDLE_WIDTH / 2,
        y: 0.5,
        radius: BALL_RADIUS,
        velocity: { x: 0.5, y: 0 },
      },
    };

    expect(tickGame(state, 16).ball.velocity.x).toBeLessThan(0);
  });

  it('scores for ai when the ball exits left', () => {
    const state: PongState = {
      ...startGame(createGameState()),
      ball: { x: -BALL_RADIUS * 1.1, y: 0.5, radius: BALL_RADIUS, velocity: { x: -0.5, y: 0 } },
    };

    const nextState = tickGame(state, 16);

    expect(nextState.phase).toBe('round-over');
    expect(nextState.aiScore).toBe(1);
    expect(nextState.lastScorer).toBe('ai');
  });

  it('scores for player and ends at target score', () => {
    const state: PongState = {
      ...startGame(createGameState()),
      playerScore: 4,
      ball: { x: 1 + BALL_RADIUS * 1.1, y: 0.5, radius: BALL_RADIUS, velocity: { x: 0.5, y: 0 } },
    };

    const nextState = tickGame(state, 16);

    expect(nextState.phase).toBe('game-over');
    expect(nextState.playerScore).toBe(5);
  });

  it('resets the next round after a point', () => {
    const scored: PongState = {
      ...startGame(createGameState()),
      ball: { x: -BALL_RADIUS * 1.1, y: 0.5, radius: BALL_RADIUS, velocity: { x: -0.5, y: 0 } },
    };
    const roundOver = tickGame(scored, 16);
    const nextRound = resetRound(roundOver);

    expect(nextRound.phase).toBe('playing');
    expect(nextRound.rally).toBe(0);
    expect(nextRound.ball.velocity.x).toBeLessThan(0);
  });

  it('maps keyboard input and forces game over', () => {
    expect(getKeyboardInput('ArrowUp')).toBe('up');
    expect(getKeyboardInput('KeyS')).toBe('down');
    expect(getKeyboardInput('x')).toBeNull();
    expect(forceGameOver(startGame(createGameState())).phase).toBe('game-over');
  });
});
