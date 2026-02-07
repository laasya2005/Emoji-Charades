import { normalizeAnswer, shuffleArray } from "./utils";
import { getGuesserPoints, getActorPoints } from "./scoring";

// Constants
const MAX_EMOJIS = 12;
const MAX_PLAYERS = 12;
const HINT_TIME = 30;
const MAX_CORRECT_BEFORE_END = 3;
const TURN_END_DELAY_MS = 5000;

export type GamePhase = "LOBBY" | "TURN_ACTIVE" | "TURN_END" | "GAME_END";

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export interface GuessMessage {
  playerName: string;
  text: string;
  correct: boolean;
  system: boolean;
}

export interface TurnResult {
  word: string;
  actorName: string;
  winners: { name: string; points: number }[];
  actorPoints: number;
}

export interface RoomSettings {
  roundsPerPlayer: number;
  turnDuration: number;
}

export interface RoomStateSnapshot {
  code: string;
  phase: GamePhase;
  players: Player[];
  hostId: string;
  settings: RoomSettings;
  currentRound: number;
  totalRounds: number;
  currentActorId: string | undefined;
  emojis: string[];
  timeRemaining: number;
  guesses: GuessMessage[];
  correctGuessers: string[];
  hint: { wordCount: number; wordLengths: number[] } | null;
  turnResult: TurnResult | null;
  currentWord?: string;
  finalStandings?: Player[];
}

export class GameRoom {
  code: string;
  phase: GamePhase = "LOBBY";
  players: Player[] = [];
  hostId: string = "";
  settings: RoomSettings;

  private movies: string[];
  private usedWords = new Set<string>();
  private actorOrder: string[] = [];
  private actorIndex = 0;
  private currentWord = "";
  emojis: string[] = [];
  guesses: GuessMessage[] = [];
  correctGuessers: string[] = [];
  timeRemaining = 0;
  private turnTimer: NodeJS.Timeout | null = null;
  private turnEndTimeout: NodeJS.Timeout | null = null;
  turnResult: TurnResult | null = null;
  hint: { wordCount: number; wordLengths: number[] } | null = null;

  private onStateChange: () => void;

  constructor(code: string, movies: string[], onStateChange: () => void) {
    this.code = code;
    this.movies = movies;
    this.settings = {
      roundsPerPlayer: 1,
      turnDuration: 90,
    };
    this.onStateChange = onStateChange;
  }

  addPlayer(id: string, name: string): boolean {
    if (this.phase !== "LOBBY") return false;
    if (this.players.length >= MAX_PLAYERS) return false;
    if (this.players.find((p) => p.id === id)) return false;
    this.players.push({ id, name, score: 0, connected: true });
    if (this.players.length === 1) this.hostId = id;
    return true;
  }

  removePlayer(id: string): void {
    const wasActor = this.currentActorId === id;
    this.players = this.players.filter((p) => p.id !== id);

    if (this.players.length === 0) return;

    if (this.hostId === id) {
      const connected = this.players.find((p) => p.connected);
      if (connected) this.hostId = connected.id;
    }

    if (this.phase === "LOBBY") {
      this.onStateChange();
      return;
    }

    this.actorOrder = this.actorOrder.filter((pid) => pid !== id);

    if (this.players.filter((p) => p.connected).length < 2) {
      this.endGame();
      return;
    }

    if (wasActor) {
      this.clearAllTimers();
      this.advanceTurn(); // advanceTurn triggers startTurn which broadcasts
      return;
    }

    this.checkTurnComplete();
    this.onStateChange();
  }

  disconnectPlayer(id: string): void {
    const player = this.players.find((p) => p.id === id);
    if (!player) return;
    player.connected = false;

    if (this.phase === "LOBBY") {
      this.removePlayer(id);
      return;
    }

    const connectedCount = this.players.filter((p) => p.connected).length;
    if (connectedCount < 2) {
      this.endGame();
      return;
    }

    if (this.currentActorId === id) {
      this.clearAllTimers();
      this.advanceTurn();
    }

    this.onStateChange();
  }

  get currentActorId(): string | undefined {
    return this.actorOrder[this.actorIndex];
  }

  get currentRound(): number {
    if (this.actorOrder.length === 0) return 1;
    const playersPerRound = this.players.length || 1;
    return Math.floor(this.actorIndex / playersPerRound) + 1;
  }

  get totalRounds(): number {
    return this.settings.roundsPerPlayer;
  }

  startGame(): boolean {
    if (this.phase !== "LOBBY") return false;
    if (this.players.length < 2) return false;

    this.actorOrder = [];
    for (let r = 0; r < this.settings.roundsPerPlayer; r++) {
      this.actorOrder.push(...shuffleArray(this.players.map((p) => p.id)));
    }
    this.actorIndex = 0;
    this.startTurn();
    return true;
  }

  private startTurn(): void {
    while (
      this.actorIndex < this.actorOrder.length &&
      !this.players.find((p) => p.id === this.actorOrder[this.actorIndex] && p.connected)
    ) {
      this.actorIndex++;
    }

    if (this.actorIndex >= this.actorOrder.length) {
      this.endGame();
      return;
    }

    this.currentWord = this.pickWord();
    this.emojis = [];
    this.guesses = [];
    this.correctGuessers = [];
    this.turnResult = null;
    this.hint = null;
    this.timeRemaining = this.settings.turnDuration;
    this.phase = "TURN_ACTIVE";

    this.onStateChange();
    this.startTimer();
  }

  private pickWord(): string {
    const available = this.movies.filter((w) => !this.usedWords.has(w));
    if (available.length === 0) {
      this.usedWords.clear();
      return this.pickWord();
    }
    const word = available[Math.floor(Math.random() * available.length)];
    this.usedWords.add(word);
    return word;
  }

  private startTimer(): void {
    this.turnTimer = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining === HINT_TIME && !this.hint) {
        const words = this.currentWord.split(/\s+/);
        this.hint = {
          wordCount: words.length,
          wordLengths: words.map((w) => w.replace(/[^a-zA-Z0-9]/g, "").length),
        };
      }

      if (this.timeRemaining <= 0) {
        this.clearAllTimers();
        this.endTurn();
      } else {
        this.onStateChange();
      }
    }, 1000);
  }

  private clearAllTimers(): void {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.turnEndTimeout) {
      clearTimeout(this.turnEndTimeout);
      this.turnEndTimeout = null;
    }
  }

  updateEmojis(playerId: string, emojis: string[]): boolean {
    if (this.phase !== "TURN_ACTIVE") return false;
    if (playerId !== this.currentActorId) return false;
    if (!Array.isArray(emojis)) return false;
    if (!emojis.every((e) => typeof e === "string")) return false;
    this.emojis = emojis.slice(0, MAX_EMOJIS);
    this.onStateChange();
    return true;
  }

  submitGuess(playerId: string, text: string): GuessMessage | null {
    if (this.phase !== "TURN_ACTIVE") return null;
    if (playerId === this.currentActorId) return null;
    if (this.correctGuessers.includes(playerId)) return null;

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return null;

    const normalized = normalizeAnswer(text);
    const normalizedAnswer = normalizeAnswer(this.currentWord);
    const isCorrect = normalized === normalizedAnswer;

    if (isCorrect) {
      const place = this.correctGuessers.length;
      const points = getGuesserPoints(place);
      player.score += points;
      this.correctGuessers.push(playerId);

      const msg: GuessMessage = {
        playerName: player.name,
        text: `${player.name} guessed correctly! (+${points})`,
        correct: true,
        system: true,
      };
      this.guesses.push(msg);
      this.checkTurnComplete();
      this.onStateChange();
      return msg;
    }

    const msg: GuessMessage = { playerName: player.name, text, correct: false, system: false };
    this.guesses.push(msg);
    this.onStateChange();
    return msg;
  }

  private checkTurnComplete(): void {
    const guessers = this.players.filter(
      (p) => p.id !== this.currentActorId && p.connected
    );
    const allGuessed = guessers.every((p) => this.correctGuessers.includes(p.id));
    const topDone = this.correctGuessers.length >= MAX_CORRECT_BEFORE_END;

    if (allGuessed || topDone) {
      this.clearAllTimers();
      this.endTurn();
    }
  }

  private endTurn(): void {
    const actor = this.players.find((p) => p.id === this.currentActorId);
    const actorPoints = getActorPoints(this.correctGuessers.length);
    if (actor) actor.score += actorPoints;

    const winners = this.correctGuessers
      .map((id, i) => {
        const p = this.players.find((pl) => pl.id === id);
        if (!p) return null;
        return { name: p.name, points: getGuesserPoints(i) };
      })
      .filter((w): w is { name: string; points: number } => w !== null);

    this.turnResult = {
      word: this.currentWord,
      actorName: actor?.name || "Unknown",
      winners,
      actorPoints,
    };

    this.phase = "TURN_END";
    this.onStateChange();

    this.turnEndTimeout = setTimeout(() => {
      if (this.phase === "TURN_END") {
        this.advanceTurn();
      }
    }, TURN_END_DELAY_MS);
  }

  advanceTurn(): void {
    if (this.phase === "GAME_END") return;
    this.clearAllTimers();
    this.actorIndex++;
    this.startTurn();
  }

  private endGame(): void {
    this.clearAllTimers();
    this.phase = "GAME_END";
    this.onStateChange();
  }

  returnToLobby(): void {
    this.clearAllTimers();
    this.phase = "LOBBY";
    this.players.forEach((p) => (p.score = 0));
    this.actorOrder = [];
    this.actorIndex = 0;
    this.usedWords.clear();
    this.emojis = [];
    this.guesses = [];
    this.correctGuessers = [];
    this.turnResult = null;
    this.hint = null;
    this.onStateChange();
  }

  destroy(): void {
    this.clearAllTimers();
  }

  getState(forPlayerId?: string): RoomStateSnapshot {
    const isActor = forPlayerId === this.currentActorId;
    return {
      code: this.code,
      phase: this.phase,
      players: this.players,
      hostId: this.hostId,
      settings: this.settings,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      currentActorId: this.currentActorId,
      emojis: this.emojis,
      timeRemaining: this.timeRemaining,
      guesses: isActor ? [] : this.guesses,
      correctGuessers: this.correctGuessers,
      hint: this.hint,
      turnResult: this.turnResult,
      currentWord: isActor ? this.currentWord : undefined,
      finalStandings:
        this.phase === "GAME_END"
          ? [...this.players].sort((a, b) => b.score - a.score)
          : undefined,
    };
  }
}
