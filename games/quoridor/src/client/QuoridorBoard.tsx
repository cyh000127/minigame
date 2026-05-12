import {
  canPlaceQuoridorWall,
  getLegalPawnMoves,
  type QuoridorPosition,
  type QuoridorSnapshot,
  type QuoridorWall
} from '../shared/index.js';

interface QuoridorBoardProps {
  actionMode: 'move' | 'wall';
  canPlaceWalls?: boolean;
  interactive: boolean;
  snapshot: QuoridorSnapshot;
  viewerPlayerName: string;
  onMovePawn?: (position: QuoridorPosition) => void;
  onPlaceWall?: (wall: QuoridorWall) => void;
}

function normalizePlayerIdentity(playerName: string): string {
  return playerName.trim().toLowerCase();
}

function positionKey(position: QuoridorPosition): string {
  return `${position.row}:${position.col}`;
}

function wallKey(wall: QuoridorWall): string {
  return `${wall.orientation}:${wall.row}:${wall.col}`;
}

function createGridTrack(index: number): number {
  return index * 2 + 1;
}

function createPlayerLabel(snapshot: QuoridorSnapshot, row: number, col: number): string | null {
  const playerIndex = snapshot.players.findIndex(
    (player) => player.position.row === row && player.position.col === col
  );

  return playerIndex === -1 ? null : `P${playerIndex + 1}`;
}

export function QuoridorBoard({
  actionMode,
  canPlaceWalls = false,
  interactive,
  snapshot,
  viewerPlayerName,
  onMovePawn,
  onPlaceWall
}: QuoridorBoardProps) {
  const legalMoves = new Set(
    interactive && actionMode === 'move' ? getLegalPawnMoves(snapshot, viewerPlayerName).map(positionKey) : []
  );
  const placedWallKeys = new Set(snapshot.walls.map(wallKey));
  const viewerKey = normalizePlayerIdentity(viewerPlayerName);

  return (
    <section className="quoridor-board-surface" aria-label="Quoridor board">
      <div className="quoridor-board" role="grid" aria-label="9 by 9 Quoridor board">
        {Array.from({ length: snapshot.boardSize }, (_, row) =>
          Array.from({ length: snapshot.boardSize }, (__, col) => {
            const key = `${row}:${col}`;
            const playerLabel = createPlayerLabel(snapshot, row, col);
            const player = snapshot.players.find(
              (candidate) => candidate.position.row === row && candidate.position.col === col
            );
            const occupiedByViewer = player ? normalizePlayerIdentity(player.playerName) === viewerKey : false;
            const legal = legalMoves.has(key);
            const lastMove =
              snapshot.lastAction?.actionType === 'move-pawn' &&
              snapshot.lastAction.destination?.row === row &&
              snapshot.lastAction.destination.col === col;

            return (
              <button
                key={key}
                type="button"
                className={[
                  'quoridor-cell',
                  playerLabel ? 'quoridor-cell--occupied' : '',
                  occupiedByViewer ? 'quoridor-cell--viewer' : '',
                  legal ? 'quoridor-cell--legal' : '',
                  lastMove ? 'quoridor-cell--last-move' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!legal || !onMovePawn}
                aria-label={
                  player
                    ? `${player.playerName} at row ${row + 1}, column ${col + 1}`
                    : `row ${row + 1}, column ${col + 1}`
                }
                role="gridcell"
                style={{
                  gridRow: createGridTrack(row),
                  gridColumn: createGridTrack(col)
                }}
                onClick={() => {
                  if (!legal) {
                    return;
                  }

                  onMovePawn?.({ row, col });
                }}
              >
                {playerLabel ? <span className="quoridor-cell__pawn">{playerLabel}</span> : null}
              </button>
            );
          })
        )}
        {(['horizontal', 'vertical'] as const).map((orientation) =>
          Array.from({ length: snapshot.boardSize - 1 }, (_, row) =>
            Array.from({ length: snapshot.boardSize - 1 }, (__, col) => {
              const wall = { row, col, orientation };
              const placed = placedWallKeys.has(wallKey(wall));
              const available =
                interactive &&
                actionMode === 'wall' &&
                canPlaceWalls &&
                !placed &&
                canPlaceQuoridorWall(snapshot, wall);
              const lastWall =
                snapshot.lastAction?.actionType === 'place-wall' &&
                snapshot.lastAction.wall != null &&
                wallKey(snapshot.lastAction.wall) === wallKey(wall);

              return (
                <button
                  key={`wall:${wall.orientation}:${row}:${col}`}
                  type="button"
                  className={[
                    'quoridor-wall-slot',
                    `quoridor-wall-slot--${wall.orientation}`,
                    placed ? 'quoridor-wall-slot--placed' : '',
                    available ? 'quoridor-wall-slot--available' : '',
                    lastWall ? 'quoridor-wall-slot--last' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    wall.orientation === 'horizontal'
                      ? {
                          gridRow: createGridTrack(row) + 1,
                          gridColumn: `${createGridTrack(col)} / span 3`
                        }
                      : {
                          gridRow: `${createGridTrack(row)} / span 3`,
                          gridColumn: createGridTrack(col) + 1
                        }
                  }
                  disabled={!available || !onPlaceWall}
                  aria-label={`${wall.orientation} wall at row ${row + 1}, column ${col + 1}`}
                  onClick={() => {
                    if (!available) {
                      return;
                    }

                    onPlaceWall?.(wall);
                  }}
                />
              );
            })
          )
        )}
      </div>
    </section>
  );
}
