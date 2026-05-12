import { describe, expect, it } from 'vitest';
import {
  ACTIVE_DURATION_MS,
  GRID_SIZE,
  LASER_SURVIVE_SCORE,
  SCORE_PER_SECOND,
  START_ENERGY,
  WARNING_DURATION_MS,
  createGameState,
  forceGameOver,
  getDirectionFromInput,
  getLevel,
  getSpawnInterval,
  isLaserOnPosition,
  movePlayer,
  pauseGame,
  spawnLaser,
  startGame,
  tickGame,
  type LaserGridState,
} from './game';

function playingState(): LaserGridState {
  return startGame(createGameState(250));
}

describe('Laser Grid engine', () => {
  it('creates a ready state at the center cell', () => {
    const state = createGameState(500);

    expect(state.phase).toBe('ready');
    expect(state.bestScore).toBe(500);
    expect(state.energy).toBe(START_ENERGY);
    expect(state.player).toEqual({ row: 2, column: 2 });
    expect(state.lasers).toEqual([]);
  });

  it('starts, pauses, and forces game over', () => {
    const started = startGame(createGameState());
    const paused = pauseGame(started);
    const over = forceGameOver({ ...started, score: 420 });

    expect(started.phase).toBe('playing');
    expect(paused.phase).toBe('paused');
    expect(over.phase).toBe('game-over');
    expect(over.bestScore).toBe(420);
  });

  it('moves the player within grid bounds', () => {
    let state = playingState();

    state = movePlayer(state, 'up');
    state = movePlayer(state, 'left');
    state = movePlayer(state, 'left');
    state = movePlayer(state, 'left');

    expect(state.player).toEqual({ row: 1, column: 0 });
  });

  it('spawns deterministic row and column lasers', () => {
    const rowLaser = spawnLaser(playingState(), () => 0.2);
    const columnLaser = spawnLaser(playingState(), () => 0.8);

    expect(rowLaser.lasers[0]).toMatchObject({ axis: 'row', index: 1, phase: 'warning' });
    expect(columnLaser.lasers[0]).toMatchObject({ axis: 'column', index: 4, phase: 'warning' });
  });

  it('detects whether a laser covers a position', () => {
    const state = spawnLaser(playingState(), () => 0.2);
    const laser = state.lasers[0];

    expect(isLaserOnPosition(laser, { row: 1, column: 4 })).toBe(true);
    expect(isLaserOnPosition(laser, { row: 2, column: 1 })).toBe(false);
  });

  it('turns warning lasers into active lasers', () => {
    const state = {
      ...spawnLaser(playingState(), () => 0.2),
      spawnTimerMs: 10_000,
    };
    const ticked = tickGame(state, WARNING_DURATION_MS + 1, () => 0.6);

    expect(ticked.lasers[0]).toMatchObject({
      phase: 'active',
      remainingMs: ACTIVE_DURATION_MS - 1,
    });
  });

  it('awards survival score when an active laser expires without a hit', () => {
    const state = {
      ...spawnLaser(playingState(), () => 0.2),
      spawnTimerMs: 10_000,
    };
    const active = tickGame(state, WARNING_DURATION_MS + 1, () => 0.6);
    const cleared = tickGame(active, ACTIVE_DURATION_MS, () => 0.6);

    expect(cleared.lasers).toHaveLength(0);
    expect(cleared.score).toBeGreaterThanOrEqual(LASER_SURVIVE_SCORE);
  });

  it('damages the player once per active laser', () => {
    const state = {
      ...playingState(),
      lasers: [
        {
          id: 1,
          axis: 'row' as const,
          index: 2,
          phase: 'active' as const,
          remainingMs: 200,
          hasHitPlayer: false,
        },
      ],
    };
    const hit = tickGame(state, 16, () => 0.6);
    const alreadyHit = tickGame(hit, 16, () => 0.6);

    expect(hit.energy).toBe(START_ENERGY - 1);
    expect(alreadyHit.energy).toBe(START_ENERGY - 1);
  });

  it('ends the game when energy reaches zero', () => {
    const state = {
      ...playingState(),
      energy: 1,
      lasers: [
        {
          id: 1,
          axis: 'column' as const,
          index: 2,
          phase: 'active' as const,
          remainingMs: 200,
          hasHitPlayer: false,
        },
      ],
    };
    const hit = tickGame(state, 16, () => 0.6);

    expect(hit.phase).toBe('game-over');
    expect(hit.energy).toBe(0);
  });

  it('adds time score and increases level over time', () => {
    const ticked = tickGame(playingState(), 1_000, () => 0.6);
    const highLevel = tickGame(playingState(), 18_200, () => 0.6);

    expect(ticked.score).toBeGreaterThanOrEqual(SCORE_PER_SECOND);
    expect(highLevel.level).toBe(getLevel(18_200));
  });

  it('reduces spawn interval by level but keeps a minimum', () => {
    expect(getSpawnInterval(1)).toBeGreaterThan(getSpawnInterval(5));
    expect(getSpawnInterval(999)).toBe(getSpawnInterval(9999));
  });

  it('maps keyboard input to directions', () => {
    expect(getDirectionFromInput('ArrowUp')).toBe('up');
    expect(getDirectionFromInput('KeyD')).toBe('right');
    expect(getDirectionFromInput('s')).toBe('down');
    expect(getDirectionFromInput('Escape')).toBeNull();
  });

  it('never moves beyond the bottom right edge', () => {
    let state = playingState();

    for (let index = 0; index < GRID_SIZE + 3; index += 1) {
      state = movePlayer(state, 'right');
      state = movePlayer(state, 'down');
    }

    expect(state.player).toEqual({ row: GRID_SIZE - 1, column: GRID_SIZE - 1 });
  });
});
