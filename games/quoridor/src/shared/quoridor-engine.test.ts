import { describe, expect, it } from 'vitest';
import {
  applyQuoridorAction,
  canPlaceQuoridorWall,
  createInitialQuoridorSnapshot,
  getLegalPawnMoves
} from './quoridor-engine.js';

function moveKeys(moves: Array<{ row: number; col: number }>) {
  return moves.map((move) => `${move.row}:${move.col}`).sort();
}

describe('quoridor engine', () => {
  it('creates 2-player and 4-player boards with the correct wall counts', () => {
    const duo = createInitialQuoridorSnapshot(['northbound', 'southbound'], 2);
    const quartet = createInitialQuoridorSnapshot(['top-goal', 'bottom-goal', 'right-goal', 'left-goal'], 4);

    expect(duo.players.map((player) => player.wallsRemaining)).toEqual([10, 10]);
    expect(duo.players.map((player) => player.position)).toEqual([
      { row: 8, col: 4 },
      { row: 0, col: 4 }
    ]);
    expect(quartet.players.map((player) => player.wallsRemaining)).toEqual([5, 5, 5, 5]);
    expect(quartet.players.map((player) => player.goalEdge)).toEqual(['top', 'bottom', 'right', 'left']);
  });

  it('moves the current pawn and advances the turn', () => {
    const snapshot = createInitialQuoridorSnapshot(['host', 'guest'], 2);
    const result = applyQuoridorAction(snapshot, 'host', {
      type: 'move-pawn',
      to: { row: 7, col: 4 }
    });

    if (!result.ok) {
      throw new Error('expected host move to be legal');
    }

    expect(result.snapshot.players[0]?.position).toEqual({ row: 7, col: 4 });
    expect(result.snapshot.turnPlayerName).toBe('guest');
    expect(result.snapshot.winnerPlayerName).toBeNull();
  });

  it('supports straight jumps and diagonal alternatives when a jump is blocked', () => {
    const straightJump = createInitialQuoridorSnapshot(['host', 'guest'], 2);
    straightJump.players[0]!.position = { row: 4, col: 4 };
    straightJump.players[1]!.position = { row: 3, col: 4 };
    straightJump.turnPlayerName = 'host';

    expect(moveKeys(getLegalPawnMoves(straightJump, 'host'))).toContain('2:4');

    const diagonalJump = {
      ...straightJump,
      walls: [{ row: 2, col: 4, orientation: 'horizontal' as const }]
    };

    expect(moveKeys(getLegalPawnMoves(diagonalJump, 'host'))).toEqual(['3:3', '3:5', '4:3', '4:5', '5:4']);
  });

  it('rejects walls that overlap, cross, or remove every path to a goal', () => {
    const snapshot = createInitialQuoridorSnapshot(['host', 'guest'], 2);
    const firstWall = applyQuoridorAction(snapshot, 'host', {
      type: 'place-wall',
      wall: { row: 7, col: 4, orientation: 'horizontal' }
    });

    if (!firstWall.ok) {
      throw new Error('expected first wall to be legal');
    }

    const overlappingWall = applyQuoridorAction(firstWall.snapshot, 'guest', {
      type: 'place-wall',
      wall: { row: 7, col: 5, orientation: 'horizontal' }
    });
    const crossingWall = applyQuoridorAction(firstWall.snapshot, 'guest', {
      type: 'place-wall',
      wall: { row: 7, col: 4, orientation: 'vertical' }
    });

    expect(overlappingWall.ok).toBe(false);
    expect(crossingWall.ok).toBe(false);

    const nearlyBlocked = createInitialQuoridorSnapshot(['host', 'guest'], 2);
    nearlyBlocked.walls = [
      { row: 7, col: 0, orientation: 'horizontal' },
      { row: 7, col: 2, orientation: 'horizontal' },
      { row: 7, col: 4, orientation: 'horizontal' },
      { row: 7, col: 6, orientation: 'horizontal' }
    ];

    expect(canPlaceQuoridorWall(nearlyBlocked, { row: 7, col: 7, orientation: 'vertical' })).toBe(false);
  });

  it('declares a winner when a pawn reaches its goal edge', () => {
    const snapshot = createInitialQuoridorSnapshot(['host', 'guest'], 2);
    snapshot.players[0]!.position = { row: 1, col: 4 };
    snapshot.players[1]!.position = { row: 0, col: 0 };
    snapshot.turnPlayerName = 'host';

    const result = applyQuoridorAction(snapshot, 'host', {
      type: 'move-pawn',
      to: { row: 0, col: 4 }
    });

    if (!result.ok) {
      throw new Error('expected winning move to be legal');
    }

    expect(result.snapshot.winnerPlayerName).toBe('host');
    expect(result.snapshot.turnPlayerName).toBe('host');
  });
});
