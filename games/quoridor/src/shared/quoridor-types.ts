export const quoridorBoardSize = 9 as const;
export const quoridorPlayerCounts = [2, 4] as const;
export const quoridorWallOrientations = ['horizontal', 'vertical'] as const;
export const quoridorGoalEdges = ['top', 'bottom', 'left', 'right'] as const;

export const eventNames = {
  roomJoin: 'room:join',
  roomJoined: 'room:joined',
  roomJoinRejected: 'room:join-rejected',
  roomStart: 'room:start',
  roomStartRejected: 'room:start-rejected',
  roomRestart: 'room:restart',
  roomRestartRejected: 'room:restart-rejected',
  quoridorAction: 'quoridor:action',
  quoridorActionRejected: 'quoridor:action-rejected'
} as const;

export const reasonCodes = {
  duplicatePlayerName: 'duplicate-player-name',
  invalidEntryDraft: 'invalid-entry-draft',
  invalidQuoridorAction: 'invalid-quoridor-action',
  quoridorTurnRequired: 'quoridor-turn-required',
  restartAuthorityRequired: 'restart-authority-required',
  roomCapacityReached: 'room-capacity-reached',
  roomNameUnavailable: 'room-name-unavailable',
  roomPhaseNotRestartable: 'room-phase-not-restartable',
  roomPhaseNotStartable: 'room-phase-not-startable',
  startAuthorityRequired: 'start-authority-required',
  transportUnavailable: 'transport-unavailable'
} as const;

export type QuoridorPlayerCount = (typeof quoridorPlayerCounts)[number];
export type QuoridorWallOrientation = (typeof quoridorWallOrientations)[number];
export type QuoridorGoalEdge = (typeof quoridorGoalEdges)[number];
export type QuoridorActionType = 'move-pawn' | 'place-wall';
export type EntryMode = 'create-room' | 'join-room';
export type RoomPhase = 'lobby' | 'in-game' | 'result' | 'restart-pending';
export type ReasonCode = (typeof reasonCodes)[keyof typeof reasonCodes];

export interface QuoridorPosition {
  row: number;
  col: number;
}

export interface QuoridorWall {
  row: number;
  col: number;
  orientation: QuoridorWallOrientation;
}

export interface QuoridorPlayerState {
  playerName: string;
  position: QuoridorPosition;
  goalEdge: QuoridorGoalEdge;
  wallsRemaining: number;
}

export interface QuoridorLastAction {
  playerName: string;
  actionType: QuoridorActionType;
  destination?: QuoridorPosition;
  wall?: QuoridorWall;
}

export interface QuoridorSnapshot {
  boardSize: typeof quoridorBoardSize;
  playerCount: QuoridorPlayerCount;
  players: QuoridorPlayerState[];
  walls: QuoridorWall[];
  turnPlayerName: string;
  winnerPlayerName: string | null;
  lastAction: QuoridorLastAction | null;
}

export interface QuoridorMovePawnAction {
  type: 'move-pawn';
  to: QuoridorPosition;
}

export interface QuoridorPlaceWallAction {
  type: 'place-wall';
  wall: QuoridorWall;
}

export type QuoridorAction = QuoridorMovePawnAction | QuoridorPlaceWallAction;

export interface RoomPlayerSummary {
  playerName: string;
  role: 'host' | 'player';
}

export interface RoomSnapshot {
  roomName: string;
  roomPhase: RoomPhase;
  playerCount: QuoridorPlayerCount;
  hostPlayerName: string;
  players: RoomPlayerSummary[];
  quoridor: QuoridorSnapshot | null;
  winnerPlayerName: string | null;
  restartAuthorityPlayerName: string | null;
  joinAllowed: boolean;
}

export interface EntryIntentPayload {
  roomName: string;
  playerName: string;
  entryMode: EntryMode;
  playerCount?: QuoridorPlayerCount;
}

export interface RoomJoinAcceptedPayload {
  viewerPlayerName: string;
  room: RoomSnapshot;
}

export interface RejectedIntentPayload {
  roomName: string;
  playerName: string;
  reasonCode: ReasonCode;
  message: string;
}

export type RoomJoinRejectedPayload = RejectedIntentPayload;
export type RoomStartRejectedPayload = RejectedIntentPayload;
export type RoomRestartRejectedPayload = RejectedIntentPayload;

export interface RoomStartIntentPayload {
  roomName: string;
}

export interface RoomRestartIntentPayload {
  roomName: string;
}

export interface QuoridorActionIntentPayload {
  roomName: string;
  action: QuoridorAction;
}

export type QuoridorActionRejectedPayload = RejectedIntentPayload;
