import {
  applyQuoridorAction as applyQuoridorEngineAction,
  createInitialQuoridorSnapshot,
  reasonCodes,
  type EntryIntentPayload,
  type QuoridorActionIntentPayload,
  type QuoridorActionRejectedPayload,
  type QuoridorPlayerCount,
  type QuoridorSnapshot,
  type RejectedIntentPayload,
  type RoomJoinAcceptedPayload,
  type RoomJoinRejectedPayload,
  type RoomPhase,
  type RoomRestartIntentPayload,
  type RoomRestartRejectedPayload,
  type RoomSnapshot,
  type RoomStartIntentPayload,
  type RoomStartRejectedPayload
} from '../shared/index.js';

interface StoredPlayer {
  playerName: string;
  normalizedPlayerName: string;
  socketId: string;
}

interface StoredRoom {
  roomName: string;
  normalizedRoomName: string;
  roomPhase: RoomPhase;
  playerCount: QuoridorPlayerCount;
  hostSocketId: string;
  players: StoredPlayer[];
  quoridor: QuoridorSnapshot | null;
  winnerPlayerName: string | null;
  restartAuthorityPlayerName: string | null;
}

interface Delivery {
  socketId: string;
  payload: RoomJoinAcceptedPayload;
}

type RemoveSocketResult =
  | {
      roomName: string;
      departingPlayerName: string | null;
      hostTransferred: boolean;
      nextHostPlayerName: string | null;
      deliveries: Delivery[];
    }
  | null;

type JoinRoomResult =
  | {
      ok: true;
      roomCreated: boolean;
      leftRoomName: string | null;
      leftRoomRemoval: Exclude<RemoveSocketResult, null> | null;
      deliveries: Delivery[];
    }
  | {
      ok: false;
      leftRoomName: string | null;
      leftRoomRemoval: Exclude<RemoveSocketResult, null> | null;
      payload: RoomJoinRejectedPayload;
    };

type StartRoomResult =
  | {
      ok: true;
      deliveries: Delivery[];
    }
  | {
      ok: false;
      payload: RoomStartRejectedPayload;
    };

type RestartRoomResult =
  | {
      ok: true;
      deliveries: Delivery[];
    }
  | {
      ok: false;
      payload: RoomRestartRejectedPayload;
    };

type ApplyQuoridorRoomActionResult =
  | {
      ok: true;
      deliveries: Delivery[];
    }
  | {
      ok: false;
      payload: QuoridorActionRejectedPayload;
    };

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function trimEntry(value: string): string {
  return value.trim();
}

function createRejectedPayload(
  roomName: string,
  playerName: string,
  reasonCode: RejectedIntentPayload['reasonCode'],
  message: string
): RejectedIntentPayload {
  return {
    roomName: trimEntry(roomName) || 'invalid-room',
    playerName: trimEntry(playerName) || 'unknown-player',
    reasonCode,
    message
  };
}

function resolveHostSocketId(room: StoredRoom): string {
  if (room.players.some((player) => player.socketId === room.hostSocketId)) {
    return room.hostSocketId;
  }

  return room.players[0]?.socketId ?? '';
}

function resolveDeterministicPlayerName(room: StoredRoom): string | null {
  return room.players[0]?.playerName ?? null;
}

function isPlayerStillInRoom(room: StoredRoom, playerName: string | null): boolean {
  if (!playerName) {
    return false;
  }

  return room.players.some((player) => player.normalizedPlayerName === normalizeLookupKey(playerName));
}

export class QuoridorRoomService {
  private readonly rooms = new Map<string, StoredRoom>();
  private readonly socketIndex = new Map<string, string>();

  getRoomNameForSocket(socketId: string): string | null {
    const normalizedRoomName = this.socketIndex.get(socketId);
    const room = normalizedRoomName ? this.rooms.get(normalizedRoomName) : null;

    return room?.roomName ?? null;
  }

  getPlayerNameForSocket(socketId: string): string | null {
    const normalizedRoomName = this.socketIndex.get(socketId);
    const room = normalizedRoomName ? this.rooms.get(normalizedRoomName) : null;

    return room?.players.find((player) => player.socketId === socketId)?.playerName ?? null;
  }

  getRoomSnapshot(roomName: string): RoomSnapshot | null {
    const room = this.rooms.get(normalizeLookupKey(roomName));

    return room ? this.buildSnapshot(room) : null;
  }

  joinRoom(payload: EntryIntentPayload, socketId: string): JoinRoomResult {
    const roomName = trimEntry(payload.roomName);
    const playerName = trimEntry(payload.playerName);
    const normalizedRoomName = normalizeLookupKey(roomName);
    const normalizedPlayerName = normalizeLookupKey(playerName);
    const previousRoomName = this.socketIndex.get(socketId) ?? null;
    let room = this.rooms.get(normalizedRoomName);
    const roomCreated = !room;

    if (payload.entryMode === 'create-room' && room) {
      return {
        ok: false,
        leftRoomName: null,
        leftRoomRemoval: null,
        payload: createRejectedPayload(
          roomName,
          playerName,
          reasonCodes.roomNameUnavailable,
          `${room.roomName} already exists. Join the room or choose a different room name.`
        )
      };
    }

    if (payload.entryMode === 'join-room' && !room) {
      return {
        ok: false,
        leftRoomName: null,
        leftRoomRemoval: null,
        payload: createRejectedPayload(
          roomName,
          playerName,
          reasonCodes.roomNameUnavailable,
          `${roomName} does not exist yet. Create the room first.`
        )
      };
    }

    if (payload.entryMode === 'create-room' && payload.playerCount == null) {
      return {
        ok: false,
        leftRoomName: null,
        leftRoomRemoval: null,
        payload: createRejectedPayload(
          roomName,
          playerName,
          reasonCodes.invalidEntryDraft,
          'Choose 2 players or 4 players before creating a room.'
        )
      };
    }

    if (!room && payload.entryMode === 'create-room') {
      const playerCount = payload.playerCount;

      if (playerCount == null) {
        throw new Error('Create-room payload passed validation without a player count.');
      }

      room = {
        roomName,
        normalizedRoomName,
        roomPhase: 'lobby',
        playerCount,
        hostSocketId: socketId,
        players: [],
        quoridor: null,
        winnerPlayerName: null,
        restartAuthorityPlayerName: null
      };
    }

    if (!room) {
      throw new Error('Expected create-room to initialize a room or join-room to resolve one.');
    }

    if (room.roomPhase !== 'lobby') {
      return {
        ok: false,
        leftRoomName: null,
        leftRoomRemoval: null,
        payload: createRejectedPayload(
          roomName,
          playerName,
          reasonCodes.roomNameUnavailable,
          `${room.roomName} is already in progress. Create or join a lobby room instead.`
        )
      };
    }

    if (room.players.some((player) => player.normalizedPlayerName === normalizedPlayerName)) {
      return {
        ok: false,
        leftRoomName: null,
        leftRoomRemoval: null,
        payload: createRejectedPayload(
          roomName,
          playerName,
          reasonCodes.duplicatePlayerName,
          `${playerName} is already seated in ${room.roomName}.`
        )
      };
    }

    if (room.players.length >= room.playerCount) {
      return {
        ok: false,
        leftRoomName: null,
        leftRoomRemoval: null,
        payload: createRejectedPayload(
          roomName,
          playerName,
          reasonCodes.roomCapacityReached,
          `${room.roomName} already has ${room.playerCount} players.`
        )
      };
    }

    const leftRoomRemoval = previousRoomName ? this.removeSocket(socketId) : null;

    room.players.push({
      playerName,
      normalizedPlayerName,
      socketId
    });
    room.hostSocketId = resolveHostSocketId(room) || socketId;
    this.rooms.set(normalizedRoomName, room);
    this.socketIndex.set(socketId, normalizedRoomName);

    return {
      ok: true,
      roomCreated,
      leftRoomName: previousRoomName,
      leftRoomRemoval,
      deliveries: this.buildDeliveries(room)
    };
  }

  removeSocket(socketId: string): RemoveSocketResult {
    const normalizedRoomName = this.socketIndex.get(socketId);

    if (!normalizedRoomName) {
      return null;
    }

    this.socketIndex.delete(socketId);
    const room = this.rooms.get(normalizedRoomName);

    if (!room) {
      return null;
    }

    const departingPlayer = room.players.find((player) => player.socketId === socketId) ?? null;
    const hostTransferred = room.hostSocketId === socketId;
    room.players = room.players.filter((player) => player.socketId !== socketId);

    if (room.players.length === 0) {
      this.rooms.delete(normalizedRoomName);
      return null;
    }

    if (hostTransferred) {
      room.hostSocketId = room.players[0]?.socketId ?? '';
    }

    if (room.roomPhase === 'in-game') {
      room.roomPhase = 'result';
      room.winnerPlayerName = resolveDeterministicPlayerName(room);
      room.restartAuthorityPlayerName = room.winnerPlayerName;

      if (room.quoridor && room.winnerPlayerName) {
        room.quoridor = {
          ...room.quoridor,
          winnerPlayerName: room.winnerPlayerName,
          turnPlayerName: room.winnerPlayerName
        };
      }
    } else if (room.roomPhase === 'result' || room.roomPhase === 'restart-pending') {
      if (!isPlayerStillInRoom(room, room.restartAuthorityPlayerName)) {
        room.roomPhase = 'restart-pending';
        room.restartAuthorityPlayerName = resolveDeterministicPlayerName(room);
      }
    }

    this.rooms.set(normalizedRoomName, room);

    return {
      roomName: room.roomName,
      departingPlayerName: departingPlayer?.playerName ?? null,
      hostTransferred,
      nextHostPlayerName: room.players.find((player) => player.socketId === room.hostSocketId)?.playerName ?? null,
      deliveries: this.buildDeliveries(room)
    };
  }

  startRoom(payload: RoomStartIntentPayload, socketId: string): StartRoomResult {
    const room = this.resolveSocketRoom(payload.roomName, socketId);
    const playerName = this.getPlayerNameForSocket(socketId) ?? 'unknown-player';

    if (!room) {
      return {
        ok: false,
        payload: createRejectedPayload(
          payload.roomName,
          playerName,
          reasonCodes.startAuthorityRequired,
          'Only players inside the room can start it.'
        )
      };
    }

    if (room.hostSocketId !== socketId) {
      return {
        ok: false,
        payload: createRejectedPayload(
          room.roomName,
          playerName,
          reasonCodes.startAuthorityRequired,
          'Only the host can start the Quoridor round.'
        )
      };
    }

    if (room.roomPhase !== 'lobby' || room.players.length !== room.playerCount) {
      return {
        ok: false,
        payload: createRejectedPayload(
          room.roomName,
          playerName,
          reasonCodes.roomPhaseNotStartable,
          `${room.roomName} needs exactly ${room.playerCount} players before starting.`
        )
      };
    }

    room.roomPhase = 'in-game';
    room.quoridor = createInitialQuoridorSnapshot(
      room.players.map((player) => player.playerName),
      room.playerCount
    );
    room.winnerPlayerName = null;
    room.restartAuthorityPlayerName = null;
    this.rooms.set(room.normalizedRoomName, room);

    return {
      ok: true,
      deliveries: this.buildDeliveries(room)
    };
  }

  restartRoom(payload: RoomRestartIntentPayload, socketId: string): RestartRoomResult {
    const room = this.resolveSocketRoom(payload.roomName, socketId);
    const playerName = this.getPlayerNameForSocket(socketId) ?? 'unknown-player';
    const currentPlayerCanRestart =
      room != null &&
      room.restartAuthorityPlayerName != null &&
      normalizeLookupKey(playerName) === normalizeLookupKey(room.restartAuthorityPlayerName);

    if (!room) {
      return {
        ok: false,
        payload: createRejectedPayload(
          payload.roomName,
          playerName,
          reasonCodes.restartAuthorityRequired,
          'Only players inside the room can restart it.'
        )
      };
    }

    if (
      (room.roomPhase !== 'result' && room.roomPhase !== 'restart-pending') ||
      room.quoridor?.winnerPlayerName == null
    ) {
      return {
        ok: false,
        payload: createRejectedPayload(
          room.roomName,
          playerName,
          reasonCodes.roomPhaseNotRestartable,
          `${room.roomName} can restart after the current round has a winner.`
        )
      };
    }

    if (!currentPlayerCanRestart) {
      return {
        ok: false,
        payload: createRejectedPayload(
          room.roomName,
          playerName,
          reasonCodes.restartAuthorityRequired,
          'Only the current restart authority can start the next round.'
        )
      };
    }

    if (room.players.length !== room.playerCount) {
      return {
        ok: false,
        payload: createRejectedPayload(
          room.roomName,
          playerName,
          reasonCodes.roomPhaseNotRestartable,
          `${room.roomName} needs exactly ${room.playerCount} players before restarting.`
        )
      };
    }

    room.roomPhase = 'in-game';
    room.quoridor = createInitialQuoridorSnapshot(
      room.players.map((player) => player.playerName),
      room.playerCount
    );
    room.winnerPlayerName = null;
    room.restartAuthorityPlayerName = null;
    this.rooms.set(room.normalizedRoomName, room);

    return {
      ok: true,
      deliveries: this.buildDeliveries(room)
    };
  }

  applyQuoridorAction(payload: QuoridorActionIntentPayload, socketId: string): ApplyQuoridorRoomActionResult {
    const room = this.resolveSocketRoom(payload.roomName, socketId);
    const playerName = this.getPlayerNameForSocket(socketId) ?? 'unknown-player';

    if (!room || room.roomPhase !== 'in-game' || room.quoridor == null) {
      return {
        ok: false,
        payload: createRejectedPayload(
          payload.roomName,
          playerName,
          reasonCodes.invalidQuoridorAction,
          'Quoridor actions can only be applied to an active room.'
        )
      };
    }

    const actionResult = applyQuoridorEngineAction(room.quoridor, playerName, payload.action);

    if (!actionResult.ok) {
      const reasonCode =
        actionResult.reason === 'not-player-turn'
          ? reasonCodes.quoridorTurnRequired
          : reasonCodes.invalidQuoridorAction;

      return {
        ok: false,
        payload: createRejectedPayload(
          room.roomName,
          playerName,
          reasonCode,
          reasonCode === reasonCodes.quoridorTurnRequired
            ? `It is ${room.quoridor.turnPlayerName}'s turn.`
            : 'That Quoridor move is not legal from the current board state.'
        )
      };
    }

    room.quoridor = actionResult.snapshot;

    if (room.quoridor.winnerPlayerName != null) {
      room.roomPhase = 'result';
      room.winnerPlayerName = room.quoridor.winnerPlayerName;
      room.restartAuthorityPlayerName = isPlayerStillInRoom(room, room.winnerPlayerName)
        ? room.winnerPlayerName
        : resolveDeterministicPlayerName(room);
    }

    this.rooms.set(room.normalizedRoomName, room);

    return {
      ok: true,
      deliveries: this.buildDeliveries(room)
    };
  }

  private resolveSocketRoom(roomName: string, socketId: string): StoredRoom | null {
    const normalizedRoomName = normalizeLookupKey(roomName);
    const indexedRoomName = this.socketIndex.get(socketId);

    if (indexedRoomName !== normalizedRoomName) {
      return null;
    }

    return this.rooms.get(normalizedRoomName) ?? null;
  }

  private buildSnapshot(room: StoredRoom): RoomSnapshot {
    const hostSocketId = resolveHostSocketId(room);
    const hostPlayer = room.players.find((player) => player.socketId === hostSocketId) ?? room.players[0];

    return {
      roomName: room.roomName,
      roomPhase: room.roomPhase,
      playerCount: room.playerCount,
      hostPlayerName: hostPlayer?.playerName ?? '',
      players: room.players.map((player) => ({
        playerName: player.playerName,
        role: player.socketId === hostSocketId ? 'host' : 'player'
      })),
      quoridor: room.quoridor,
      winnerPlayerName: room.winnerPlayerName,
      restartAuthorityPlayerName: room.restartAuthorityPlayerName,
      joinAllowed: room.roomPhase === 'lobby'
    };
  }

  private buildDeliveries(room: StoredRoom): Delivery[] {
    return room.players.map((player) => ({
      socketId: player.socketId,
      payload: {
        viewerPlayerName: player.playerName,
        room: this.buildSnapshot(room)
      }
    }));
  }
}
