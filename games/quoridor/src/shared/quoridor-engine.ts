import {
  quoridorBoardSize,
  type QuoridorAction,
  type QuoridorGoalEdge,
  type QuoridorPlayerCount,
  type QuoridorPlayerState,
  type QuoridorPosition,
  type QuoridorSnapshot,
  type QuoridorWall
} from './quoridor-types.js';

export type QuoridorActionFailureReason =
  | 'game-finished'
  | 'invalid-action'
  | 'invalid-player-count'
  | 'no-path-to-goal'
  | 'not-player-turn'
  | 'player-not-found'
  | 'wall-unavailable';

export type ApplyQuoridorActionResult =
  | {
      ok: true;
      snapshot: QuoridorSnapshot;
    }
  | {
      ok: false;
      reason: QuoridorActionFailureReason;
    };

const PLAYER_SETUP: Record<QuoridorPlayerCount, Array<{ position: QuoridorPosition; goalEdge: QuoridorGoalEdge }>> = {
  2: [
    { position: { row: 8, col: 4 }, goalEdge: 'top' },
    { position: { row: 0, col: 4 }, goalEdge: 'bottom' }
  ],
  4: [
    { position: { row: 8, col: 4 }, goalEdge: 'top' },
    { position: { row: 0, col: 4 }, goalEdge: 'bottom' },
    { position: { row: 4, col: 0 }, goalEdge: 'right' },
    { position: { row: 4, col: 8 }, goalEdge: 'left' }
  ]
};

const CARDINAL_STEPS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 }
] as const;

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function clonePosition(position: QuoridorPosition): QuoridorPosition {
  return {
    row: position.row,
    col: position.col
  };
}

function cloneWall(wall: QuoridorWall): QuoridorWall {
  return {
    row: wall.row,
    col: wall.col,
    orientation: wall.orientation
  };
}

export function cloneQuoridorSnapshot(snapshot: QuoridorSnapshot): QuoridorSnapshot {
  return {
    boardSize: snapshot.boardSize,
    playerCount: snapshot.playerCount,
    players: snapshot.players.map((player) => ({
      playerName: player.playerName,
      position: clonePosition(player.position),
      goalEdge: player.goalEdge,
      wallsRemaining: player.wallsRemaining
    })),
    walls: snapshot.walls.map(cloneWall),
    turnPlayerName: snapshot.turnPlayerName,
    winnerPlayerName: snapshot.winnerPlayerName,
    lastAction: snapshot.lastAction
      ? {
          playerName: snapshot.lastAction.playerName,
          actionType: snapshot.lastAction.actionType,
          ...(snapshot.lastAction.destination ? { destination: clonePosition(snapshot.lastAction.destination) } : {}),
          ...(snapshot.lastAction.wall ? { wall: cloneWall(snapshot.lastAction.wall) } : {})
        }
      : null
  };
}

function isSupportedPlayerCount(playerCount: number): playerCount is QuoridorPlayerCount {
  return playerCount === 2 || playerCount === 4;
}

export function createInitialQuoridorSnapshot(
  playerNames: string[],
  playerCount: QuoridorPlayerCount = playerNames.length as QuoridorPlayerCount
): QuoridorSnapshot {
  if (!isSupportedPlayerCount(playerCount) || playerNames.length !== playerCount) {
    throw new Error('Quoridor requires exactly 2 or 4 players before the round can start.');
  }

  const setup = PLAYER_SETUP[playerCount];
  const initialWallsRemaining = playerCount === 2 ? 10 : 5;

  return {
    boardSize: quoridorBoardSize,
    playerCount,
    players: playerNames.map((playerName, index) => {
      const playerSetup = setup[index]!;

      return {
        playerName,
        position: clonePosition(playerSetup.position),
        goalEdge: playerSetup.goalEdge,
        wallsRemaining: initialWallsRemaining
      };
    }),
    walls: [],
    turnPlayerName: playerNames[0]!,
    winnerPlayerName: null,
    lastAction: null
  };
}

function isInsideBoard(position: QuoridorPosition): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < quoridorBoardSize &&
    position.col >= 0 &&
    position.col < quoridorBoardSize
  );
}

function isInsideWallGrid(wall: QuoridorWall): boolean {
  return (
    Number.isInteger(wall.row) &&
    Number.isInteger(wall.col) &&
    wall.row >= 0 &&
    wall.row < quoridorBoardSize - 1 &&
    wall.col >= 0 &&
    wall.col < quoridorBoardSize - 1
  );
}

function isSamePosition(left: QuoridorPosition, right: QuoridorPosition): boolean {
  return left.row === right.row && left.col === right.col;
}

function positionKey(position: QuoridorPosition): string {
  return `${position.row}:${position.col}`;
}

function addPositions(left: QuoridorPosition, right: QuoridorPosition): QuoridorPosition {
  return {
    row: left.row + right.row,
    col: left.col + right.col
  };
}

function isAdjacent(left: QuoridorPosition, right: QuoridorPosition): boolean {
  return Math.abs(left.row - right.row) + Math.abs(left.col - right.col) === 1;
}

function isGoalReached(position: QuoridorPosition, goalEdge: QuoridorGoalEdge): boolean {
  switch (goalEdge) {
    case 'top':
      return position.row === 0;
    case 'bottom':
      return position.row === quoridorBoardSize - 1;
    case 'left':
      return position.col === 0;
    case 'right':
      return position.col === quoridorBoardSize - 1;
  }
}

export function isQuoridorWon(snapshot: QuoridorSnapshot, playerName: string): boolean {
  const player = snapshot.players.find(
    (candidate) => normalizeLookupKey(candidate.playerName) === normalizeLookupKey(playerName)
  );

  return player ? isGoalReached(player.position, player.goalEdge) : false;
}

function isEdgeBlocked(from: QuoridorPosition, to: QuoridorPosition, walls: QuoridorWall[]): boolean {
  if (!isAdjacent(from, to)) {
    return true;
  }

  if (from.col === to.col) {
    const crossingRow = Math.min(from.row, to.row);

    return walls.some(
      (wall) =>
        wall.orientation === 'horizontal' &&
        wall.row === crossingRow &&
        from.col >= wall.col &&
        from.col <= wall.col + 1
    );
  }

  const crossingCol = Math.min(from.col, to.col);

  return walls.some(
    (wall) =>
      wall.orientation === 'vertical' &&
      wall.col === crossingCol &&
      from.row >= wall.row &&
      from.row <= wall.row + 1
  );
}

function getPlayerAt(snapshot: QuoridorSnapshot, position: QuoridorPosition): QuoridorPlayerState | null {
  return snapshot.players.find((player) => isSamePosition(player.position, position)) ?? null;
}

function hasWallConflict(existingWall: QuoridorWall, nextWall: QuoridorWall): boolean {
  if (existingWall.orientation === nextWall.orientation) {
    if (nextWall.orientation === 'horizontal') {
      return existingWall.row === nextWall.row && Math.abs(existingWall.col - nextWall.col) < 2;
    }

    return existingWall.col === nextWall.col && Math.abs(existingWall.row - nextWall.row) < 2;
  }

  return existingWall.row === nextWall.row && existingWall.col === nextWall.col;
}

function canPlaceWallShape(snapshot: QuoridorSnapshot, wall: QuoridorWall): boolean {
  return isInsideWallGrid(wall) && !snapshot.walls.some((existingWall) => hasWallConflict(existingWall, wall));
}

function getAdjacentOpenPositions(position: QuoridorPosition, walls: QuoridorWall[]): QuoridorPosition[] {
  return CARDINAL_STEPS.map((step) => addPositions(position, step)).filter(
    (nextPosition) => isInsideBoard(nextPosition) && !isEdgeBlocked(position, nextPosition, walls)
  );
}

export function hasPathToGoal(snapshot: QuoridorSnapshot, playerName: string): boolean {
  const player = snapshot.players.find(
    (candidate) => normalizeLookupKey(candidate.playerName) === normalizeLookupKey(playerName)
  );

  if (!player) {
    return false;
  }

  const visited = new Set<string>([positionKey(player.position)]);
  const queue = [player.position];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (isGoalReached(current, player.goalEdge)) {
      return true;
    }

    getAdjacentOpenPositions(current, snapshot.walls).forEach((nextPosition) => {
      const nextKey = positionKey(nextPosition);

      if (visited.has(nextKey)) {
        return;
      }

      visited.add(nextKey);
      queue.push(nextPosition);
    });
  }

  return false;
}

export function canPlaceQuoridorWall(snapshot: QuoridorSnapshot, wall: QuoridorWall): boolean {
  if (!canPlaceWallShape(snapshot, wall)) {
    return false;
  }

  const nextSnapshot = cloneQuoridorSnapshot(snapshot);
  nextSnapshot.walls.push(cloneWall(wall));

  return nextSnapshot.players.every((player) => hasPathToGoal(nextSnapshot, player.playerName));
}

export function getLegalPawnMoves(snapshot: QuoridorSnapshot, playerName: string): QuoridorPosition[] {
  const player = snapshot.players.find(
    (candidate) => normalizeLookupKey(candidate.playerName) === normalizeLookupKey(playerName)
  );

  if (!player || snapshot.winnerPlayerName != null) {
    return [];
  }

  const moves = new Map<string, QuoridorPosition>();

  CARDINAL_STEPS.forEach((step) => {
    const adjacentPosition = addPositions(player.position, step);

    if (!isInsideBoard(adjacentPosition) || isEdgeBlocked(player.position, adjacentPosition, snapshot.walls)) {
      return;
    }

    const adjacentPlayer = getPlayerAt(snapshot, adjacentPosition);

    if (!adjacentPlayer) {
      moves.set(positionKey(adjacentPosition), adjacentPosition);
      return;
    }

    const jumpPosition = addPositions(adjacentPosition, step);

    if (
      isInsideBoard(jumpPosition) &&
      !getPlayerAt(snapshot, jumpPosition) &&
      !isEdgeBlocked(adjacentPosition, jumpPosition, snapshot.walls)
    ) {
      moves.set(positionKey(jumpPosition), jumpPosition);
      return;
    }

    const diagonalSteps =
      step.row !== 0
        ? [
            { row: 0, col: -1 },
            { row: 0, col: 1 }
          ]
        : [
            { row: -1, col: 0 },
            { row: 1, col: 0 }
          ];

    diagonalSteps.forEach((diagonalStep) => {
      const diagonalPosition = addPositions(adjacentPosition, diagonalStep);

      if (
        isInsideBoard(diagonalPosition) &&
        !getPlayerAt(snapshot, diagonalPosition) &&
        !isEdgeBlocked(adjacentPosition, diagonalPosition, snapshot.walls)
      ) {
        moves.set(positionKey(diagonalPosition), diagonalPosition);
      }
    });
  });

  return [...moves.values()];
}

function resolveNextTurnPlayerName(snapshot: QuoridorSnapshot, currentPlayerName: string): string {
  const currentIndex = snapshot.players.findIndex(
    (player) => normalizeLookupKey(player.playerName) === normalizeLookupKey(currentPlayerName)
  );
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % snapshot.players.length;

  return snapshot.players[nextIndex]?.playerName ?? currentPlayerName;
}

export function applyQuoridorAction(
  snapshot: QuoridorSnapshot,
  playerName: string,
  action: QuoridorAction
): ApplyQuoridorActionResult {
  if (snapshot.winnerPlayerName != null) {
    return { ok: false, reason: 'game-finished' };
  }

  if (normalizeLookupKey(snapshot.turnPlayerName) !== normalizeLookupKey(playerName)) {
    return { ok: false, reason: 'not-player-turn' };
  }

  const player = snapshot.players.find(
    (candidate) => normalizeLookupKey(candidate.playerName) === normalizeLookupKey(playerName)
  );

  if (!player) {
    return { ok: false, reason: 'player-not-found' };
  }

  if (action.type === 'move-pawn') {
    const legalMoves = getLegalPawnMoves(snapshot, playerName);
    const legalDestination = legalMoves.some((move) => isSamePosition(move, action.to));

    if (!legalDestination) {
      return { ok: false, reason: 'invalid-action' };
    }

    const nextSnapshot = cloneQuoridorSnapshot(snapshot);
    const nextPlayer = nextSnapshot.players.find(
      (candidate) => normalizeLookupKey(candidate.playerName) === normalizeLookupKey(playerName)
    )!;

    nextPlayer.position = clonePosition(action.to);
    nextSnapshot.winnerPlayerName = isGoalReached(nextPlayer.position, nextPlayer.goalEdge)
      ? nextPlayer.playerName
      : null;
    nextSnapshot.turnPlayerName =
      nextSnapshot.winnerPlayerName == null
        ? resolveNextTurnPlayerName(nextSnapshot, playerName)
        : nextPlayer.playerName;
    nextSnapshot.lastAction = {
      playerName: nextPlayer.playerName,
      actionType: 'move-pawn',
      destination: clonePosition(action.to)
    };

    return {
      ok: true,
      snapshot: nextSnapshot
    };
  }

  if (action.type === 'place-wall') {
    if (player.wallsRemaining <= 0) {
      return { ok: false, reason: 'wall-unavailable' };
    }

    if (!canPlaceQuoridorWall(snapshot, action.wall)) {
      return { ok: false, reason: canPlaceWallShape(snapshot, action.wall) ? 'no-path-to-goal' : 'invalid-action' };
    }

    const nextSnapshot = cloneQuoridorSnapshot(snapshot);
    const nextPlayer = nextSnapshot.players.find(
      (candidate) => normalizeLookupKey(candidate.playerName) === normalizeLookupKey(playerName)
    )!;

    nextPlayer.wallsRemaining -= 1;
    nextSnapshot.walls.push(cloneWall(action.wall));
    nextSnapshot.turnPlayerName = resolveNextTurnPlayerName(nextSnapshot, playerName);
    nextSnapshot.lastAction = {
      playerName: nextPlayer.playerName,
      actionType: 'place-wall',
      wall: cloneWall(action.wall)
    };

    return {
      ok: true,
      snapshot: nextSnapshot
    };
  }

  return { ok: false, reason: 'invalid-action' };
}
