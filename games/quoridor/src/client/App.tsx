import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  cloneQuoridorSnapshot,
  eventNames,
  type EntryIntentPayload,
  type QuoridorActionIntentPayload,
  type QuoridorPlayerCount,
  type QuoridorPlayerState,
  type QuoridorSnapshot,
  type RejectedIntentPayload,
  type RoomJoinAcceptedPayload
} from '../shared/index.js';
import { QuoridorBoard } from './QuoridorBoard.js';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type ActionMode = 'move' | 'wall';
type ReviewIndex = number | null;

function normalizePlayerIdentity(playerName: string): string {
  return playerName.trim().toLowerCase();
}

function resolveSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_QUORIDOR_SOCKET_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  return import.meta.env.DEV ? 'http://127.0.0.1:10002' : window.location.origin;
}

function resolveViewerPlayer(snapshotPlayers: QuoridorPlayerState[], viewerPlayerName: string) {
  return (
    snapshotPlayers.find(
      (player) => normalizePlayerIdentity(player.playerName) === normalizePlayerIdentity(viewerPlayerName)
    ) ?? null
  );
}

function createInitialEntry(): EntryIntentPayload {
  return {
    roomName: 'quoridor-room',
    playerName: '',
    entryMode: 'create-room',
    playerCount: 2
  };
}

function createSnapshotHistoryKey(snapshot: QuoridorSnapshot): string {
  return JSON.stringify({
    players: snapshot.players.map((player) => ({
      name: player.playerName,
      row: player.position.row,
      col: player.position.col,
      walls: player.wallsRemaining
    })),
    wallCount: snapshot.walls.length,
    turn: snapshot.turnPlayerName,
    winner: snapshot.winnerPlayerName,
    lastAction: snapshot.lastAction
  });
}

function describeLastAction(snapshot: QuoridorSnapshot): string {
  if (!snapshot.lastAction) {
    return 'Initial board';
  }

  if (snapshot.lastAction.actionType === 'move-pawn' && snapshot.lastAction.destination) {
    return `${snapshot.lastAction.playerName} moved to R${snapshot.lastAction.destination.row + 1} C${
      snapshot.lastAction.destination.col + 1
    }`;
  }

  if (snapshot.lastAction.actionType === 'place-wall' && snapshot.lastAction.wall) {
    return `${snapshot.lastAction.playerName} placed ${snapshot.lastAction.wall.orientation} wall at R${
      snapshot.lastAction.wall.row + 1
    } C${snapshot.lastAction.wall.col + 1}`;
  }

  return `${snapshot.lastAction.playerName} acted`;
}

export function App() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [entry, setEntry] = useState<EntryIntentPayload>(createInitialEntry);
  const [joinedRoom, setJoinedRoom] = useState<RoomJoinAcceptedPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>('move');
  const [turnHistory, setTurnHistory] = useState<QuoridorSnapshot[]>([]);
  const [reviewIndex, setReviewIndex] = useState<ReviewIndex>(null);
  const liveSnapshot = joinedRoom?.room.quoridor ?? null;
  const reviewingSnapshot = reviewIndex == null ? null : turnHistory[reviewIndex] ?? null;
  const snapshot = reviewingSnapshot ?? liveSnapshot;
  const reviewingTurns = reviewingSnapshot != null;
  const viewer = snapshot && joinedRoom ? resolveViewerPlayer(snapshot.players, joinedRoom.viewerPlayerName) : null;
  const viewerTurn =
    liveSnapshot != null &&
    viewer != null &&
    normalizePlayerIdentity(liveSnapshot.turnPlayerName) === normalizePlayerIdentity(joinedRoom?.viewerPlayerName ?? '');
  const controlsInteractive =
    connectionStatus === 'connected' &&
    joinedRoom?.room.roomPhase === 'in-game' &&
    liveSnapshot != null &&
    viewerTurn &&
    liveSnapshot.winnerPlayerName == null &&
    !reviewingTurns;
  const canPlaceWalls = controlsInteractive && viewer != null && viewer.wallsRemaining > 0;
  const roomIsReady = joinedRoom ? joinedRoom.room.players.length === joinedRoom.room.playerCount : false;
  const viewerIsHost = joinedRoom
    ? normalizePlayerIdentity(joinedRoom.room.hostPlayerName) === normalizePlayerIdentity(joinedRoom.viewerPlayerName)
    : false;
  const socketUrl = useMemo(resolveSocketUrl, []);

  useEffect(() => {
    const socket = io(socketUrl);

    socketRef.current = socket;
    setConnectionStatus('connecting');

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });
    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });
    socket.on(eventNames.roomJoined, (payload: RoomJoinAcceptedPayload) => {
      setJoinedRoom(payload);
      setReviewIndex(null);
      if (payload.room.quoridor) {
        const nextSnapshot = cloneQuoridorSnapshot(payload.room.quoridor);
        setTurnHistory((currentHistory) => {
          const latestSnapshot = currentHistory.at(-1);
          const nextKey = createSnapshotHistoryKey(nextSnapshot);
          const latestKey = latestSnapshot ? createSnapshotHistoryKey(latestSnapshot) : null;

          return latestKey === nextKey ? currentHistory : [...currentHistory, nextSnapshot].slice(-24);
        });
      } else {
        setTurnHistory([]);
      }
      setNotice(null);
    });
    socket.on(eventNames.roomJoinRejected, (payload: RejectedIntentPayload) => {
      setNotice(payload.message);
    });
    socket.on(eventNames.roomStartRejected, (payload: RejectedIntentPayload) => {
      setNotice(payload.message);
    });
    socket.on(eventNames.roomRestartRejected, (payload: RejectedIntentPayload) => {
      setNotice(payload.message);
    });
    socket.on(eventNames.quoridorActionRejected, (payload: RejectedIntentPayload) => {
      setNotice(payload.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [socketUrl]);

  useEffect(() => {
    if (actionMode === 'wall' && !canPlaceWalls) {
      setActionMode('move');
    }
  }, [actionMode, canPlaceWalls]);

  function emitJoin(payload: EntryIntentPayload) {
    socketRef.current?.emit(eventNames.roomJoin, payload);
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entry.roomName.trim() || !entry.playerName.trim()) {
      setNotice('Room name and player name are required.');
      return;
    }

    emitJoin({
      roomName: entry.roomName.trim(),
      playerName: entry.playerName.trim(),
      entryMode: entry.entryMode,
      ...(entry.entryMode === 'create-room' ? { playerCount: entry.playerCount ?? 2 } : {})
    });
  }

  function handleStart() {
    if (!joinedRoom) {
      return;
    }

    socketRef.current?.emit(eventNames.roomStart, {
      roomName: joinedRoom.room.roomName
    });
  }

  function handleRestart() {
    if (!joinedRoom) {
      return;
    }

    socketRef.current?.emit(eventNames.roomRestart, {
      roomName: joinedRoom.room.roomName
    });
  }

  function handleQuoridorAction(payload: QuoridorActionIntentPayload) {
    socketRef.current?.emit(eventNames.quoridorAction, payload);
  }

  if (!joinedRoom) {
    return (
      <main className="app-shell">
        <section className="hero">
          <div>
            <p className="eyebrow">QUORIDOR</p>
            <h1>Standalone Quoridor</h1>
            <p className="hero-copy">Create a 2-player or 4-player room and play on a separate service.</p>
          </div>
          <span className={`status status--${connectionStatus}`}>{connectionStatus}</span>
        </section>

        <form className="entry-panel" onSubmit={handleJoin}>
          <div className="entry-mode-tabs" role="tablist" aria-label="Room entry mode">
            <button
              type="button"
              role="tab"
              aria-selected={entry.entryMode === 'create-room'}
              className={entry.entryMode === 'create-room' ? 'selected' : ''}
              onClick={() => {
                setEntry((current) => ({
                  ...current,
                  entryMode: 'create-room',
                  playerCount: current.playerCount ?? 2
                }));
                setNotice(null);
              }}
            >
              Create Room
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entry.entryMode === 'join-room'}
              className={entry.entryMode === 'join-room' ? 'selected' : ''}
              onClick={() => {
                setEntry((current) => ({
                  ...current,
                  entryMode: 'join-room'
                }));
                setNotice(null);
              }}
            >
              Join Room
            </button>
          </div>
          <label className="field">
            <span>Room</span>
            <input
              value={entry.roomName}
              maxLength={24}
              onChange={(event) => {
                setEntry((current) => ({
                  ...current,
                  roomName: event.target.value
                }));
              }}
            />
          </label>
          <label className="field">
            <span>Player</span>
            <input
              value={entry.playerName}
              maxLength={24}
              onChange={(event) => {
                setEntry((current) => ({
                  ...current,
                  playerName: event.target.value
                }));
              }}
            />
          </label>
          {entry.entryMode === 'create-room' ? (
            <label className="field">
              <span>Players</span>
              <select
                value={entry.playerCount ?? 2}
                onChange={(event) => {
                  setEntry((current) => ({
                    ...current,
                    playerCount: Number(event.target.value) as QuoridorPlayerCount
                  }));
                }}
              >
                <option value={2}>2 players</option>
                <option value={4}>4 players</option>
              </select>
            </label>
          ) : null}
          <button type="submit" disabled={connectionStatus !== 'connected'}>
            {entry.entryMode === 'create-room' ? 'Create Room' : 'Join Room'}
          </button>
          {notice ? <p className="notice">{notice}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell app-shell--game">
      <header className="topbar">
        <div>
          <p className="eyebrow">QUORIDOR ROOM</p>
          <h1>{joinedRoom.room.roomName}</h1>
        </div>
        <div className="topbar__badges">
          <span className={`status status--${connectionStatus}`}>{connectionStatus}</span>
          <span className="pill">{joinedRoom.room.roomPhase}</span>
          {liveSnapshot ? (
            <span className="pill">{viewerTurn ? 'your turn' : `${liveSnapshot.turnPlayerName}'s turn`}</span>
          ) : null}
          {reviewingTurns ? <span className="pill pill--review">review turn {(reviewIndex ?? 0) + 1}</span> : null}
        </div>
      </header>

      {notice ? <p className="notice notice--inline">{notice}</p> : null}

      {joinedRoom.room.roomPhase === 'lobby' ? (
        <section className="lobby-panel">
          <div>
            <h2>Waiting for players</h2>
            <p>
              {joinedRoom.room.players.length}/{joinedRoom.room.playerCount} seated
            </p>
          </div>
          <button type="button" disabled={!viewerIsHost || !roomIsReady} onClick={handleStart}>
            Start Game
          </button>
        </section>
      ) : null}

      <div className="game-layout">
        <section className="board-column">
          {snapshot ? (
            <QuoridorBoard
              actionMode={actionMode}
              canPlaceWalls={canPlaceWalls}
              interactive={controlsInteractive}
              snapshot={snapshot}
              viewerPlayerName={joinedRoom.viewerPlayerName}
              onMovePawn={(position) => {
                handleQuoridorAction({
                  roomName: joinedRoom.room.roomName,
                  action: {
                    type: 'move-pawn',
                    to: position
                  }
                });
              }}
              onPlaceWall={(wall) => {
                handleQuoridorAction({
                  roomName: joinedRoom.room.roomName,
                  action: {
                    type: 'place-wall',
                    wall
                  }
                });
              }}
            />
          ) : (
            <div className="empty-board">The board appears after the host starts the game.</div>
          )}
        </section>

        <aside className="side-panel">
          {snapshot ? (
            <section className="panel">
              <div className="panel__header">
                <span>Turn action</span>
                <strong>{viewer?.wallsRemaining ?? 0} walls</strong>
              </div>
              {reviewingTurns ? <p className="helper-text">Turn review is active. Return live to play.</p> : null}
              <div className="segmented">
                <button
                  type="button"
                  className={actionMode === 'move' ? 'selected' : ''}
                  disabled={!controlsInteractive}
                  onClick={() => {
                    setActionMode('move');
                  }}
                >
                  Move
                </button>
                <button
                  type="button"
                  className={actionMode === 'wall' ? 'selected' : ''}
                  disabled={!canPlaceWalls}
                  onClick={() => {
                    setActionMode('wall');
                  }}
                >
                  Wall
                </button>
              </div>
            </section>
          ) : null}

          {snapshot ? (
            <section className="panel">
              <div className="panel__header">
                <span>Turn review</span>
                <strong>{turnHistory.length} states</strong>
              </div>
              <div className="review-controls">
                <button
                  type="button"
                  disabled={turnHistory.length === 0}
                  onClick={() => {
                    setReviewIndex((current) =>
                      current == null ? Math.max(0, turnHistory.length - 2) : Math.max(0, current - 1)
                    );
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={turnHistory.length === 0 || reviewIndex == null || reviewIndex >= turnHistory.length - 1}
                  onClick={() => {
                    setReviewIndex((current) =>
                      current == null ? null : Math.min(turnHistory.length - 1, current + 1)
                    );
                  }}
                >
                  Next
                </button>
                <button type="button" disabled={!reviewingTurns} onClick={() => setReviewIndex(null)}>
                  Live
                </button>
              </div>
              <ol className="turn-log">
                {turnHistory.slice(-6).map((historySnapshot, index, visibleHistory) => {
                  const absoluteIndex = turnHistory.length - visibleHistory.length + index;

                  return (
                    <li key={createSnapshotHistoryKey(historySnapshot)}>
                      <button
                        type="button"
                        className={reviewIndex === absoluteIndex ? 'selected' : ''}
                        onClick={() => setReviewIndex(absoluteIndex)}
                      >
                        {describeLastAction(historySnapshot)}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel__header">
              <span>Players</span>
              <strong>
                {joinedRoom.room.players.length}/{joinedRoom.room.playerCount}
              </strong>
            </div>
            <ul className="player-list">
              {joinedRoom.room.players.map((player, index) => {
                const playerState = snapshot?.players.find(
                  (candidate) => normalizePlayerIdentity(candidate.playerName) === normalizePlayerIdentity(player.playerName)
                );

                return (
                  <li key={player.playerName}>
                    <div>
                      <strong>
                        P{index + 1} {player.playerName}
                      </strong>
                      <p>{player.role}</p>
                    </div>
                    {playerState ? <span>{playerState.wallsRemaining} walls</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {joinedRoom.room.roomPhase === 'result' || joinedRoom.room.roomPhase === 'restart-pending' ? (
            <section className="panel">
              <div className="panel__header">
                <span>Result</span>
                <strong>{joinedRoom.room.winnerPlayerName ?? 'unknown'}</strong>
              </div>
              <button
                type="button"
                disabled={
                  normalizePlayerIdentity(joinedRoom.room.restartAuthorityPlayerName ?? '') !==
                  normalizePlayerIdentity(joinedRoom.viewerPlayerName)
                }
                onClick={handleRestart}
              >
                Rematch
              </button>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
