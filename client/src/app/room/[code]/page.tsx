"use client";
import { useEffect, useRef, Suspense, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import EmojiPickerPanel from "@/components/EmojiPicker";
import ChatBox from "@/components/ChatBox";
import Scoreboard from "@/components/Scoreboard";
import TurnEndModal from "@/components/TurnEndModal";
import GameEndModal from "@/components/GameEndModal";
import { trackEvent } from "@/lib/analytics";

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = params.code as string;
  const name = searchParams.get("name") || "Player";
  const action = searchParams.get("action") || "join";

  const {
    roomState,
    error,
    setError,
    roomOnline,
    maxPlayers,
    createRoom,
    joinRoom,
    startGame,
    updateSettings,
    updateEmojis,
    submitGuess,
    returnToLobby,
    kickPlayer,
    getSocketId,
  } = useSocket();

  const initRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);
  const correctTrackedRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      if (action === "create") {
        const res = await createRoom(name);
        if (res.success && res.code) {
          window.history.replaceState(null, "", `/room/${res.code}?name=${encodeURIComponent(name)}`);
          trackEvent("join_room_success", { players_in_room: 1 });
        } else {
          setError(res.error || "Failed to create room");
        }
      } else {
        const res = await joinRoom(code, name);
        if (res.success) {
          trackEvent("join_room_success");
        } else {
          setError(res.error || "Failed to join room");
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track phase transitions (game_started, game_end) — fire once per transition
  useEffect(() => {
    if (!roomState) return;
    const prev = prevPhaseRef.current;
    const curr = roomState.phase;
    prevPhaseRef.current = curr;

    if (prev === "LOBBY" && curr === "TURN_ACTIVE") {
      trackEvent("game_started", {
        players_in_room: roomState.players.length,
        rounds: roomState.totalRounds,
        turn_seconds: roomState.settings.turnDuration,
      });
    }

    if (curr === "GAME_END" && prev !== "GAME_END") {
      trackEvent("game_end", {
        players_in_room: roomState.players.length,
        rounds: roomState.totalRounds,
      });
    }

    // Reset correct-guess flag on new turn
    if (curr === "TURN_ACTIVE" && prev !== "TURN_ACTIVE") {
      correctTrackedRef.current = false;
    }
  }, [roomState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const socketId = getSocketId();
  const isHost = roomState?.hostId === socketId;
  const isActor = roomState?.currentActorId === socketId;
  const hasGuessedCorrectly = roomState?.correctGuessers?.includes(socketId) || false;

  // Track correct guess once per turn
  useEffect(() => {
    if (hasGuessedCorrectly && !correctTrackedRef.current) {
      correctTrackedRef.current = true;
      trackEvent("guess_correct");
    }
  }, [hasGuessedCorrectly]);

  const trackedGuess = useCallback((text: string) => {
    trackEvent("guess_sent");
    submitGuess(text);
  }, [submitGuess]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🎬</div>
          <p className="text-slate-400 text-lg">Connecting to room...</p>
        </div>
      </div>
    );
  }

  if (roomState.phase === "LOBBY") {
    return (
      <div className="p-4">
        <Lobby
          state={roomState}
          isHost={isHost}
          roomOnline={roomOnline}
          maxPlayers={maxPlayers}
          onStart={startGame}
          onUpdateSettings={updateSettings}
          onKick={kickPlayer}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-2 gap-2">
      {/* Actor word banner — always visible at the very top */}
      {isActor && roomState.currentWord && (
        <div className="bg-indigo-900/50 border-2 border-indigo-500 rounded-lg px-4 py-2 text-center shrink-0">
          <span className="text-xs text-indigo-300 uppercase tracking-wider">Act this out</span>
          <p className="text-2xl font-bold text-white">{roomState.currentWord}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
        {/* Main game area */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          <GameBoard
            state={roomState}
            isActor={isActor}
          />

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2">
            {isActor ? (
              <>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <EmojiPickerPanel
                    emojis={roomState.emojis}
                    onUpdate={updateEmojis}
                  />
                </div>
                {/* Actor can see guesses (read-only) */}
                <div className="h-36 shrink-0 bg-slate-800 rounded-lg flex flex-col">
                  <div className="px-3 py-1.5 border-b border-slate-700">
                    <h3 className="font-semibold text-xs text-slate-400">Player Guesses</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {roomState.guesses.length === 0 && (
                      <p className="text-slate-500 text-xs text-center mt-2">No guesses yet...</p>
                    )}
                    {roomState.guesses.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-xs rounded px-2 py-1 ${
                          msg.system
                            ? "bg-green-900/30 text-green-400 font-semibold"
                            : "bg-slate-700"
                        }`}
                      >
                        {msg.system ? (
                          msg.text
                        ) : (
                          <>
                            <span className="font-semibold text-indigo-400">{msg.playerName}: </span>
                            {msg.text}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <ChatBox
                guesses={roomState.guesses}
                onGuess={trackedGuess}
                disabled={roomState.phase !== "TURN_ACTIVE"}
                hasGuessedCorrectly={hasGuessedCorrectly}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:w-48 shrink-0">
          <Scoreboard
            players={roomState.players}
            currentActorId={roomState.currentActorId}
            roomOnline={roomOnline}
            maxPlayers={maxPlayers}
          />
        </div>
      </div>

      {roomState.phase === "TURN_END" && roomState.turnResult && (
        <TurnEndModal result={roomState.turnResult} />
      )}

      {roomState.phase === "GAME_END" && roomState.finalStandings && (
        <GameEndModal
          standings={roomState.finalStandings}
          isHost={isHost}
          onReturnToLobby={returnToLobby}
        />
      )}
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-slate-400">Loading...</p>
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
