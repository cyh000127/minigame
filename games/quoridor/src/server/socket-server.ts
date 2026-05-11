import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import {
  entryIntentPayloadSchema,
  eventNames,
  quoridorActionIntentPayloadSchema,
  quoridorActionRejectedPayloadSchema,
  reasonCodes,
  roomJoinRejectedPayloadSchema,
  roomRestartIntentPayloadSchema,
  roomRestartRejectedPayloadSchema,
  roomStartIntentPayloadSchema,
  roomStartRejectedPayloadSchema,
  type RoomJoinAcceptedPayload
} from '../shared/index.js';
import { QuoridorRoomService } from './room-service.js';

export interface SocketServerEnv {
  clientOrigin: string;
}

function sanitizeRejectedField(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim().slice(0, 24);

  return normalizedValue || fallback;
}

function extractRoomNameFromPayload(payload: unknown): unknown {
  return typeof payload === 'object' && payload !== null ? (payload as { roomName?: unknown }).roomName : undefined;
}

function deliverRoomSnapshot(
  io: SocketIOServer,
  delivery: {
    socketId: string;
    payload: RoomJoinAcceptedPayload;
  }
) {
  const targetSocket = io.sockets.sockets.get(delivery.socketId);

  if (!targetSocket) {
    return;
  }

  targetSocket.join(delivery.payload.room.roomName);
  targetSocket.emit(eventNames.roomJoined, delivery.payload);
}

function buildInvalidJoinRejectedPayload(payload: unknown) {
  const candidate =
    typeof payload === 'object' && payload !== null ? (payload as { roomName?: unknown; playerName?: unknown }) : {};

  return roomJoinRejectedPayloadSchema.parse({
    roomName: sanitizeRejectedField(candidate.roomName, 'invalid-room'),
    playerName: sanitizeRejectedField(candidate.playerName, 'invalid-player'),
    reasonCode: reasonCodes.invalidEntryDraft,
    message: 'Choose Create Room or Join Room, then enter a valid room and player name.'
  });
}

function buildInvalidStartRejectedPayload(payload: unknown) {
  return roomStartRejectedPayloadSchema.parse({
    roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
    playerName: 'unknown-player',
    reasonCode: reasonCodes.invalidEntryDraft,
    message: 'A valid room name is required before starting.'
  });
}

function buildInvalidRestartRejectedPayload(payload: unknown) {
  return roomRestartRejectedPayloadSchema.parse({
    roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
    playerName: 'unknown-player',
    reasonCode: reasonCodes.invalidEntryDraft,
    message: 'A valid room name is required before restarting.'
  });
}

function buildInvalidQuoridorActionRejectedPayload(payload: unknown) {
  return quoridorActionRejectedPayloadSchema.parse({
    roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
    playerName: 'unknown-player',
    reasonCode: reasonCodes.invalidQuoridorAction,
    message: 'A valid room name and Quoridor action are required before moving.'
  });
}

function emitFatalSocketRejection(socket: Socket, eventName: string, payload: unknown) {
  const message = 'The server hit an unexpected error while handling this request.';

  if (eventName === eventNames.roomJoin) {
    socket.emit(
      eventNames.roomJoinRejected,
      roomJoinRejectedPayloadSchema.parse({
        roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
        playerName: 'unknown-player',
        reasonCode: reasonCodes.transportUnavailable,
        message
      })
    );
    return;
  }

  if (eventName === eventNames.roomStart) {
    socket.emit(
      eventNames.roomStartRejected,
      roomStartRejectedPayloadSchema.parse({
        roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
        playerName: 'unknown-player',
        reasonCode: reasonCodes.transportUnavailable,
        message
      })
    );
    return;
  }

  if (eventName === eventNames.roomRestart) {
    socket.emit(
      eventNames.roomRestartRejected,
      roomRestartRejectedPayloadSchema.parse({
        roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
        playerName: 'unknown-player',
        reasonCode: reasonCodes.transportUnavailable,
        message
      })
    );
    return;
  }

  if (eventName === eventNames.quoridorAction) {
    socket.emit(
      eventNames.quoridorActionRejected,
      quoridorActionRejectedPayloadSchema.parse({
        roomName: sanitizeRejectedField(extractRoomNameFromPayload(payload), 'invalid-room'),
        playerName: 'unknown-player',
        reasonCode: reasonCodes.transportUnavailable,
        message
      })
    );
  }
}

function createAllowedOrigins(clientOrigin: string): string[] | string {
  if (clientOrigin === '*') {
    return '*';
  }

  return Array.from(new Set([clientOrigin, 'http://localhost:5174', 'http://127.0.0.1:5174']));
}

export function createSocketServer(httpServer: HttpServer, env: SocketServerEnv): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: createAllowedOrigins(env.clientOrigin),
      methods: ['GET', 'POST']
    }
  });
  const roomService = new QuoridorRoomService();

  io.on('connection', (socket) => {
    function onSocketEvent(eventName: string, handler: (payload: unknown) => void) {
      socket.on(eventName, (payload) => {
        try {
          handler(payload);
        } catch (error: unknown) {
          console.error('Fatal socket handler error', {
            eventName,
            socketId: socket.id,
            error
          });
          emitFatalSocketRejection(socket, eventName, payload);
        }
      });
    }

    onSocketEvent(eventNames.roomJoin, (payload) => {
      const parsedPayload = entryIntentPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        socket.emit(eventNames.roomJoinRejected, buildInvalidJoinRejectedPayload(payload));
        return;
      }

      const joinResult = roomService.joinRoom(parsedPayload.data, socket.id);

      if (joinResult.leftRoomName) {
        socket.leave(joinResult.leftRoomName);
        joinResult.leftRoomRemoval?.deliveries.forEach((delivery) => {
          deliverRoomSnapshot(io, delivery);
        });
      }

      if (!joinResult.ok) {
        socket.emit(eventNames.roomJoinRejected, roomJoinRejectedPayloadSchema.parse(joinResult.payload));
        return;
      }

      joinResult.deliveries.forEach((delivery) => {
        deliverRoomSnapshot(io, delivery);
      });
    });

    onSocketEvent(eventNames.roomStart, (payload) => {
      const parsedPayload = roomStartIntentPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        socket.emit(eventNames.roomStartRejected, buildInvalidStartRejectedPayload(payload));
        return;
      }

      const startResult = roomService.startRoom(parsedPayload.data, socket.id);

      if (!startResult.ok) {
        socket.emit(eventNames.roomStartRejected, roomStartRejectedPayloadSchema.parse(startResult.payload));
        return;
      }

      startResult.deliveries.forEach((delivery) => {
        deliverRoomSnapshot(io, delivery);
      });
    });

    onSocketEvent(eventNames.roomRestart, (payload) => {
      const parsedPayload = roomRestartIntentPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        socket.emit(eventNames.roomRestartRejected, buildInvalidRestartRejectedPayload(payload));
        return;
      }

      const restartResult = roomService.restartRoom(parsedPayload.data, socket.id);

      if (!restartResult.ok) {
        socket.emit(eventNames.roomRestartRejected, roomRestartRejectedPayloadSchema.parse(restartResult.payload));
        return;
      }

      restartResult.deliveries.forEach((delivery) => {
        deliverRoomSnapshot(io, delivery);
      });
    });

    onSocketEvent(eventNames.quoridorAction, (payload) => {
      const parsedPayload = quoridorActionIntentPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        socket.emit(eventNames.quoridorActionRejected, buildInvalidQuoridorActionRejectedPayload(payload));
        return;
      }

      const actionResult = roomService.applyQuoridorAction(parsedPayload.data, socket.id);

      if (!actionResult.ok) {
        socket.emit(eventNames.quoridorActionRejected, quoridorActionRejectedPayloadSchema.parse(actionResult.payload));
        return;
      }

      actionResult.deliveries.forEach((delivery) => {
        deliverRoomSnapshot(io, delivery);
      });
    });

    socket.on('disconnect', () => {
      const previousRoomName = roomService.getRoomNameForSocket(socket.id);
      const removalResult = roomService.removeSocket(socket.id);

      removalResult?.deliveries.forEach((delivery) => {
        deliverRoomSnapshot(io, delivery);
      });

      if (previousRoomName) {
        socket.leave(previousRoomName);
      }
    });
  });

  return io;
}
