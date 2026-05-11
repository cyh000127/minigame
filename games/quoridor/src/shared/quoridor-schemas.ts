import { z } from 'zod';
import {
  quoridorBoardSize,
  quoridorGoalEdges,
  quoridorPlayerCounts,
  quoridorWallOrientations,
  reasonCodes
} from './quoridor-types.js';

const entryFieldSchema = z
  .string()
  .trim()
  .min(1, 'Entry fields must not be blank')
  .max(24, 'Entry fields stay short and readable');

const reasonCodeValues = Object.values(reasonCodes) as [
  (typeof reasonCodes)[keyof typeof reasonCodes],
  ...(typeof reasonCodes)[keyof typeof reasonCodes][]
];

export const reasonCodeSchema = z.enum(reasonCodeValues);

export const quoridorPlayerCountSchema = z.union([
  z.literal(quoridorPlayerCounts[0]),
  z.literal(quoridorPlayerCounts[1])
]);

export const quoridorPositionSchema = z.object({
  row: z.number().int().min(0).max(quoridorBoardSize - 1),
  col: z.number().int().min(0).max(quoridorBoardSize - 1)
});

export const quoridorWallSchema = z.object({
  row: z.number().int().min(0).max(quoridorBoardSize - 2),
  col: z.number().int().min(0).max(quoridorBoardSize - 2),
  orientation: z.enum(quoridorWallOrientations)
});

export const quoridorPlayerStateSchema = z.object({
  playerName: entryFieldSchema,
  position: quoridorPositionSchema,
  goalEdge: z.enum(quoridorGoalEdges),
  wallsRemaining: z.number().int().min(0).max(10)
});

export const quoridorLastActionSchema = z
  .object({
    playerName: entryFieldSchema,
    actionType: z.enum(['move-pawn', 'place-wall']),
    destination: quoridorPositionSchema.optional(),
    wall: quoridorWallSchema.optional()
  })
  .superRefine((lastAction, ctx) => {
    if (lastAction.actionType === 'move-pawn' && !lastAction.destination) {
      ctx.addIssue({
        code: 'custom',
        message: 'Move actions must preserve the destination position',
        path: ['destination']
      });
    }

    if (lastAction.actionType === 'place-wall' && !lastAction.wall) {
      ctx.addIssue({
        code: 'custom',
        message: 'Wall actions must preserve the placed wall',
        path: ['wall']
      });
    }
  });

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function wallSignature(wall: z.infer<typeof quoridorWallSchema>): string {
  return `${wall.orientation}:${wall.row}:${wall.col}`;
}

function positionSignature(position: z.infer<typeof quoridorPositionSchema>): string {
  return `${position.row}:${position.col}`;
}

export const quoridorSnapshotSchema = z
  .object({
    boardSize: z.literal(quoridorBoardSize),
    playerCount: quoridorPlayerCountSchema,
    players: z.array(quoridorPlayerStateSchema).min(2).max(4),
    walls: z.array(quoridorWallSchema),
    turnPlayerName: entryFieldSchema,
    winnerPlayerName: entryFieldSchema.nullable(),
    lastAction: quoridorLastActionSchema.nullable()
  })
  .superRefine((snapshot, ctx) => {
    if (snapshot.players.length !== snapshot.playerCount) {
      ctx.addIssue({
        code: 'custom',
        message: 'Quoridor snapshots must include exactly the selected player count',
        path: ['players']
      });
    }

    const playerNames = new Set<string>();
    const positions = new Set<string>();

    snapshot.players.forEach((player, index) => {
      const playerKey = normalizeLookupKey(player.playerName);

      if (playerNames.has(playerKey)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Quoridor player names must be unique',
          path: ['players', index, 'playerName']
        });
      }

      playerNames.add(playerKey);

      const positionKey = positionSignature(player.position);

      if (positions.has(positionKey)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Quoridor players must not occupy the same board cell',
          path: ['players', index, 'position']
        });
      }

      positions.add(positionKey);

      const expectedWallLimit = snapshot.playerCount === 2 ? 10 : 5;

      if (player.wallsRemaining > expectedWallLimit) {
        ctx.addIssue({
          code: 'custom',
          message: 'Quoridor player wall counts must fit the selected player count',
          path: ['players', index, 'wallsRemaining']
        });
      }
    });

    if (!playerNames.has(normalizeLookupKey(snapshot.turnPlayerName))) {
      ctx.addIssue({
        code: 'custom',
        message: 'turnPlayerName must match a player in the Quoridor snapshot',
        path: ['turnPlayerName']
      });
    }

    if (snapshot.winnerPlayerName != null && !playerNames.has(normalizeLookupKey(snapshot.winnerPlayerName))) {
      ctx.addIssue({
        code: 'custom',
        message: 'winnerPlayerName must match a player in the Quoridor snapshot',
        path: ['winnerPlayerName']
      });
    }

    const wallSignatures = new Set<string>();

    snapshot.walls.forEach((wall, index) => {
      const signature = wallSignature(wall);

      if (wallSignatures.has(signature)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Quoridor walls must be unique',
          path: ['walls', index]
        });
      }

      wallSignatures.add(signature);
    });
  });

export const roomPlayerSummarySchema = z.object({
  playerName: entryFieldSchema,
  role: z.enum(['host', 'player'])
});

export const roomSnapshotSchema = z.object({
  roomName: entryFieldSchema,
  roomPhase: z.enum(['lobby', 'in-game', 'result', 'restart-pending']),
  playerCount: quoridorPlayerCountSchema,
  hostPlayerName: entryFieldSchema,
  players: z.array(roomPlayerSummarySchema).min(1).max(4),
  quoridor: quoridorSnapshotSchema.nullable(),
  winnerPlayerName: entryFieldSchema.nullable(),
  restartAuthorityPlayerName: entryFieldSchema.nullable(),
  joinAllowed: z.boolean()
});

export const entryIntentPayloadSchema = z
  .object({
    roomName: entryFieldSchema,
    playerName: entryFieldSchema,
    entryMode: z.enum(['create-room', 'join-room']),
    playerCount: quoridorPlayerCountSchema.optional()
  })
  .superRefine((payload, ctx) => {
    if (payload.entryMode === 'create-room' && payload.playerCount == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Create room requests must include a player count',
        path: ['playerCount']
      });
    }
  });

export const roomJoinAcceptedPayloadSchema = z.object({
  viewerPlayerName: entryFieldSchema,
  room: roomSnapshotSchema
});

const rejectedIntentPayloadSchema = z.object({
  roomName: entryFieldSchema,
  playerName: entryFieldSchema,
  reasonCode: reasonCodeSchema,
  message: z.string().trim().min(1)
});

export const roomJoinRejectedPayloadSchema = rejectedIntentPayloadSchema;
export const roomStartRejectedPayloadSchema = rejectedIntentPayloadSchema;
export const roomRestartRejectedPayloadSchema = rejectedIntentPayloadSchema;
export const quoridorActionRejectedPayloadSchema = rejectedIntentPayloadSchema;

export const roomStartIntentPayloadSchema = z.object({
  roomName: entryFieldSchema
});

export const roomRestartIntentPayloadSchema = z.object({
  roomName: entryFieldSchema
});

export const quoridorMovePawnActionSchema = z.object({
  type: z.literal('move-pawn'),
  to: quoridorPositionSchema
});

export const quoridorPlaceWallActionSchema = z.object({
  type: z.literal('place-wall'),
  wall: quoridorWallSchema
});

export const quoridorActionSchema = z.discriminatedUnion('type', [
  quoridorMovePawnActionSchema,
  quoridorPlaceWallActionSchema
]);

export const quoridorActionIntentPayloadSchema = z.object({
  roomName: entryFieldSchema,
  action: quoridorActionSchema
});
