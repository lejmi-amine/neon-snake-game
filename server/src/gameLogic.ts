import { Position, Direction, Player } from "./types.js";

export const GRID_SIZE = 20;
const INITIAL_SNAKE_LENGTH = 3;

export function createInitialSnake(startX: number, startY: number): Position[] {
  const snake: Position[] = [];
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.push({ x: startX - i, y: startY });
  }
  return snake;
}

export function generateFood(players: Player[], gridSize: number): Position {
  const occupied = new Set<string>();

  players.forEach((player) => {
    if (player.isAlive) {
      player.snake.forEach((segment) => {
        occupied.add(`${segment.x},${segment.y}`);
      });
    }
  });

  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const food = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };

    if (!occupied.has(`${food.x},${food.y}`)) {
      return food;
    }
  }

  // If no free spot found, return a default position
  return { x: 5, y: 5 };
}

export function moveSnake(
  snake: Position[],
  direction: Direction,
  grow: boolean = false,
): Position[] {
  const head = snake[0];
  const newHead = { ...head };

  switch (direction) {
    case "up":
      newHead.y -= 1;
      break;
    case "down":
      newHead.y += 1;
      break;
    case "left":
      newHead.x -= 1;
      break;
    case "right":
      newHead.x += 1;
      break;
  }

  const newSnake = [newHead, ...snake];

  if (!grow) {
    newSnake.pop();
  }

  return newSnake;
}

export function checkCollision(snake: Position[], gridSize: number): boolean {
  const head = snake[0];

  // Wall collision
  if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
    return true;
  }

  // Self collision (skip the head)
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }

  return false;
}

export function checkFoodCollision(snake: Position[], food: Position): boolean {
  const head = snake[0];
  return head.x === food.x && head.y === food.y;
}

export function calculateScore(snakeLength: number): number {
  return (snakeLength - 3) * 10;
}
