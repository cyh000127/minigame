import { describe, expect, it } from 'vitest';
import { reasonCodes } from '../shared/index.js';
import { QuoridorRoomService } from './room-service.js';

function join(service: QuoridorRoomService, socketId: string, playerName: string) {
  return service.joinRoom(
    {
      roomName: 'arena',
      playerName,
      entryMode: socketId === 'socket-1' ? 'create-room' : 'join-room',
      ...(socketId === 'socket-1' ? { playerCount: 2 as const } : {})
    },
    socketId
  );
}

describe('QuoridorRoomService', () => {
  it('separates room creation from room entry', () => {
    const service = new QuoridorRoomService();
    const missingRoomJoin = service.joinRoom(
      {
        roomName: 'missing',
        playerName: 'guest',
        entryMode: 'join-room'
      },
      'socket-2'
    );

    expect(missingRoomJoin.ok).toBe(false);
    if (!missingRoomJoin.ok) {
      expect(missingRoomJoin.payload.reasonCode).toBe(reasonCodes.roomNameUnavailable);
    }

    const createdRoom = service.joinRoom(
      {
        roomName: 'arena',
        playerName: 'host',
        entryMode: 'create-room',
        playerCount: 2
      },
      'socket-1'
    );
    const duplicateCreate = service.joinRoom(
      {
        roomName: 'arena',
        playerName: 'other-host',
        entryMode: 'create-room',
        playerCount: 2
      },
      'socket-3'
    );

    expect(createdRoom.ok).toBe(true);
    expect(duplicateCreate.ok).toBe(false);
    if (!duplicateCreate.ok) {
      expect(duplicateCreate.payload.reasonCode).toBe(reasonCodes.roomNameUnavailable);
    }
  });

  it('creates a lobby, seats players, and starts a Quoridor snapshot', () => {
    const service = new QuoridorRoomService();
    const hostJoin = join(service, 'socket-1', 'host');
    const guestJoin = join(service, 'socket-2', 'guest');

    expect(hostJoin.ok).toBe(true);
    expect(guestJoin.ok).toBe(true);

    const startResult = service.startRoom({ roomName: 'arena' }, 'socket-1');

    expect(startResult.ok).toBe(true);
    if (!startResult.ok) {
      return;
    }

    const hostPayload = startResult.deliveries.find((delivery) => delivery.socketId === 'socket-1')?.payload;

    expect(hostPayload?.room.roomPhase).toBe('in-game');
    expect(hostPayload?.room.quoridor?.players.map((player) => player.playerName)).toEqual(['host', 'guest']);
  });

  it('rejects moves from players whose turn has not arrived', () => {
    const service = new QuoridorRoomService();

    join(service, 'socket-1', 'host');
    join(service, 'socket-2', 'guest');
    service.startRoom({ roomName: 'arena' }, 'socket-1');

    const result = service.applyQuoridorAction(
      {
        roomName: 'arena',
        action: {
          type: 'move-pawn',
          to: { row: 1, col: 4 }
        }
      },
      'socket-2'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.payload.reasonCode).toBe(reasonCodes.quoridorTurnRequired);
    }
  });

  it('moves the room to result when a player wins', () => {
    const service = new QuoridorRoomService();

    join(service, 'socket-1', 'host');
    join(service, 'socket-2', 'guest');
    service.startRoom({ roomName: 'arena' }, 'socket-1');

    const snapshot = service.getRoomSnapshot('arena');
    const game = snapshot?.quoridor;

    if (!game) {
      throw new Error('expected active Quoridor game');
    }

    game.players[0]!.position = { row: 1, col: 4 };
    game.players[1]!.position = { row: 0, col: 0 };
    game.turnPlayerName = 'host';

    const result = service.applyQuoridorAction(
      {
        roomName: 'arena',
        action: {
          type: 'move-pawn',
          to: { row: 0, col: 4 }
        }
      },
      'socket-1'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.deliveries[0]?.payload.room.roomPhase).toBe('result');
    expect(result.deliveries[0]?.payload.room.winnerPlayerName).toBe('host');
  });
});
