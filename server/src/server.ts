import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server running" });
});

const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io") || req.path.startsWith("/health")) return next();
  res.sendFile(path.join(clientDistPath, "index.html"));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:5173", credentials: true },
  transports: ["polling", "websocket"],
});

// Game state
interface Player {
  id: string;
  name: string;
  snake: { x: number; y: number }[];
  direction: string;
  nextDirection: string;
  score: number;
  color: string;
  isAlive: boolean;
}

interface GameRoom {
  players: Map<string, Player>;
  food: { x: number; y: number };
  gridSize: number;
}

const gameRooms = new Map<string, GameRoom>();

interface LeaderboardEntry {
  playerName: string;
  playerId: string;
  score: number;
}

const SCORES_FILE = path.join(__dirname, "../../scores.json");
let globalLeaderboard: LeaderboardEntry[] = [];

try {
  if (fs.existsSync(SCORES_FILE)) {
    globalLeaderboard = JSON.parse(fs.readFileSync(SCORES_FILE, "utf-8"));
  }
} catch (e) {
  console.error("Could not load scores:", e);
}

function saveScores() {
  try {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(globalLeaderboard));
  } catch (e) {
    console.error("Could not save scores:", e);
  }
}

function updateLeaderboard(player: Player) {
  if (player.score === 0) return;
  const existing = globalLeaderboard.find(e => e.playerName === player.name);
  let changed = false;
  
  if (existing) {
    if (player.score > existing.score) {
      existing.score = player.score;
      changed = true;
    }
  } else {
    globalLeaderboard.push({
      playerName: player.name,
      playerId: player.id,
      score: player.score
    });
    changed = true;
  }
  
  if (changed) {
    globalLeaderboard.sort((a, b) => b.score - a.score);
    if (globalLeaderboard.length > 5) {
      globalLeaderboard = globalLeaderboard.slice(0, 5);
    }
    saveScores();
    io.emit("leaderboard-update", globalLeaderboard);
  }
}

// Helper functions
function generateFood(players: Player[], gridSize: number = 20) {
  const occupied = new Set<string>();
  players.forEach((p) => {
    if (p.isAlive) {
      p.snake.forEach((s) => occupied.add(`${s.x},${s.y}`));
    }
  });

  for (let i = 0; i < 1000; i++) {
    const food = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
    if (!occupied.has(`${food.x},${food.y}`)) {
      return food;
    }
  }
  return { x: 10, y: 10 };
}

function checkCollision(
  snake: { x: number; y: number }[],
  gridSize: number = 20,
) {
  if (snake.length === 0) return true;
  const head = snake[0];
  if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize)
    return true;
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) return true;
  }
  return false;
}

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.emit("connection-confirmed", { id: socket.id });

  socket.on("join-game", ({ playerName, roomId = "default" }) => {
    console.log(`🎮 ${playerName} joining ${roomId}`);

    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, {
        players: new Map(),
        food: { x: 10, y: 10 },
        gridSize: 20,
      });
    }

    const room = gameRooms.get(roomId)!;

    const player: Player = {
      id: socket.id,
      name: playerName,
      snake: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      direction: "right",
      nextDirection: "right",
      score: 0,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
      isAlive: true,
    };

    room.players.set(socket.id, player);
    room.food = generateFood(Array.from(room.players.values()));

    // BUG FIX: socket must join the Socket.io room before io.to(roomId) can reach it
    socket.join(roomId);

    socket.emit("game-init", {
      playerId: socket.id,
      gridSize: room.gridSize,
    });

    // Send initial game state
    io.to(roomId).emit("game-state", {
      players: Array.from(room.players.values()),
      food: room.food,
    });

    console.log(`Players in room: ${room.players.size}`);
    socket.emit("leaderboard-update", globalLeaderboard);
  });

  socket.on("player-direction", ({ direction }) => {
    for (const room of gameRooms.values()) {
      const player = room.players.get(socket.id);
      if (player && player.isAlive) {
        const opposites: any = {
          up: "down",
          down: "up",
          left: "right",
          right: "left",
        };
        if (opposites[direction] !== player.direction && opposites[direction] !== player.nextDirection) {
          player.nextDirection = direction;
        }
        break;
      }
    }
  });

  // Client game-tick event removed. Using server loop instead.

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        if (room.players.size > 0) {
          io.to(roomId).emit("game-state", {
            players: Array.from(room.players.values()),
            food: room.food,
          });
        } else {
          gameRooms.delete(roomId);
        }
        break;
      }
    }
  });
});

setInterval(() => {
  for (const [roomId, room] of gameRooms.entries()) {
    let stateChanged = false;
    for (const player of room.players.values()) {
      if (!player.isAlive) continue;

      player.direction = player.nextDirection;

      // Move snake
      const head = { ...player.snake[0] };
      switch (player.direction) {
        case "up":
          head.y--;
          break;
        case "down":
          head.y++;
          break;
        case "left":
          head.x--;
          break;
        case "right":
          head.x++;
          break;
      }

      const newSnake = [head, ...player.snake];

      // Check food collision
      if (head.x === room.food.x && head.y === room.food.y) {
        player.snake = newSnake; // Grow
        player.score = (player.snake.length - 3) * 10;
        updateLeaderboard(player);
        room.food = generateFood(Array.from(room.players.values()));
        console.log(`🍎 ${player.name} ate food! Score: ${player.score}`);
      } else {
        newSnake.pop();
        player.snake = newSnake;
      }

      // Check death
      if (checkCollision(player.snake, room.gridSize)) {
        console.log(`💀 ${player.name} died`);
        player.isAlive = false;
      }
      
      stateChanged = true;
    }

    if (stateChanged) {
      io.to(roomId).emit("game-state", {
        players: Array.from(room.players.values()),
        food: room.food,
      });
    }
  }
}, 150);

const PORT = 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("\n🚀 SERVER RUNNING ON PORT 3001");
  console.log("📡 http://localhost:3001\n");
});
