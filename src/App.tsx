/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, RotateCcw, Pause, HelpCircle, Trophy, Heart, 
  Sparkles, Drill, ShieldAlert, Ghost, Compass, ArrowUp, 
  ArrowDown, ArrowLeft, ArrowRight, Volume2, Gamepad2, X, AlertTriangle,
  Snowflake, Zap, Shield, EyeOff
} from 'lucide-react';
import { CellType, GameScreen, EnemyType, Position, Player, Enemy, Trap, Particle, Direction } from './types';
import { parseLevel, totalLevelsCount } from './levels';
import { synth } from './audio';
import { SoundToggle } from './components/SoundToggle';
import { Instructions } from './components/Instructions';

export default function App() {
  // Game state screens
  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [levelIndex, setLevelIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('grid_dig_highscore');
      return saved ? parseInt(saved, 10) : 5000;
    } catch {
      return 5000;
    }
  });
  const [lives, setLives] = useState<number>(3);
  
  // Active game maps
  const [level, setLevel] = useState(() => parseLevel(0));
  const [grid, setGrid] = useState<CellType[][]>([]);
  const [player, setPlayer] = useState<Player>({
    pos: { x: 1, y: 1 },
    dir: null,
    targetPos: null,
    digProgress: 0,
    diggingDir: null,
    lives: 3,
    score: 0,
    gemsCollected: 0,
    totalGemsInLevel: 0,
  });
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [traps, setTraps] = useState<Trap[]>([]);

  // Power-up durations (in seconds)
  const [freezeTimer, setFreezeTimer] = useState<number>(0);
  const [speedTimer, setSpeedTimer] = useState<number>(0);
  const [shieldTimer, setShieldTimer] = useState<number>(0);
  const [drillTimer, setDrillTimer] = useState<number>(0);
  const [drillHeat, setDrillHeat] = useState<number>(15);
  
  // Timing
  const [readyTimer, setReadyTimer] = useState<number>(2); // 2-second stage intro freezes play
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameActive, setGameActive] = useState<boolean>(false);

  // Screen shake animation effect state
  const [shakeScreen, setShakeScreen] = useState<boolean>(false);
  
  // Custom alert bubble overlay
  const [alertBubble, setAlertBubble] = useState<{ text: string; x: number; y: number; time: number } | null>(null);

  // Dynamic grid pixel sizing to scale drawing
  const [cellSize, setCellSize] = useState<number>(40);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Particles Ref to bypass heavy React states during 60FPS renders
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // High score saver
  const saveHighScore = useCallback((newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      try {
        localStorage.setItem('grid_dig_highscore', newScore.toString());
      } catch (e) {
        console.warn("Storage write failed:", e);
      }
    }
  }, [highScore]);

  // Adjust cell size on resize for perfect layout scaling
  const handleResize = useCallback(() => {
    if (gridContainerRef.current) {
      const containerWidth = gridContainerRef.current.clientWidth;
      const mapWidthCells = level.grid[0].length;
      // Calculate fit size (constrain standard cells within available bounds)
      const calculated = Math.min(Math.floor((containerWidth - 20) / mapWidthCells), 48);
      // Fallback size
      setCellSize(Math.max(calculated, 24));
    }
  }, [level]);

  // Observer to track grid container dimensions
  useEffect(() => {
    handleResize();
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    if (gridContainerRef.current) {
      observer.observe(gridContainerRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, [level, handleResize]);

  // Synchronizing Refs for the game tick
  const playerRef = useRef(player);
  const gridRef = useRef(grid);
  const trapsRef = useRef(traps);
  const freezeTimerRef = useRef(freezeTimer);
  const levelRef = useRef(level);

  // Keep them updated on each render
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    trapsRef.current = traps;
  }, [traps]);

  useEffect(() => {
    freezeTimerRef.current = freezeTimer;
  }, [freezeTimer]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  // Particle injector helper
  const triggerParticles = useCallback((gridX: number, gridY: number, color: string, count: number, speedMultiplier = 1) => {
    const newParticles: Particle[] = [];
    const pixels = cellSize;
    const startX = gridX * pixels + pixels / 2;
    const startY = gridY * pixels + pixels / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 3 + 1) * speedMultiplier;
      newParticles.push({
        id: Math.random().toString() + Date.now(),
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 1.5), // slightly throw upwards
        color,
        size: Math.random() * 4 + 1.5,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 18 + 12,
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
  }, [cellSize]);

  // Initialize selected Level state
  const loadLevel = useCallback((index: number) => {
    const parsed = parseLevel(index);
    setLevel(parsed);
    setGrid(JSON.parse(JSON.stringify(parsed.grid))); 
    setLevelIndex(index);
    setReadyTimer(2.5); // countdown stage duration
    setTraps([]);
    setFreezeTimer(0);
    setSpeedTimer(0);
    setShieldTimer(0);
    setDrillTimer(0);

    // Count crystals remaining
    let crystalTally = 0;
    parsed.grid.forEach(row => {
      row.forEach(cell => {
        if (cell === CellType.GEM) crystalTally++;
      });
    });

    setPlayer({
      pos: { ...parsed.playerStart },
      dir: 'DOWN',
      targetPos: null,
      digProgress: 0,
      diggingDir: null,
      lives: 3, // backup inside level initialization
      score,
      gemsCollected: 0,
      totalGemsInLevel: crystalTally,
    });

    // Populate active AI state structures
    const loadedEnemies = parsed.enemyStarts.map((e, idx) => {
      let patrolNodes: Position[] = [];
      if (e.type === 'PATROLLER') {
        const sx = e.pos.x;
        const sy = e.pos.y;
        // Build a tight 4-point loop for vertical and lateral scanning
        patrolNodes = [
          { x: sx, y: sy },
          { x: Math.min(sx + 3, parsed.grid[0].length - 2), y: sy },
          { x: Math.min(sx + 3, parsed.grid[0].length - 2), y: Math.min(sy + 4, parsed.grid.length - 2) },
          { x: sx, y: Math.min(sy + 4, parsed.grid.length - 2) }
        ];
      }

      return {
        id: `enemy-${idx}-${Date.now()}`,
        type: e.type,
        pos: { ...e.pos },
        dir: null as Direction | null,
        prevPos: { ...e.pos },
        trappedRemaining: 0,
        speedCooldown: 0,
        color: e.type === 'CHASER' ? '#ef4444' : 
               e.type === 'WANDERER' ? '#eab308' : 
               e.type === 'GHOST' ? '#a78bfa' :
               e.type === 'PATROLLER' ? '#06b6d4' : '#f97316',
        patrolNodes: patrolNodes.length > 0 ? patrolNodes : undefined,
        patrolIndex: patrolNodes.length > 0 ? 0 : undefined,
        ambushState: e.type === 'AMBUSHER' ? 'SLEEP' as const : undefined,
        isCamouflaged: e.type === 'AMBUSHER' ? true : undefined,
      };
    });
    setEnemies(loadedEnemies);
    setIsPaused(false);
    
    // Play intro chord
    synth.playLevelClear();
  }, [score]);

  // Trigger level initialization when playing starts
  const startPlaying = (levelSelected: number) => {
    setLives(3);
    setScore(0);
    loadLevel(levelSelected);
    setScreen('PLAYING');
    setGameActive(true);
    synth.playBGM();
  };

  // BFS solver for Red Chase algorithm and Purple Ghost algorithm
  const findBfsPathDirection = useCallback((
    start: Position, 
    target: Position, 
    gameGrid: CellType[][], 
    canPassDirt: boolean,
    blockTraps: Trap[]
  ): Direction | null => {
    const queue: { pos: Position; path: Direction[] }[] = [];
    const visited = new Set<string>();
    const key = (p: Position) => `${p.x},${p.y}`;

    queue.push({ pos: start, path: [] });
    visited.add(key(start));

    const height = gameGrid.length;
    const width = gameGrid[0].length;

    const dirs: { dir: Direction; dx: number; dy: number }[] = [
      { dir: 'UP', dx: 0, dy: -1 },
      { dir: 'DOWN', dx: 0, dy: 1 },
      { dir: 'LEFT', dx: -1, dy: 0 },
      { dir: 'RIGHT', dx: 1, dy: 0 },
    ];

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;

      if (pos.x === target.x && pos.y === target.y) {
        return path[0] || null;
      }

      for (const { dir, dx, dy } of dirs) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        const npos = { x: nx, y: ny };
        const nkey = key(npos);

        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(nkey)) {
          const cell = gameGrid[ny][nx];
          const hasTrap = blockTraps.some(t => t.pos.x === nx && t.pos.y === ny);
          
          let isNavigable = false;
          if (cell === CellType.EMPTY || cell === CellType.GEM || cell === CellType.GOAL) {
            if (!hasTrap) {
              isNavigable = true;
            }
          } else if (cell === CellType.DIRT && canPassDirt) {
            // ghost passes through DIRT
            isNavigable = true;
          }

          if (isNavigable) {
            visited.add(nkey);
            queue.push({ pos: npos, path: [...path, dir] });
          }
        }
      }
    }

    // Direct line fallback
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      return dy > 0 ? 'DOWN' : 'UP';
    }
  }, []);

  // Trap Dig trigger
  const attemptDigTrap = useCallback((side: 'LEFT' | 'RIGHT') => {
    if (screen !== 'PLAYING' || isPaused || readyTimer > 0) return;
    
    // Find target cell coordinates
    const offset = side === 'LEFT' ? -1 : 1;
    const tx = player.pos.x + offset;
    const ty = player.pos.y; // Dig on the path player is standing beside (Classic Arcade layout)

    const height = grid.length;
    const width = grid[0] ? grid[0].length : 0;

    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return;

    const targetCell = grid[ty][tx];
    const isTrapAlready = traps.some(t => t.pos.x === tx && t.pos.y === ty);

    // Can only dig traps on EMPTY floor cells. No rocks, no active traps, no goals, no gems.
    if (targetCell === CellType.EMPTY && !isTrapAlready) {
      const newTrap: Trap = {
        id: `trap-${tx}-${ty}-${Date.now()}`,
        pos: { x: tx, y: ty },
        timeLeft: 6, // Refills and closes automatically after 6 seconds
        maxTime: 6,
        isFilledWithEnemy: null
      };

      setTraps(prev => [...prev, newTrap]);
      triggerParticles(tx, ty, '#854d0e', 14, 0.8); // dirt puff for open hole
      synth.playTrap();
      
      // Face dig direction
      setPlayer(prev => ({
        ...prev,
        dir: side === 'LEFT' ? 'LEFT' : 'RIGHT'
      }));
    }
  }, [grid, traps, player.pos, screen, isPaused, readyTimer, triggerParticles]);

  // Action: Main movement executive
  const executePlayerStep = useCallback((dir: Direction) => {
    if (screen !== 'PLAYING' || isPaused || readyTimer > 0) return;

    // Direct movement coordinates delta
    let dx = 0;
    let dy = 0;
    if (dir === 'UP') dy = -1;
    if (dir === 'DOWN') dy = 1;
    if (dir === 'LEFT') dx = -1;
    if (dir === 'RIGHT') dx = 1;

    const nx = player.pos.x + dx;
    const ny = player.pos.y + dy;
    const mapHeight = grid.length;
    const mapWidth = grid[0] ? grid[0].length : 0;

    // Boundary block
    if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) return;

    // Action A: Trapped Enemy Drill Explosion check
    const activeTrap = traps.find(t => t.pos.x === nx && t.pos.y === ny);
    if (activeTrap && activeTrap.isFilledWithEnemy) {
      const enemyId = activeTrap.isFilledWithEnemy;
      
      // Smash/Crush the enemy!
      synth.playEnemyTrapped(); 
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 400);

      triggerParticles(nx, ny, '#ef4444', 35, 1.6); // Red golden blast
      triggerParticles(nx, ny, '#fbbf24', 25, 1.2);

      setAlertBubble({
        text: "💥 ドリル撃破！ CRUSH!! (+350)",
        x: nx,
        y: ny,
        time: 2.2
      });

      // Reward points
      setScore(s => {
        const nextScore = s + 350;
        saveHighScore(nextScore);
        return nextScore;
      });

      // Clear the trap's enemy pointer
      setTraps(curr => curr.map(t => t.id === activeTrap.id ? { ...t, isFilledWithEnemy: null } : t));

      // Reset the enemy to spawn coordinates, marking them dead
      setEnemies(currEnemies => {
        return currEnemies.map(enemy => {
          if (enemy.id === enemyId) {
            return {
              ...enemy,
              isDead: true,
              respawnTimer: 11,
              pos: { ...level.enemyStarts[0]?.pos || { x: 3, y: 3 } },
              trappedRemaining: 0,
            } as any;
          }
          return enemy;
        });
      });

      // Do adjacent drill strike rotation without stepping on trap
      setPlayer(prev => ({ ...prev, dir }));
      return;
    }

    const destinationCell = grid[ny][nx];

    // Case 1: ROCK/WALL - absolute halt
    if (destinationCell === CellType.WALL) {
      return;
    }

    // Support drill temperature simulation
    if (destinationCell === CellType.DIRT || destinationCell === CellType.HARD_DIRT || destinationCell === CellType.FREEZE_DIRT || destinationCell === CellType.SPEED_DIRT) {
      setDrillHeat(h => Math.min(100, h + 8));
    }

    // Case 2: DIRT / HARD_DIRT - start custom progressive drill
    const isSpecialDirt = destinationCell === CellType.FREEZE_DIRT || destinationCell === CellType.SPEED_DIRT;
    const isHardDirt = destinationCell === CellType.HARD_DIRT;
    if (destinationCell === CellType.DIRT || isHardDirt || isSpecialDirt) {
      setPlayer(prev => {
        // Normal DIRT & special dirt is fast: 1 hit (100 speed)
        // Hard DIRT: 5 hits (20 speed per hit) to make it much tougher
        // If super-drill active (drillTimer > 0), any block is instantly pulverized (100 speed)
        let drillSpeed = 100;
        if (isHardDirt) {
          drillSpeed = drillTimer > 0 ? 100 : (speedTimer > 0 ? 40 : 20); 
        } else {
          drillSpeed = 100;
        }

        const nextProgress = prev.diggingDir === dir ? prev.digProgress + drillSpeed : drillSpeed;
        
        // play digging effects
        synth.playDig();
        
        // Particle colors based on density
        const dustColor = isSpecialDirt ? '#22d3ee' : (isHardDirt ? '#78350f' : '#a16207');
        triggerParticles(nx, ny, dustColor, isHardDirt ? 14 : 8, 0.8);

        if (nextProgress >= 100) {
          // Drill complete! Turn grid tile to blank
          const nextGrid = [...grid];
          nextGrid[ny][nx] = CellType.EMPTY;
          setGrid(nextGrid);
          
          triggerParticles(nx, ny, isSpecialDirt ? '#06b6d4' : (isHardDirt ? '#451a03' : '#854d0e'), 22, 1.2); 
          
          let cellTriggerText = "";
          if (isHardDirt) {
            setScore(s => s + 50); // reward points for drilling hard dirt
            cellTriggerText = "岩岩盤破壊！ HARD CRUSHED! (+50)";
          } else if (destinationCell === CellType.FREEZE_DIRT) {
            setFreezeTimer(5);
            setScore(s => s + 150);
            cellTriggerText = "敵が氷結！ (Enemies Frozen!)";
            synth.playEnemyTrapped();
            triggerParticles(nx, ny, '#67e8f9', 25, 1.4);
          } else if (destinationCell === CellType.SPEED_DIRT) {
            setSpeedTimer(6);
            setScore(s => s + 150);
            cellTriggerText = "移動ブースト！ (Speed Jet!)";
            synth.playGem();
            triggerParticles(nx, ny, '#fb923c', 25, 1.4);
          }

          if (cellTriggerText) {
            setAlertBubble({
              text: cellTriggerText,
              x: nx,
              y: ny,
              time: 2
            });
          }

          return {
            ...prev,
            pos: { x: nx, y: ny },
            dir,
            diggingDir: null,
            digProgress: 0
          };
        }

        return {
          ...prev,
          dir,
          diggingDir: dir,
          digProgress: nextProgress
        };
      });
      return;
    }

    // Case 3: Navigable Space (EMPTY, GEMS, LADDER GOALS, POWERUPS)
    const collectedGemArr: Position[] = [];
    let stateClearLevel = false;
    let bonusPoints = 0;

    const nextGrid = [...grid];
    if (destinationCell === CellType.GEM) {
      nextGrid[ny][nx] = CellType.EMPTY;
      setGrid(nextGrid);
      collectedGemArr.push({ x: nx, y: ny });
      bonusPoints = 100;
      synth.playGem();
    }

    if (destinationCell === CellType.POWER_SHIELD) {
      nextGrid[ny][nx] = CellType.EMPTY;
      setGrid(nextGrid);
      setShieldTimer(8);
      bonusPoints = 200;
      synth.playLevelClear();
      triggerParticles(nx, ny, '#fbbf24', 30, 1.5);
      setAlertBubble({
        text: "無敵シールドオン！ (Shield Active!)",
        x: nx,
        y: ny,
        time: 2.5
      });
    }

    if (destinationCell === CellType.POWER_DRILL) {
      nextGrid[ny][nx] = CellType.EMPTY;
      setGrid(nextGrid);
      setDrillTimer(8);
      bonusPoints = 200;
      synth.playLevelClear();
      triggerParticles(nx, ny, '#a855f7', 30, 1.5);
      setAlertBubble({
        text: "超電磁ドリル展開！ (Hyper Drill!)",
        x: nx,
        y: ny,
        time: 2.5
      });
    }

    if (destinationCell === CellType.GOAL) {
      // Check crystal lock status
      if (player.gemsCollected + collectedGemArr.length >= player.totalGemsInLevel) {
        stateClearLevel = true;
      } else {
        // Overlay prompt
        setAlertBubble({
          text: `まだ鉱石が足りません！ (${player.gemsCollected}/${player.totalGemsInLevel})`,
          x: nx,
          y: ny,
          time: 2.5
        });
      }
    }

    setPlayer(prev => {
      const tally = prev.gemsCollected + collectedGemArr.length;
      const bonusScore = prev.score + bonusPoints;
      
      if (bonusPoints > 0) {
        setScore(bonusScore);
      }

      return {
        ...prev,
        pos: { x: nx, y: ny },
        dir,
        diggingDir: null,
        digProgress: 0,
        gemsCollected: tally
      };
    });

    if (destinationCell === CellType.GEM) {
      triggerParticles(nx, ny, '#22d3ee', 24, 1.4); // brilliant cyan sparkles
    }

    if (stateClearLevel) {
      // Level cleared successfully!
      const levelCompletionScore = score + 1000; // Flat clear bonus (+1000 PTS)
      setScore(levelCompletionScore);
      saveHighScore(levelCompletionScore);
      synth.stopBGM();
      synth.playLevelClear();
      setScreen('LEVEL_CLEAR');
    }

  }, [grid, player, screen, isPaused, readyTimer, triggerParticles, score, saveHighScore, drillTimer, speedTimer, level, traps]);


  // Key hooks setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'PLAYING' || isPaused) return;

      const key = e.key.toLowerCase();
      const code = e.code;
      // Arrow & WASD overrides to avoid iframe scroll
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key) || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowUp' || key === 'w' || code === 'KeyW') executePlayerStep('UP');
      else if (e.key === 'ArrowDown' || key === 's' || code === 'KeyS') executePlayerStep('DOWN');
      else if (e.key === 'ArrowLeft' || key === 'a' || code === 'KeyA') executePlayerStep('LEFT');
      else if (e.key === 'ArrowRight' || key === 'd' || code === 'KeyD') executePlayerStep('RIGHT');
      else if (key === 'z' || key === 'j' || code === 'KeyZ' || code === 'KeyJ') attemptDigTrap('LEFT');
      else if (key === 'x' || key === 'k' || code === 'KeyX' || code === 'KeyK') attemptDigTrap('RIGHT');
      else if (e.key === ' ') {
        // Spacebar acts as immediate direction manual drill if neighbor is Dirt
        if (player.dir) {
          let dx = 0; let dy = 0;
          if (player.dir === 'UP') dy = -1;
          if (player.dir === 'DOWN') dy = 1;
          if (player.dir === 'LEFT') dx = -1;
          if (player.dir === 'RIGHT') dx = 1;

          const tx = player.pos.x + dx;
          const ty = player.pos.y + dy;
          if (grid[ty] && grid[ty][tx] === CellType.DIRT) {
            executePlayerStep(player.dir);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [executePlayerStep, attemptDigTrap, screen, isPaused, player.dir, player.pos, grid]);


  // Timers and game pace loop
  useEffect(() => {
    let airTimerId: NodeJS.Timeout | null = null;
    let enemyTickId: NodeJS.Timeout | null = null;

    if (screen === 'PLAYING' && !isPaused) {
      // 1. General state countdown timer
      airTimerId = setInterval(() => {
        if (readyTimer > 0) {
          setReadyTimer(prev => {
            const next = prev - 0.5;
            return next < 0 ? 0 : next;
          });
          return;
        }

        // Decrement power-up timers
        setFreezeTimer(prev => prev > 0 ? prev - 1 : 0);
        setSpeedTimer(prev => prev > 0 ? prev - 1 : 0);
        setShieldTimer(prev => prev > 0 ? prev - 1 : 0);
        setDrillTimer(prev => prev > 0 ? prev - 1 : 0);

        // Natural heat dissipation for standard engine cooling
        setDrillHeat(h => Math.max(10, h - 3));

        // Bubble decay count down
        setAlertBubble(prev => {
          if (prev && prev.time > 0) {
            const nextTime = prev.time - 1;
            return nextTime <= 0 ? null : { ...prev, time: nextTime };
          }
          return null;
        });

      }, 1000);

      // 2. Continuous Enemy Clock-Tick
      // Handles enemy movement and trap timing decay
      const SPEED_TICK = 270; // Base interval game speed tightened to 270ms to make enemies highly aggressive
      let tickTracker = 0;

      enemyTickId = setInterval(() => {
        if (readyTimer > 0) return;

        tickTracker++;

        // A. Trapped state updates & refill mechanics
        setTraps(currentTraps => {
          const finishedTraps: Trap[] = [];
          const activeTraps = currentTraps.filter(trap => {
            const nextTime = trap.timeLeft - (SPEED_TICK / 1000);
            if (nextTime <= 0) {
              finishedTraps.push(trap);
              return false; // delete
            }
            trap.timeLeft = nextTime;
            return true;
          });

          // Process crushes on block re-filling
          if (finishedTraps.length > 0) {
            finishedTraps.forEach(trap => {
              synth.playDirtRefilled();
              triggerParticles(trap.pos.x, trap.pos.y, '#713f12', 12, 0.8);
              
              if (trap.isFilledWithEnemy) {
                const targetId = trap.isFilledWithEnemy;
                
                // Blast point and score increases +200
                setScore(s => {
                  const ns = s + 200;
                  saveHighScore(ns);
                  return ns;
                });

                // Set killed indicator for respawning after a standard buffer
                setEnemies(currEnemies => {
                  return currEnemies.map(enemy => {
                    if (enemy.id === targetId) {
                      triggerParticles(enemy.pos.x, enemy.pos.y, '#dc2626', 22, 1.3);
                      return {
                        ...enemy,
                        isDead: true,
                        // respawn in 3 seconds (approx 11 game ticks)
                        respawnTimer: 11,
                        pos: { ...levelRef.current.enemyStarts[0]?.pos || { x: 3, y: 3 } }, // fallback spawn coordinates
                        trappedRemaining: 0,
                      };
                    }
                    return enemy;
                  });
                });
              }
            });
          }
          return activeTraps;
        });

        // B. Enemy Movement
        setEnemies(currEnemies => {
          // Check collision and copy
          return currEnemies.map(enemy => {
            // Death stopwatch
            if ('respawnTimer' in enemy && (enemy as any).respawnTimer > 0) {
              const nextTime = (enemy as any).respawnTimer - 1;
              const isDeadNow = nextTime > 0;
              return {
                ...enemy,
                respawnTimer: nextTime,
                isDead: isDeadNow
              } as any;
            }

            // Trapped cooldown decrement
            if (enemy.trappedRemaining > 0) {
              const nextTrapped = enemy.trappedRemaining - 1;
              return {
                ...enemy,
                trappedRemaining: nextTrapped
              };
            }

            // Freeze block effect: prevent normal enemy movement
            if (freezeTimerRef.current > 0) {
              return enemy;
            }

            // Decide individual pacing based on type
            let shouldMove = false;
            let currentType = enemy.type;

            if (currentType === 'CHASER') {
              shouldMove = true;
            } else if (currentType === 'WANDERER') {
              const isPlayerVisible = 
                (enemy.pos.x === playerRef.current.pos.x) || (enemy.pos.y === playerRef.current.pos.y);
              if (isPlayerVisible) {
                shouldMove = true;
              } else {
                shouldMove = (tickTracker % 2 === 0);
              }
            } else if (currentType === 'GHOST') {
              // ゴーストは2 ticksに1回移動＋たまに気まぐれに毎ターン浮遊して迫ります！（すり抜けの超恐怖）
              shouldMove = (tickTracker % 2 === 0) || (Math.random() < 0.25);
            } else if (currentType === 'PATROLLER') {
              // パトローラーは警備を完璧にこなすため、常に（毎刻）移動し、隙を与えません！
              shouldMove = true;
            } else if (currentType === 'AMBUSHER') {
              const dx = Math.abs(enemy.pos.x - playerRef.current.pos.x);
              const dy = Math.abs(enemy.pos.y - playerRef.current.pos.y);
              const distance = dx + dy;

              if (enemy.ambushState === 'SLEEP') {
                if (distance <= 4) {
                  // Wake up!
                  enemy.ambushState = 'ALERT';
                  enemy.isCamouflaged = false;
                  synth.playDig(); // alert sound cue
                  triggerParticles(enemy.pos.x, enemy.pos.y, '#f97316', 15, 1.1);
                  setAlertBubble({
                    text: "💥 奇襲突撃 (AMBUSHED!)",
                    x: enemy.pos.x,
                    y: enemy.pos.y,
                    time: 2
                  });
                  shouldMove = true;
                } else {
                  shouldMove = false; // Stay sleeping
                }
              } else {
                shouldMove = true; // Chase!
              }
            }

            if (!shouldMove) return enemy;

            // Generate path using BFS or line chasing
            let targetDirection: Direction | null = null;

            if (enemy.type === 'CHASER') {
              // Pathfind cleanly
              targetDirection = findBfsPathDirection(enemy.pos, playerRef.current.pos, gridRef.current, false, trapsRef.current);
            } 
            else if (enemy.type === 'PATROLLER') {
              if (enemy.patrolNodes && enemy.patrolNodes.length > 0) {
                let pIdx = enemy.patrolIndex ?? 0;
                let targetNode = enemy.patrolNodes[pIdx];

                // Check node arrival
                if (enemy.pos.x === targetNode.x && enemy.pos.y === targetNode.y) {
                  pIdx = (pIdx + 1) % enemy.patrolNodes.length;
                  enemy.patrolIndex = pIdx;
                  targetNode = enemy.patrolNodes[pIdx];
                }

                targetDirection = findBfsPathDirection(enemy.pos, targetNode, gridRef.current, false, trapsRef.current);
              }
              if (!targetDirection) {
                const randDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
                targetDirection = randDirs[Math.floor(Math.random() * randDirs.length)];
              }
            }
            else if (enemy.type === 'AMBUSHER') {
              targetDirection = findBfsPathDirection(enemy.pos, playerRef.current.pos, gridRef.current, false, trapsRef.current);
            }
            else if (enemy.type === 'WANDERER') {
              // Check alignment
              const inlineX = enemy.pos.x === playerRef.current.pos.x;
              const inlineY = enemy.pos.y === playerRef.current.pos.y;
              let straightChase = false;
              let chaseDir: Direction | null = null;

              if (inlineX) {
                const step = playerRef.current.pos.y > enemy.pos.y ? 1 : -1;
                let blockage = false;
                // verify clear visual corridor
                for (let y = enemy.pos.y + step; y !== playerRef.current.pos.y; y += step) {
                  if (gridRef.current[y] && gridRef.current[y][enemy.pos.x] !== CellType.EMPTY) {
                    blockage = true;
                    break;
                  }
                }
                if (!blockage) {
                  straightChase = true;
                  chaseDir = step > 0 ? 'DOWN' : 'UP';
                }
              } else if (inlineY) {
                const step = playerRef.current.pos.x > enemy.pos.x ? 1 : -1;
                let blockage = false;
                for (let x = enemy.pos.x + step; x !== playerRef.current.pos.x; x += step) {
                  if (gridRef.current[enemy.pos.y] && gridRef.current[enemy.pos.y][x] !== CellType.EMPTY) {
                    blockage = true;
                    break;
                  }
                }
                if (!blockage) {
                  straightChase = true;
                  chaseDir = step > 0 ? 'RIGHT' : 'LEFT';
                }
              }

              if (straightChase && chaseDir) {
                targetDirection = chaseDir;
              } else {
                // Simple random walk selection
                const opts: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
                const validDirs = opts.filter(d => {
                  let ex = enemy.pos.x;
                  let ey = enemy.pos.y;
                  if (d === 'UP') ey--;
                  if (d === 'DOWN') ey++;
                  if (d === 'LEFT') ex--;
                  if (d === 'RIGHT') ex++;

                  if (ex < 0 || ex >= gridRef.current[0].length || ey < 0 || ey >= gridRef.current.length) return false;
                  const cCell = gridRef.current[ey][ex];
                  const hasTrap = trapsRef.current.some(t => t.pos.x === ex && t.pos.y === ey);
                  return (cCell === CellType.EMPTY || cCell === CellType.GEM) && !hasTrap;
                });

                if (validDirs.length > 0) {
                  // Keep moving forward priority
                  if (enemy.dir && validDirs.includes(enemy.dir) && Math.random() < 0.7) {
                    targetDirection = enemy.dir;
                  } else {
                    targetDirection = validDirs[Math.floor(Math.random() * validDirs.length)];
                  }
                } else {
                  targetDirection = null;
                }
              }
            } 
            else if (enemy.type === 'GHOST') {
              // Ghost floats through Dirt tiles too
              targetDirection = findBfsPathDirection(enemy.pos, playerRef.current.pos, gridRef.current, true, trapsRef.current);
            }

            if (!targetDirection) return enemy;

            // Step coordinate computation
            let ex = enemy.pos.x;
            let ey = enemy.pos.y;
            if (targetDirection === 'UP') ey--;
            if (targetDirection === 'DOWN') ey++;
            if (targetDirection === 'LEFT') ex--;
            if (targetDirection === 'RIGHT') ex++;

            // Fall check on active traps
            const trappedIndex = trapsRef.current.findIndex(t => t.pos.x === ex && t.pos.y === ey);
            if (trappedIndex !== -1 && !trapsRef.current[trappedIndex].isFilledWithEnemy) {
              // STEP IN TRAP HOLE!
              const updatedTraps = [...trapsRef.current];
              updatedTraps[trappedIndex].isFilledWithEnemy = enemy.id;
              
              setTraps(updatedTraps);
              synth.playEnemyTrapped();
              triggerParticles(ex, ey, '#451a03', 15, 1.1); // splash mud

              return {
                ...enemy,
                pos: { x: ex, y: ey },
                dir: targetDirection,
                trappedRemaining: 6, // stuck for 6 game ticks (approx 2.5 seconds) - NEW debuff shorter!
              };
            }

            return {
              ...enemy,
              prevPos: { ...enemy.pos },
              pos: { x: ex, y: ey },
              dir: targetDirection
            };
          });
        });

      }, SPEED_TICK);
    }

    return () => {
      if (airTimerId) clearInterval(airTimerId);
      if (enemyTickId) clearInterval(enemyTickId);
    };
  }, [screen, isPaused, readyTimer, findBfsPathDirection, triggerParticles, saveHighScore]);


  // Collision watch process
  useEffect(() => {
    if (screen !== 'PLAYING' || readyTimer > 0) return;

    // Detect if any alive and non-immobilized enemy intersects the player
    const touchEnemy = enemies.find(enemy => {
      // trapped or dead enemies cannot harm
      const isTrapped = enemy.trappedRemaining > 0;
      const isDead = (enemy as any).isDead;
      return !isTrapped && !isDead && enemy.pos.x === player.pos.x && enemy.pos.y === player.pos.y;
    });

    if (touchEnemy) {
      if (shieldTimer > 0 || drillTimer > 0) {
        // Player is shielded/invincible or has the hyper-drill active! Crush the enemy instead!
        const isDrill = drillTimer > 0;
        triggerParticles(touchEnemy.pos.x, touchEnemy.pos.y, isDrill ? '#ec4899' : '#fbbf24', 35, 1.5);
        synth.playEnemyTrapped();
        
        const pts = isDrill ? 150 : 100;
        setScore(s => s + pts);
        setAlertBubble({
          text: isDrill ? "🔥 DRILL DESTROYER! (+150)" : "🛡️ SHIELD CRUSH! (+100)",
          x: touchEnemy.pos.x,
          y: touchEnemy.pos.y,
          time: 2
        });

        setEnemies(currEnemies => {
          return currEnemies.map(enemy => {
            if (enemy.id === touchEnemy.id) {
              return {
                ...enemy,
                isDead: true,
                respawnTimer: 11, // Respawn after 3 seconds / approx 11 ticks
                pos: { ...level.enemyStarts[0]?.pos || { x: 3, y: 3 } },
                trappedRemaining: 0,
              } as any;
            }
            return enemy;
          });
        });
        return;
      }

      // 敵と接触した場合のダメージ処理！
      synth.playHurt();
      triggerParticles(player.pos.x, player.pos.y, '#ef4444', 30, 1.2);
      
      setLives(prev => {
        const nextLives = prev - 1;
        if (nextLives <= 0) {
          // ゲームオーバー
          synth.stopBGM();
          synth.playGameOver();
          setScreen('GAMEOVER');
          return 0;
        } else {
          // プレイヤー位置をリセット
          setPlayer(p => ({
            ...p,
            pos: { ...level.playerStart },
            targetPos: null,
            digProgress: 0,
            diggingDir: null,
          }));
          // 準備タイマー（2秒）をセットして同志に安全な再スタート時間を提供します！
          setReadyTimer(2.0);
          return nextLives;
        }
      });
    }

  }, [enemies, player.pos, screen, readyTimer, level, triggerParticles, shieldTimer, drillTimer]);


  // 60FPS particle render clock using the HTML Canvas context directly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameRateLoop = () => {
      // Clear frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let currentParts = [...particlesRef.current];
      
      currentParts.forEach(p => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // subtle falling gravity
        p.alpha = 1 - (p.life / p.maxLife);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(p.alpha, 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Cull expired
      particlesRef.current = currentParts.filter(p => p.life < p.maxLife);

      animationFrameIdRef.current = requestAnimationFrame(frameRateLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(frameRateLoop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [cellSize]);

  // Adjust particle layer sizing on grid scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid[0]) return;

    const height = grid.length * cellSize;
    const width = grid[0].length * cellSize;
    
    canvas.width = width;
    canvas.height = height;
  }, [grid, cellSize]);

  // Restart handlers
  const handleNextLevel = () => {
    const nextIdx = (levelIndex + 1);
    if (nextIdx >= totalLevelsCount) {
      synth.stopBGM();
      setScreen('VICTORY');
      synth.playVictory();
    } else {
      loadLevel(nextIdx);
      setScreen('PLAYING');
      synth.playBGM();
    }
  };

  const handleRetryLevel = () => {
    loadLevel(levelIndex);
    setScreen('PLAYING');
    synth.playBGM();
  };

  const handleBackToTitle = () => {
    synth.stopBGM();
    setScreen('TITLE');
    setGameActive(false);
  };

  // Proximity warning calculation
  const getProximityStatus = () => {
    const activeEnemies = enemies.filter(e => !e.trappedRemaining && !(e as any).isDead);
    let minDistance = 99;
    activeEnemies.forEach(e => {
      const distance = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
      if (distance < minDistance) {
        minDistance = distance;
      }
    });
    return minDistance;
  };
  const proximityDistance = getProximityStatus();


  return (
    <div id="game-app-root" className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-amber-500 selection:text-black flex flex-col items-center py-6 px-4 retro-grid relative overflow-x-hidden">
      
      {/* Decorative Arcade Header */}
      <header className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-5 border-b border-zinc-900 pb-4 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg border border-amber-400/20">
            <Drill className="w-6 h-6 text-black animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-display font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 uppercase">
              Grid Dig Escape
            </h1>
            <p className="text-[10px] font-mono text-zinc-500 mt-0.5 tracking-widest">
              ARCADE SYSTEM V.1 // 地底脱出フェーズ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SoundToggle />
          <button
            id="manual-button"
            onClick={() => setScreen(screen === 'INSTRUCTIONS' ? 'PLAYING' : 'INSTRUCTIONS')}
            className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-1 text-xs font-mono"
          >
            <HelpCircle className="w-4 h-4 text-amber-500" />
            <span>MANUAL</span>
          </button>
        </div>
      </header>

      {/* Main Action Stage */}
      <main className="w-full max-w-4xl flex-grow flex flex-col items-center justify-center gap-5 z-10 relative">

        {/* 1. TITLE SCREEN */}
        {screen === 'TITLE' && (
          <div id="screen-title" className="w-full max-w-xl bg-zinc-900/80 border-2 border-amber-600/30 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl backdrop-blur-md animate-fade-in relative">
            <div className="absolute top-4 right-4 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] text-amber-400 font-mono">
              CABINET NO.01
            </div>

            <div className="space-y-2 py-4">
              <span className="text-[11px] font-mono tracking-[0.3em] text-amber-400 block uppercase">
                2D GRID EXCATION GAME
              </span>
              <h2 className="text-4xl font-display font-extrabold tracking-tight text-white">
                地底の穴掘り脱出劇!
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed pt-2">
                追ってくる機械兵や亡霊を避け、すべてのルビークリスタルを採掘して地下から昇降機で脱出せよ！
              </p>
            </div>

            {/* Highscore widget */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 max-w-xs mx-auto flex items-center justify-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div className="text-left font-mono">
                <span className="text-[9px] text-zinc-500 block uppercase">ALL-TIME HIGH SCORE</span>
                <span className="text-sm font-bold text-yellow-400">
                  {highScore.toLocaleString()} PTS
                </span>
              </div>
            </div>

            {/* Level selection panel */}
            <div className="space-y-3 pt-3">
              <span className="text-xs text-zinc-400 font-mono block">ステージを選んでスタート：</span>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                {Array.from({ length: totalLevelsCount }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => startPlaying(idx)}
                    className="group bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 p-3 rounded-xl transition-all hover:scale-105 active:scale-95 text-center flex flex-col items-center justify-center gap-1 hover:bg-amber-950/20"
                  >
                    <span className="text-[10px] font-mono text-zinc-500 group-hover:text-amber-400 transition-colors">
                      STG-0{idx + 1}
                    </span>
                    <span className="text-xs font-bold font-display text-zinc-200">
                      第 {idx + 1} 階層
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-4 border-t border-zinc-800">
              <button
                onClick={() => startPlaying(0)}
                className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold font-display shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
              >
                <Play className="w-5 h-5 fill-black" />
                ゲームを開始する
              </button>
              <span className="text-[10px] text-zinc-500 font-mono mt-3.5 block">
                [WASD / 矢印キー] または画面のボタン操作で遊べます // 穴掘りは行きたい方向に押し込みで自動！
              </span>
            </div>
          </div>
        )}

        {/* 2. MANUAL SCREEN OVERLAY */}
        {screen === 'INSTRUCTIONS' && (
          <div id="screen-instructions" className="w-full max-w-xl space-y-4">
            <Instructions />
            <button
              onClick={() => {
                if (gameActive) setScreen('PLAYING');
                else setScreen('TITLE');
              }}
              className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-center font-bold text-xs uppercase"
            >
              閉じる (CLOSE)
            </button>
          </div>
        )}

        {/* 3. CORE PLAYING INTERACTIVE VIEW */}
        {(screen === 'PLAYING' || screen === 'PAUSED') && (
          <div className="w-full flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-5">
            
            {/* LEFT HUD PANEL: Bento Grid Structure */}
            <div className="w-full lg:w-64 flex flex-col gap-4 shrink-0">
              
              {/* Bento Card 1: MISSION */}
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-500/10 to-transparent pointer-events-none" />
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest block font-black">
                    SEC-STAGE // 0{levelIndex + 1}
                  </span>
                  <h3 className="text-base font-display font-black text-white leading-tight">
                    {level.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-sans leading-normal pt-1.5 border-t border-zinc-800/60 mt-1.5">
                    {level.description}
                  </p>
                </div>
              </div>

              {/* Bento Card 2: CORE LIVES & RADAR STATS */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                
                {/* Lives widget */}
                <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col justify-between gap-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Heart className="w-4 h-4 fill-red-500/20 text-red-500 animate-pulse-subtle" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">LIVES TANK</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                      <div key={i} className="w-3.5 h-3.5 rounded bg-gradient-to-b from-red-500 to-red-600 border border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                    ))}
                    {lives === 0 && <span className="text-xs font-mono text-zinc-500 font-black animate-pulse">DEPLETED</span>}
                  </div>
                </div>

                {/* Ore Radar widget */}
                <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col justify-between gap-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">ORE QUANT</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className={`text-lg font-mono font-black tracking-tight ${player.gemsCollected >= player.totalGemsInLevel ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`}>
                      {player.gemsCollected} <span className="text-xs text-zinc-500 font-normal">/ {player.totalGemsInLevel}</span>
                    </span>
                    {player.gemsCollected >= player.totalGemsInLevel && (
                      <span className="text-[8px] font-mono bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/60 font-bold uppercase animate-pulse">GOAL OPEN</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Bento Card 3: CORE DRILL HEAT TELEMETRY */}
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-md space-y-2">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider">DRILL TEMP METER</span>
                  <span className={`text-[10px] font-mono font-bold ${drillHeat > 70 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                    {Math.round(drillHeat)}°C
                  </span>
                </div>
                <div className="h-3 rounded bg-zinc-950 border border-zinc-800 p-0.5 overflow-hidden relative">
                  <div 
                    className={`h-full rounded-xs transition-all duration-300 ${
                      drillHeat > 70 ? 'bg-gradient-to-r from-orange-500 to-red-500 animate-pulse' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}
                    style={{ width: `${drillHeat}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[8px] text-zinc-500 font-mono">
                  <span>10°C IDLE</span>
                  <span>100°C LIMIT</span>
                </div>
              </div>

              {/* Bento Card 4: CHRONO PROXIMITY SENSOR WARNING */}
              <div className={`bg-zinc-900 p-4 rounded-xl border transition-colors duration-300 shadow-md ${
                proximityDistance <= 2 ? 'border-red-600/60 bg-red-950/15 animate-pulse' : proximityDistance <= 4 ? 'border-orange-500/50 bg-orange-950/10' : 'border-zinc-800'
              }`}>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <ShieldAlert className={`w-4 h-4 ${proximityDistance <= 3 ? 'text-red-500 animate-bounce' : 'text-zinc-500'}`} />
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider">PROXIMITY WARNING</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400">SECTOR RADAR</span>
                  <span className={`text-xs font-mono font-bold ${
                    proximityDistance <= 2 ? 'text-red-500 font-black' : proximityDistance <= 4 ? 'text-orange-400' : 'text-zinc-300'
                  }`}>
                    {proximityDistance === 99 ? 'CLEAR (---)' : `${proximityDistance} SEC BLOCKS`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-zinc-950 overflow-hidden relative">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      proximityDistance <= 2 ? 'bg-red-500' : proximityDistance <= 4 ? 'bg-orange-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${proximityDistance === 99 ? 0 : Math.max(10, (10 - proximityDistance) * 10)}%` }}
                  />
                </div>
              </div>

              {/* Bento Card 5: ACTIVE BUFFS */}
              {(freezeTimer > 0 || speedTimer > 0 || shieldTimer > 0 || drillTimer > 0) && (
                <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 shadow-md space-y-2">
                  <span className="text-[8px] font-mono font-black text-amber-500 block uppercase tracking-widest border-b border-zinc-800 pb-1">
                    ACTIVE TELEKINETICS
                  </span>
                  <div className="text-[10px] space-y-1.5 font-mono font-bold">
                    {freezeTimer > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-cyan-400">
                          <span>⏱️ ICE FREEZE</span>
                          <span>{freezeTimer}s</span>
                        </div>
                        <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 transition-all duration-1000" style={{ width: `${(freezeTimer / 5) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    {speedTimer > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-orange-400">
                          <span>⚡ JET PROPULSION</span>
                          <span>{speedTimer}s</span>
                        </div>
                        <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-400 transition-all duration-1000" style={{ width: `${(speedTimer / 6) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    {shieldTimer > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-yellow-400">
                          <span>🛡️ INVINCIBLE SHIELD</span>
                          <span>{shieldTimer}s</span>
                        </div>
                        <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 transition-all duration-1000" style={{ width: `${(shieldTimer / 8) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    {drillTimer > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-pink-400">
                          <span>🔥 SUPER HYPER-DRILL</span>
                          <span>{drillTimer}s</span>
                        </div>
                        <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-pink-400 transition-all duration-1000" style={{ width: `${(drillTimer / 8) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bento Card 6: STAGE ESCAPE CONTROLS */}
              <div className="hidden lg:flex flex-col gap-2 pt-1">
                <button
                  id="reset-level-bento-btn"
                  onClick={handleRetryLevel}
                  className="w-full py-2.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-left font-mono hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-white flex items-center justify-between transition-all cursor-pointer"
                >
                  <span>RETRY STAGE</span>
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                </button>
                <button
                  id="exit-level-bento-btn"
                  onClick={handleBackToTitle}
                  className="w-full py-2.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-left font-mono hover:bg-red-950/40 hover:border-red-900/40 text-[10px] text-zinc-400 hover:text-red-400 flex items-center justify-between transition-all cursor-pointer"
                >
                  <span>TITLE RETURN</span>
                  <X className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              </div>

            </div>

            {/* CENTRAL BEZEL: Canvas and Game Grid */}
            <div className="flex-grow flex flex-col items-center">
              
              {/* Score HUD Header */}
              <div className="w-full bg-zinc-900 px-4 py-2.5 rounded-t-xl border-t border-x border-zinc-800 flex items-center justify-between">
                
                {/* Score */}
                <div className="flex items-center gap-6">
                  <div className="text-left">
                    <span className="text-[8px] font-mono tracking-wider text-zinc-500 block uppercase">1P SCORE</span>
                    <span className="text-base font-mono font-bold text-yellow-400 tracking-wider">
                      {score.toString().padStart(6, '0')}
                    </span>
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="text-[8px] font-mono tracking-wider text-zinc-500 block uppercase">HIGH SCORE</span>
                    <span className="text-base font-mono font-bold text-zinc-400 tracking-wider">
                      {highScore.toString().padStart(6, '0')}
                    </span>
                  </div>
                </div>

                {/* Pause Button */}
                <div className="flex items-center shrink-0">
                  <button
                    id="pause-active-btn"
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1.5 rounded-md hover:bg-zinc-800 border border-zinc-800"
                    title={isPaused ? "再開" : "一時停止"}
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" /> : <Pause className="w-4 h-4" />}
                  </button>
                </div>

              </div>

              {/* STAGE SCREEN PORTAL CONTAINER (With shaky effect) */}
              <div 
                ref={gridContainerRef}
                className={`w-full bg-zinc-950 border-x border-b border-zinc-800 flex items-center justify-center p-3 relative select-none ${
                  shakeScreen ? 'animate-shake' : ''
                }`}
              >
                {/* Outer Bezel frame */}
                <div 
                  className="relative overflow-hidden rounded-lg outline-2 outline-zinc-900 border-4 border-zinc-950 bg-black/90 cursor-default"
                  style={{
                    width: grid[0] ? `${grid[0].length * cellSize}px` : 'auto',
                    height: grid.length ? `${grid.length * cellSize}px` : 'auto',
                  }}
                >
                  
                  {/* Background grid cell layout mapping */}
                  {grid.map((row, y) => (
                    <div key={y} className="flex">
                      {row.map((cell, x) => {
                        
                        let cellBg = '';
                        let cellBorder = 'border-transparent';
                        let isGoalOpen = player.gemsCollected >= player.totalGemsInLevel;

                        if (cell === CellType.WALL) {
                          cellBg = level.theme.rock;
                          cellBorder = 'border-zinc-800/40';
                        } else if (cell === CellType.DIRT) {
                          cellBg = level.theme.dirt;
                          cellBorder = 'border-amber-900/60';
                        } else if (cell === CellType.HARD_DIRT) {
                          // Beautiful deep rich, heavily-patterned hard dirt theme
                          cellBg = 'bg-amber-950/90 shadow-[inset_0_0_12px_rgba(180,83,9,0.55)]';
                          cellBorder = 'border-amber-950/90 border-2';
                        } else if (cell === CellType.FREEZE_DIRT) {
                          cellBg = 'bg-sky-900/80 shadow-[inset_0_0_10px_rgba(56,189,248,0.5)]';
                          cellBorder = 'border-sky-500/80';
                        } else if (cell === CellType.SPEED_DIRT) {
                          cellBg = 'bg-orange-900/80 shadow-[inset_0_0_10px_rgba(249,115,22,0.5)]';
                          cellBorder = 'border-orange-500/80';
                        } else {
                          // empty path
                          cellBg = 'bg-black/45';
                        }

                        // Grid overlays if trapped is active here
                        const activeTrap = traps.find(t => t.pos.x === x && t.pos.y === y);

                        return (
                          <div
                            key={x}
                            className={`relative text-center shrink-0 flex items-center justify-center select-none border transition-colors duration-150 ${cellBg} ${cellBorder}`}
                            style={{
                              width: `${cellSize}px`,
                              height: `${cellSize}px`,
                            }}
                          >
                            {/* Render Gem */}
                            {cell === CellType.GEM && (
                              <div className="absolute inset-0 flex items-center justify-center p-1.5 animate-pulse-subtle">
                                <Sparkles 
                                  className="text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]" 
                                  style={{ width: `${cellSize * 0.5}px`, height: `${cellSize * 0.5}px` }}
                                />
                              </div>
                            )}

                            {/* Render Special Dirt Blocks */}
                            {cell === CellType.FREEZE_DIRT && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-1 font-sans bg-sky-950/20 rounded-sm">
                                <Snowflake className="text-sky-300" style={{ width: `${cellSize * 0.4}px`, height: `${cellSize * 0.4}px` }} />
                                <span className="text-[6px] font-bold text-sky-200 mt-0.5 tracking-tighter block leading-none">FREEZE</span>
                              </div>
                            )}

                            {cell === CellType.SPEED_DIRT && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-1 font-sans bg-orange-950/20 rounded-sm">
                                <Zap className="text-orange-400" style={{ width: `${cellSize * 0.4}px`, height: `${cellSize * 0.4}px` }} />
                                <span className="text-[6px] font-bold text-orange-200 mt-0.5 tracking-tighter block leading-none">SPEED</span>
                              </div>
                            )}

                            {cell === CellType.HARD_DIRT && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-1 font-sans bg-amber-950/40 rounded-sm">
                                <span className="text-[8px] font-black text-amber-500 tracking-wider">▲▲▲</span>
                                <span className="text-[6px] font-bold text-amber-200/90 mt-0.5 tracking-tighter block leading-none">HARD</span>
                              </div>
                            )}

                            {/* Render Power-Up Items */}
                            {cell === CellType.POWER_SHIELD && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-1 animate-pulse">
                                <Shield className="text-yellow-400 fill-yellow-400/20 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" style={{ width: `${cellSize * 0.45}px`, height: `${cellSize * 0.45}px` }} />
                                <span className="text-[6px] font-bold text-yellow-300 mt-0.5 tracking-tighter block leading-none">SHIELD</span>
                              </div>
                            )}

                            {cell === CellType.POWER_DRILL && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-1 animate-pulse">
                                <Drill className="text-pink-400 fill-pink-400/20 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]" style={{ width: `${cellSize * 0.45}px`, height: `${cellSize * 0.45}px` }} />
                                <span className="text-[6px] font-bold text-pink-300 mt-0.5 tracking-tighter block leading-none">DRILL</span>
                              </div>
                            )}

                            {/* Render Ladder Grid Goal */}
                            {cell === CellType.GOAL && (
                              <div className="absolute inset-0 flex items-center justify-center p-1 font-mono text-center">
                                <div className={`w-full h-full rounded flex items-center justify-center border-2 border-dashed ${
                                  isGoalOpen 
                                    ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' 
                                    : 'border-yellow-600/30 bg-zinc-900/70'
                                }`}>
                                  <span className={`text-[10px] font-black ${isGoalOpen ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                    {isGoalOpen ? 'EXIT' : 'LOCK'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Render Trap Hole dug by player */}
                            {activeTrap && (
                              <div 
                                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-amber-950/60 border-2 border-orange-600/40 scale-95 origin-center rounded-sm"
                                style={{
                                  clipPath: `polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)`
                                }}
                              >
                                <span className="text-[8px] font-mono text-orange-500 font-bold block leading-none">
                                  {Math.ceil(activeTrap.timeLeft)}s
                                </span>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Character Entity Layers (Fitted on absolute absolute grid calculations with smooth CSS motion) */}
                  
                  {/* PLAYER RENDERER */}
                  <div 
                    className="absolute z-30 flex items-center justify-center transition-all duration-[120ms] ease-out pointer-events-none"
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      left: `${player.pos.x * cellSize}px`,
                      top: `${player.pos.y * cellSize}px`,
                    }}
                  >
                    <div className="w-[85%] h-[85%] rounded-lg bg-amber-500 border border-amber-300 flex items-center justify-center shadow-lg relative shrink-0">
                      {/* Active Power-up auras */}
                      {shieldTimer > 0 && (
                        <div className="absolute inset-[-6px] rounded-xl border-2 border-yellow-450 bg-yellow-450/10 animate-ping opacity-70 z-[-1]" />
                      )}
                      {drillTimer > 0 && (
                        <div className="absolute inset-[-6px] rounded-xl border-2 border-pink-500 bg-pink-505/10 animate-pulse z-[-1]" />
                      )}
                      {speedTimer > 0 && (
                        <div className="absolute inset-[-4px] rounded-lg border-2 border-orange-500 bg-orange-505/10 animate-pulse z-[-1]" />
                      )}
                      
                      {/* Wearing miner Helmet */}
                      <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-4 h-2 bg-yellow-400 rounded-t-full border-t border-white" />
                      <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-200 rounded-full shadow-[0_0_5px_cyan]" />

                      {/* Eyes / Face depending on Direction */}
                      <div className={`flex gap-1 transition-all ${
                        player.dir === 'LEFT' ? 'justify-start pl-1' : player.dir === 'RIGHT' ? 'justify-end pr-1' : 'justify-center'
                      }`}>
                        <div className="w-1.5 h-1.5 bg-black rounded-full" />
                        <div className="w-1.5 h-1.5 bg-black rounded-full" />
                      </div>

                      {/* Active Digging Ring loader overlay */}
                      {player.diggingDir && (
                        <div className="absolute inset-0 bg-yellow-950/60 rounded-lg flex items-center justify-center">
                          <Drill className="w-4 h-4 text-amber-400 animate-bounce" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ENEMIES RENDERER */}
                  {enemies.map((enemy) => {
                    const isTrapped = enemy.trappedRemaining > 0;
                    const isDeadNow = (enemy as any).isDead;
                    
                    if (isDeadNow) return null;

                    return (
                      <div
                        key={enemy.id}
                        className="absolute z-20 flex items-center justify-center transition-all duration-[240ms] ease-out pointer-events-none"
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          left: `${enemy.pos.x * cellSize}px`,
                          top: `${enemy.pos.y * cellSize}px`,
                        }}
                      >
                        <div 
                          className="w-[82%] h-[82%] rounded-lg flex flex-col items-center justify-center relative shadow-md transition-all shrink-0"
                          style={{
                            backgroundColor: isTrapped ? '#7c2d12' : enemy.color,
                            border: `2px solid ${isTrapped ? '#c2410c' : '#ffffff40'}`,
                            opacity: enemy.type === 'GHOST' ? 0.8 : 1, // translucent ghost representation
                          }}
                        >
                          
                          {/* Face Icon */}
                          {enemy.type === 'CHASER' && (
                            <ShieldAlert className="w-4 h-4 text-black animate-pulse" />
                          )}
                          {enemy.type === 'WANDERER' && (
                            <Compass className="w-4 h-4 text-black rotate-45" />
                          )}
                          {enemy.type === 'GHOST' && (
                            <Ghost className="w-4 h-4 text-black animate-bounce" />
                          )}
                          {enemy.type === 'PATROLLER' && (
                            <div className="flex flex-col items-center">
                              <Compass className="w-3.5 h-3.5 text-black" />
                              <span className="text-[5px] font-mono font-black text-black leading-none mt-0.5">PATROL</span>
                            </div>
                          )}
                          {enemy.type === 'AMBUSHER' && (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-bold tracking-tighter">
                                {enemy.ambushState === 'SLEEP' ? '💤' : '👹'}
                              </span>
                              <span className="text-[5px] font-mono font-black text-black leading-none mt-0.5">
                                {enemy.ambushState === 'SLEEP' ? 'LURK' : 'ALERT'}
                              </span>
                            </div>
                          )}

                          {/* Stuck marker indicator */}
                          {isTrapped && (
                            <span className="absolute -top-[14px] left-1/2 -translate-x-1/2 bg-red-600 px-1 rounded text-[8px] font-mono text-white font-bold tracking-widest uppercase">
                              STUCK
                            </span>
                          )}

                        </div>
                      </div>
                    );
                  })}

                  {/* ACTIVE PARTICLE LAYERS CANVAS (Sitting layered on top of all characters) */}
                  <canvas 
                    ref={canvasRef} 
                    className="absolute inset-0 pointer-events-none z-40" 
                  />

                  {/* Alert Bubble Render Overlay */}
                  {alertBubble && (
                    <div 
                      className="absolute z-50 bg-amber-500 text-black font-extrabold px-2.5 py-1 text-[10px] rounded border border-white font-sans max-w-[150px] text-center shadow-lg transform -translate-x-1/2 -translate-y-full transition-all pointer-events-none"
                      style={{
                        left: `${alertBubble.x * cellSize + cellSize / 2}px`,
                        top: `${alertBubble.y * cellSize - 4}px`
                      }}
                    >
                      {alertBubble.text}
                    </div>
                  )}

                  {/* Countdowns Stage Intercept Ready dialog */}
                  {readyTimer > 0 && (
                    <div className="absolute inset-0 bg-black/75 z-50 flex flex-col items-center justify-center gap-2 select-none animate-fade-in pointer-events-auto">
                      <div className="text-center space-y-1.5 p-3">
                        <span className="text-amber-500 tracking-[0.4em] text-[10px] font-mono font-black uppercase block">
                          LEVEL 0{levelIndex + 1} STARTING
                        </span>
                        <h2 className="text-2xl font-display font-black tracking-wide text-white">
                          {level.name}
                        </h2>
                        <div className="flex items-center gap-1.5 justify-center py-2">
                          <span className="font-mono text-sm text-yellow-400 font-extrabold px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded animate-pulse">
                            READY... {Math.ceil(readyTimer)}s
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PAUSE STATUS SCREEN INTERCEPT */}
                  {isPaused && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4 select-none animate-fade-in pointer-events-auto">
                      <div className="text-center space-y-2">
                        <Pause className="w-8 h-8 mx-auto text-yellow-500 animate-bounce" />
                        <h3 className="text-xl font-display font-black tracking-wide text-white">
                          Game Paused
                        </h3>
                        <p className="text-xs text-zinc-400">
                          一時停止中です
                        </p>
                      </div>

                      <button
                        onClick={() => setIsPaused(false)}
                        className="py-2.5 px-6 rounded-lg bg-amber-500 text-black font-bold font-display hover:brightness-110 shadow-md flex items-center gap-1 text-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-black text-black" />
                        ゲームを再開する (RESUME)
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* RETRO CABINET CONTROLLER OVERLAY FOR MOBILE & MOUSE USERS */}
              <div 
                id="touch-arcade-deck"
                className="w-full bg-zinc-900/90 border border-zinc-800 p-4 rounded-b-xl flex flex-col sm:flex-row items-center justify-around gap-4 shadow-xl shrink-0 select-none pointer-events-auto"
              >
                
                {/* Visual guideline display */}
                <div className="text-[10px] text-zinc-500 font-mono text-left max-w-xs space-y-1 block sm:block h-fit">
                  <span className="text-amber-500 font-bold tracking-wider block">KEYBOARD CONTROLS</span>
                  <div>・<b>移動:</b> 矢印キー 又は 【W, A, S, D】</div>
                  <div>・<b>罠を掘る (左 / 右):</b> 【Z】キー / 【X】キー</div>
                  <div>・<b>直接穴掘り:</b> 隣接して【スペース】</div>
                </div>

                {/* Left Controller D-PAD element */}
                <div className="flex items-center justify-center shrink-0">
                  <div className="relative w-28 h-28 bg-zinc-950 rounded-full border-4 border-zinc-900 flex items-center justify-center shadow-inner">
                    
                    {/* D-Pad Buttons absolute layout */}
                    <button
                      onClick={() => executePlayerStep('UP')}
                      className="absolute top-0.5 left-1/2 -translate-x-1/2 p-2 w-8 h-8 rounded-t bg-zinc-800 border border-zinc-700/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all flex items-center justify-center shadow-md active:bg-amber-600 active:text-black"
                      title="上へ"
                    >
                      <ArrowUp className="w-4 h-4 shrink-0" />
                    </button>
                    <button
                      onClick={() => executePlayerStep('DOWN')}
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 p-2 w-8 h-8 rounded-b bg-zinc-800 border border-zinc-700/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all flex items-center justify-center shadow-md active:bg-amber-600 active:text-black"
                      title="下へ"
                    >
                      <ArrowDown className="w-4 h-4 shrink-0" />
                    </button>
                    <button
                      onClick={() => executePlayerStep('LEFT')}
                      className="absolute left-0.5 top-1/2 -translate-y-1/2 p-2 w-8 h-8 rounded-l bg-zinc-800 border border-zinc-700/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all flex items-center justify-center shadow-md active:bg-amber-600 active:text-black"
                      title="左へ"
                    >
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    </button>
                    <button
                      onClick={() => executePlayerStep('RIGHT')}
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 p-2 w-8 h-8 rounded-r bg-zinc-800 border border-zinc-700/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all flex items-center justify-center shadow-md active:bg-amber-600 active:text-black"
                      title="右へ"
                    >
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>

                    {/* D-pad analog stick center */}
                    <div className="w-8 h-8 bg-zinc-900 border-2 border-zinc-800 rounded-full flex items-center justify-center">
                      <Gamepad2 className="w-3.5 h-3.5 text-zinc-500 animate-pulse" />
                    </div>

                  </div>
                </div>

                {/* Right Action Trigger Buttons */}
                <div className="flex items-center gap-4 shrink-0">
                  
                  {/* Trap Left trigger button */}
                  <button
                    onClick={() => attemptDigTrap('LEFT')}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white border-4 border-red-950 font-display flex flex-col items-center justify-center transition-all p-1 shadow-lg cursor-pointer transform hover:scale-105 active:scale-90"
                  >
                    <span className="text-[9px] font-mono leading-none tracking-tighter">TRAP L</span>
                    <span className="text-[10px] font-black leading-none mt-0.5">Z</span>
                  </button>

                  {/* Manual Drill Ahead trigger */}
                  <button
                    onClick={() => {
                      if (player.dir) executePlayerStep(player.dir);
                    }}
                    className="w-16 h-12 rounded-lg bg-amber-500 hover:bg-amber-400 text-black border-4 border-amber-950 font-display flex flex-col items-center justify-center transition-all p-1 shadow-lg cursor-pointer transform hover:scale-105 active:scale-90"
                  >
                    <Drill className="w-4 h-4 text-black shrink-0" />
                    <span className="text-[8px] font-black leading-none mt-0.5 font-mono">DRILL</span>
                  </button>

                  {/* Trap Right trigger button */}
                  <button
                    onClick={() => attemptDigTrap('RIGHT')}
                    className="w-14 h-14 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white border-4 border-cyan-950 font-display flex flex-col items-center justify-center transition-all p-1 shadow-lg cursor-pointer transform hover:scale-105 active:scale-90"
                  >
                    <span className="text-[9px] font-mono leading-none tracking-tighter">TRAP R</span>
                    <span className="text-[10px] font-black leading-none mt-0.5">X</span>
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* 4. ROUND CLEAR TALLY SCREEN */}
        {screen === 'LEVEL_CLEAR' && (
          <div id="screen-roundclear" className="w-full max-w-md bg-zinc-900 border-2 border-emerald-500/30 rounded-2xl p-6 text-center space-y-6 shadow-2xl backdrop-blur-md animate-fade-in">
            <div className="space-y-1.5 py-2">
              <Sparkles className="w-10 h-10 mx-auto text-emerald-400 animate-bounce" />
              <span className="text-[10px] font-mono tracking-wider text-emerald-400 block uppercase font-bold">
                ROUND COMPLETE // クリア成功!
              </span>
              <h2 className="text-2xl font-display font-extrabold text-white">
                第 {levelIndex + 1} 階層を突破しました！
              </h2>
            </div>

            {/* Score tally blocks */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left font-mono space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>基本採掘スコア:</span>
                <span className="text-zinc-200 font-bold">{(levelIndex * 500 + 1000).toLocaleString()} PTS</span>
              </div>
              <div className="flex justify-between items-center text-emerald-400 font-bold border-t border-zinc-800 pt-2 text-sm">
                <span>クリア特別ボーナス:</span>
                <span>+1,000 PTS</span>
              </div>
              <div className="flex justify-between items-center text-yellow-400 font-extrabold text-base border-t border-zinc-800 pt-2.5">
                <span>合計スコア:</span>
                <span>{score.toLocaleString()} PTS</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
              {levelIndex + 1 < totalLevelsCount ? (
                <button
                  onClick={handleNextLevel}
                  className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-bold font-display hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  次のレベルへ進む (NEXT STAGE)
                </button>
              ) : (
                <button
                  onClick={() => {
                    setScreen('VICTORY');
                    synth.playVictory();
                  }}
                  className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold font-display hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  最終リザルトを見る (VICTORY)
                </button>
              )}
            </div>
          </div>
        )}

        {/* 5. GAMEOVER DIALOG */}
        {screen === 'GAMEOVER' && (
          <div id="screen-gameover" className="w-full max-w-sm bg-zinc-900 border-2 border-red-500/30 rounded-2xl p-6 text-center space-y-6 shadow-2xl backdrop-blur-md animate-fade-in">
            <div className="space-y-1.5 py-2">
              <AlertTriangle className="w-10 h-10 mx-auto text-red-500 animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest text-red-500 block uppercase font-bold">
                MISSION FAILED // 地底未帰還
              </span>
              <h2 className="text-2xl font-display font-extrabold text-white">
                GAME OVER
              </h2>
              <p className="text-xs text-zinc-400">
                すべての残機が尽きてしまいました。
              </p>
            </div>

            {/* Score block */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex justify-between items-center font-mono">
              <span className="text-zinc-500 text-[10px] uppercase font-bold">FINAL SCORE</span>
              <span className="text-md font-bold text-yellow-500">{score.toLocaleString()} PTS</span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleRetryLevel}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 text-white font-bold font-display active:scale-95 transition-all text-xs uppercase"
              >
                再挑戦する (RETRY)
              </button>
              <button
                onClick={handleBackToTitle}
                className="w-full py-3 px-5 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white font-mono text-xs uppercase"
              >
                タイトル画面に戻る (TITLE)
              </button>
            </div>
          </div>
        )}

        {/* 6. ULTIMATE ESCAPE VICTORY SCREEN */}
        {screen === 'VICTORY' && (
          <div id="screen-victory" className="w-full max-w-md bg-zinc-900 border-3 border-yellow-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl backdrop-blur-md animate-fade-in relative">
            <div className="absolute top-4 right-4 bg-yellow-500/15 border border-yellow-400/25 px-2 py-0.5 rounded text-[9px] text-yellow-400 font-mono">
              ALL STAGES CLEAR
            </div>

            <div className="space-y-2 py-4">
              <Trophy className="w-12 h-12 mx-auto text-yellow-400 animate-bounce" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-yellow-400 block uppercase font-bold">
                GRAND VICTORY // 地底踏破達成!
              </span>
              <h2 className="text-3xl font-display font-extrabold text-white">
                地底大脱出に成功！
              </h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed pt-2">
                数々の罠を掘り、すべての障害を乗り越えて、すべての宝石とともに地表へ無事生還しました。あなたの名前はレジェンド採掘士として刻まれます！
              </p>
            </div>

            {/* Highscore widget list */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono space-y-2.5 text-xs text-left">
              <div className="flex justify-between items-center text-zinc-400">
                <span>最終到達階層:</span>
                <span className="text-zinc-200 font-bold">深部第 5 階層 (CLEAR)</span>
              </div>
              <div className="flex justify-between items-center text-yellow-400 font-extrabold text-base border-t border-zinc-800 pt-2.5">
                <span>最終獲得スコア:</span>
                <span>{score.toLocaleString()} PTS</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setLevelIndex(0);
                  startPlaying(0);
                }}
                className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold shadow-lg hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-wider"
              >
                最初からもう一度挑戦する
              </button>
              <button
                onClick={handleBackToTitle}
                className="w-full py-3 px-5 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white font-mono text-xs uppercase"
              >
                タイトル画面に戻る (TITLE)
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Retro Arcade Bezel credits */}
      <footer className="w-full max-w-4xl text-center py-4 mt-6 border-t border-zinc-900 text-[10px] text-zinc-600 font-mono flex items-center justify-between z-10 shrink-0">
        <span>© 2026 RETRO REELS INC</span>
        <span>GRID DIG SYSTEM CABINET // COIN 1/1</span>
      </footer>

    </div>
  );
}
