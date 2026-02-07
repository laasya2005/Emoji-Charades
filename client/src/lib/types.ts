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

export interface RoomState {
  code: string;
  phase: GamePhase;
  players: Player[];
  hostId: string;
  settings: {
    roundsPerPlayer: number;
    turnDuration: number;
  };
  currentRound: number;
  totalRounds: number;
  currentActorId?: string;
  emojis: string[];
  timeRemaining: number;
  guesses: GuessMessage[];
  correctGuessers: string[];
  hint: { wordCount: number; wordLengths: number[] } | null;
  turnResult: TurnResult | null;
  currentWord?: string;
  finalStandings?: Player[];
}
