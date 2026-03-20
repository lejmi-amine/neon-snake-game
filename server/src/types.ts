export interface Player {
  id: string;
  name: string;
  snake: Position[];
  direction: Direction;
  score: number;
  color: string;
  roomId: string;
  isAlive: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface GameState {
  players: Map<string, Player>;
  food: Position;
  gridSize: number;
  gameSpeed: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  timestamp: number;
}
