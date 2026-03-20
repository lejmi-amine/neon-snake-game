import React, { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface Position {
  x: number;
  y: number;
}

interface Player {
  id: string;
  name: string;
  snake: Position[];
  direction: "up" | "down" | "left" | "right";
  score: number;
  color: string;
  roomId: string;
  isAlive: boolean;
}

interface GameState {
  players: Player[];
  food: Position;
}

interface LeaderboardEntry {
  playerName: string;
  playerId: string;
  score: number;
}

const GRID_SIZE = 30;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;

const NeonSnakeGame: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [inGame, setInGame] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roomId] = useState("default");

  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connecting...");
  const [debugInfo, setDebugInfo] = useState<string>("");

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const changeDirection = useCallback(
    (newDirection: "up" | "down" | "left" | "right") => {
      if (socket && inGame) {
        socket.emit("player-direction", { direction: newDirection });
      }
    },
    [socket, inGame],
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartRef.current.x;
    const dy = touchEndY - touchStartRef.current.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) {
        changeDirection(dx > 0 ? "right" : "left");
      }
    } else {
      if (Math.abs(dy) > 30) {
        changeDirection(dy > 0 ? "down" : "up");
      }
    }
    touchStartRef.current = null;
  };

  useEffect(() => {
    console.log("🔵 Starting connection test...");

    // Connect through Vite's proxy (same origin) so the WS upgrade is handled correctly.
    // Connecting directly to localhost:3001 bypasses the proxy and causes CORS/transport issues.
    const newSocket = io("/", {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected!", newSocket.id);
      setIsConnected(true);
      setConnectionStatus("Connected");
      setDebugInfo(`Connected with ID: ${newSocket.id}`);
      setSocket(newSocket);
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err.message);
      setIsConnected(false);
      setConnectionStatus("Connection Failed");
      setDebugInfo(
        `Socket error: ${err.message}. Make sure server is running on port 3001`,
      );
    });

    newSocket.on("connection-confirmed", (data) => {
      console.log("✅ Server confirmation:", data);
    });

    newSocket.on("game-init", (data) => {
      console.log("🎮 Game initialized:", data);
    });

    newSocket.on("game-state", (state: GameState) => {
      setGameState(state);
    });

    newSocket.on("leaderboard-update", (board: LeaderboardEntry[]) => {
      setLeaderboard(board);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setInGame(false);
      setConnectionStatus("Disconnected");
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket || !inGame) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let newDirection: "up" | "down" | "left" | "right" | null = null;

      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W")
        newDirection = "up";
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S")
        newDirection = "down";
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        newDirection = "left";
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        newDirection = "right";

      if (newDirection) {
        e.preventDefault();
        changeDirection(newDirection);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [socket, inGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid lines with neon effect
    ctx.strokeStyle = "#1a1a3a";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_SIZE, i);
      ctx.stroke();
    }

    // Draw food with glow
    if (gameState.food) {
      // Outer glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#ff00ff";

      // Inner circle
      ctx.fillStyle = "#ff00ff";
      ctx.beginPath();
      ctx.arc(
        gameState.food.x * CELL_SIZE + CELL_SIZE / 2,
        gameState.food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Inner core
      ctx.shadowBlur = 30;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(
        gameState.food.x * CELL_SIZE + CELL_SIZE / 2,
        gameState.food.y * CELL_SIZE + CELL_SIZE / 2,
        3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Draw players (snakes)
    gameState.players.forEach((player) => {
      if (!player.isAlive || player.snake.length === 0) return;

      // Draw snake body with trail effect
      player.snake.forEach((segment, index) => {
        const opacity = 1 - (index / player.snake.length) * 0.6;

        ctx.shadowBlur = 15;
        ctx.shadowColor = player.color;
        ctx.fillStyle = player.color;
        ctx.globalAlpha = opacity;

        // Draw segment
        ctx.fillRect(
          segment.x * CELL_SIZE + 2,
          segment.y * CELL_SIZE + 2,
          CELL_SIZE - 4,
          CELL_SIZE - 4,
        );

        // Draw head differently (larger and brighter)
        if (index === 0) {
          ctx.shadowBlur = 20;
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(
            segment.x * CELL_SIZE + CELL_SIZE / 2,
            segment.y * CELL_SIZE + CELL_SIZE / 2,
            5,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      });

      // Draw name tag above head
      const head = player.snake[0];
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = 'bold 10px "Courier New"';
      ctx.textAlign = "center";
      ctx.fillText(
        player.name,
        head.x * CELL_SIZE + CELL_SIZE / 2,
        head.y * CELL_SIZE - 5,
      );
    });

    // Reset shadow and alpha
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [gameState]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && socket && isConnected) {
      // Use correct event name: "join-game" not "join-room"
      socket.emit("join-game", {
        playerName: playerName,
        roomId: roomId,
      });
      setInGame(true);
    }
  };

  if (!inGame) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white bg-gradient-to-br from-gray-900 to-black">
        <h1 className="text-6xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]">
          NEON SNAKE
        </h1>
        <div className="mb-4 flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected
                ? "bg-green-500 animate-pulse shadow-[0_0_15px_#00ff00]"
                : "bg-red-500 shadow-[0_0_10px_#ff0000]"
            }`}
          ></div>
          <span className="text-sm uppercase tracking-wider text-gray-300">
            {isConnected ? "SERVER ONLINE" : "CONNECTING..."}
          </span>
        </div>

        {/* Debug info */}
        <div className="mb-4 text-xs text-center text-gray-500 max-w-md">
          <div>Status: {connectionStatus}</div>
          <div className="text-yellow-400">{debugInfo}</div>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-4 w-64">
          <input
            type="text"
            placeholder="ENTER YOUR NAME"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
            className="px-4 py-3 bg-gray-900 border-2 border-purple-500 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 text-center text-cyan-400 font-bold tracking-widest uppercase"
            maxLength={10}
            required
          />
          <button
            type="submit"
            disabled={!isConnected || !playerName.trim()}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed font-bold uppercase tracking-widest rounded shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all"
          >
            ENTER GRID
          </button>
        </form>

        <div className="mt-8 text-xs text-gray-600">
          Use Arrow Keys or WASD to move • Eat food to grow
        </div>
      </div>
    );
  }

  const currentPlayer = gameState?.players.find((p) => p.id === socket?.id);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 to-black">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6">
        {/* Game Area */}
        <div className="flex flex-col items-center">
          <div className="mb-4 flex justify-between w-full text-lg font-bold">
            <div className="text-cyan-400">
              SCORE: {currentPlayer?.score || 0}
            </div>
            <div className="text-purple-400">ROOM: {roomId}</div>
          </div>

          <div 
            className="border-4 border-purple-500 rounded-lg shadow-[0_0_30px_rgba(168,85,247,0.5)] bg-black overflow-hidden relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="block"
            />
            {currentPlayer?.isAlive === false && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center">
                  <h2 className="text-4xl font-bold text-red-500 mb-4 animate-pulse">
                    GAME OVER
                  </h2>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold transition"
                  >
                    PLAY AGAIN
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 text-gray-400 text-sm w-full text-center hidden md:block">
            ⬆️⬇️⬅️➡️ or WASD to move
          </div>

          {/* Mobile D-Pad */}
          <div className="mt-6 md:hidden flex justify-center w-full">
            <div className="grid grid-cols-3 gap-2 w-48 h-48">
              <div />
              <button 
                className="bg-purple-600/50 hover:bg-purple-500 rounded-lg active:bg-purple-400 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-colors"
                onTouchStart={(e) => { e.preventDefault(); changeDirection("up"); }}
                onClick={(e) => { e.preventDefault(); changeDirection("up"); }}
              >⬆️</button>
              <div />
              <button 
                className="bg-cyan-600/50 hover:bg-cyan-500 rounded-lg active:bg-cyan-400 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-colors"
                onTouchStart={(e) => { e.preventDefault(); changeDirection("left"); }}
                onClick={(e) => { e.preventDefault(); changeDirection("left"); }}
              >⬅️</button>
              <button 
                className="bg-purple-600/50 hover:bg-purple-500 rounded-lg active:bg-purple-400 flex items-center justify-center text-3xl transition-colors"
                onTouchStart={(e) => { e.preventDefault(); changeDirection("down"); }}
                onClick={(e) => { e.preventDefault(); changeDirection("down"); }}
              >⬇️</button>
              <button 
                className="bg-cyan-600/50 hover:bg-cyan-500 rounded-lg active:bg-cyan-400 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-colors"
                onTouchStart={(e) => { e.preventDefault(); changeDirection("right"); }}
                onClick={(e) => { e.preventDefault(); changeDirection("right"); }}
              >➡️</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-gray-900/80 border border-cyan-500 rounded-lg p-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <h3 className="text-xl font-bold text-cyan-400 mb-4 border-b border-cyan-500/30 pb-2">
              LEADERBOARD
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No scores yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div
                    key={`${entry.playerId}-${i}`}
                    className="flex justify-between items-center text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-bold">{i + 1}.</span>
                      <span
                        className={
                          entry.playerId === socket?.id
                            ? "text-green-400 font-bold"
                            : "text-gray-300"
                        }
                      >
                        {entry.playerName}
                      </span>
                    </div>
                    <span className="text-yellow-400 font-bold">
                      {entry.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900/80 border border-purple-500 rounded-lg p-4 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
            <h3 className="text-xl font-bold text-purple-400 mb-4 border-b border-purple-500/30 pb-2">
              PLAYERS ONLINE
            </h3>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
              {gameState?.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{
                        backgroundColor: p.color,
                        boxShadow: `0 0 10px ${p.color}`,
                      }}
                    ></div>
                    <span
                      className={
                        !p.isAlive
                          ? "line-through text-gray-600"
                          : "text-gray-300"
                      }
                    >
                      {p.name} {p.id === socket?.id && "(you)"}
                    </span>
                  </div>
                  <span className="text-cyan-400">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeonSnakeGame;
