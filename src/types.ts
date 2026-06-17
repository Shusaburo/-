/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CellType {
  EMPTY = 0,
  DIRT = 1, // Soil that the player can dig through
  WALL = 2, // Solid bedrock (indestructible)
  GOAL = 3, // Destination level clear
  GEM = 4,  // Collectible diamond
  FREEZE_DIRT = 5, // Dirt that stops/freezes enemies
  SPEED_DIRT = 6,  // Dirt that speeds up player
  POWER_SHIELD = 7, // Item: Invincibility shield
  POWER_DRILL = 8,  // Item: Instant-drill power-up
  HARD_DIRT = 9     // Hard soil that needs multiple drill hits
}

export type Position = {
  x: number;
  y: number;
};

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type EnemyType = 'CHASER' | 'WANDERER' | 'GHOST' | 'PATROLLER' | 'AMBUSHER';

export interface Enemy {
  id: string;
  type: EnemyType;
  pos: Position;
  dir: Direction | null;
  prevPos: Position;
  trappedRemaining: number; // in turns or server seconds, 0 means active
  speedCooldown: number; // rate of movement
  color: string;
  patrolNodes?: Position[]; // List of points of interests in patrol area
  patrolIndex?: number;      // Array index of current patrolling target node
  ambushState?: 'SLEEP' | 'ALERT'; // Sleeping or actively rushing
  isCamouflaged?: boolean;   // Visually indicator for sleep mode
}

export interface Player {
  pos: Position;
  dir: Direction | null;
  targetPos: Position | null; // for smooth moving transition
  digProgress: number; // 0 to 100 while actively digging a dirt tile
  diggingDir: Direction | null;
  lives: number;
  score: number;
  gemsCollected: number;
  totalGemsInLevel: number;
}

export interface Trap {
  id: string;
  pos: Position;
  timeLeft: number; // seconds or ticks remaining before it automatically refills
  maxTime: number;
  isFilledWithEnemy: string | null; // holds Enemy.id if an enemy is trapped inside
}

export interface DiggableGridEffect {
  pos: Position;
  progress: number; // 0 to 1
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  grid: CellType[][];
  playerStart: Position;
  enemyStarts: { pos: Position; type: EnemyType }[];
  goalPos: Position;
  theme: {
    bg: string;
    dirt: string;
    rock: string;
    descriptionColor: string;
  };
}

export type GameScreen = 'TITLE' | 'INSTRUCTIONS' | 'PLAYING' | 'PAUSED' | 'LEVEL_CLEAR' | 'GAMEOVER' | 'VICTORY';
