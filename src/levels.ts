/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CellType, Level, Position, EnemyType } from './types';

// Legends:
// . : Empty
// # : Wall (Bedrock / Unbreakable Rock)
// D : Dirt (Soil / Brick - Excavatable with drill)
// G : Gem (Collectible Crystal)
// P : Player Position (Fills to Empty)
// C : Chaser Enemy (Red - Smart pathfinding)
// W : Wanderer Enemy (Yellow - Moves randomly unless in line of sight)
// H : Ghost Enemy (Purple - Slow speed, but can pass through DIRT)
// A : Patroller Enemy (Cyan - Patrols a predefined path/area back and forth)
// M : Ambusher Enemy (Orange - Lies in sleep/camouflage, wakes up and runs fast when player approach within 3 cells)
// X : Goal Portal (Activated when all gems are collected)
// F : Freeze Dirt Block (Blue glowing dirt - freezes all enemies for 4.5s when dug)
// S : Speed Dirt Block (Orange/Yellow glowing dirt - speeds up player for 6s when dug)
// I : Invincibility Shield (Shield item - player is protected for 8s and defeats enemies on touch)
// T : Turbo Drill Tool (Drill item - player instantly drills any dirt on touch for 8s)

const levelsRaw = [
  {
    id: 1,
    name: "地下200m: 新生代粘土層 (Cenozoic Clay)",
    description: "土を深く掘り進んで宝石を集めよう！青い土[F]で敵を凍結、オレンジの土[S]で移動速度が上がります。すべての結晶を掘り出して、最下層の昇降機[X]で脱出しよう！",
    theme: {
      bg: "bg-amber-950/40",
      dirt: "bg-amber-800 hover:bg-amber-700/80 border border-amber-900/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] rounded-md",
      rock: "bg-zinc-800 border border-zinc-900 shadow-md",
      descriptionColor: "text-amber-500"
    },
    map: [
      "###########",
      "#P.......G#",
      "#D#######D#",
      "#D#G...F#D#",
      "#D#D###D#D#",
      "#F.DDCDD.S#",
      "###D###D###",
      "#G.......G#",
      "#D#######D#",
      "#D#A...W#D#",
      "#D#D###D#D#",
      "#S.DDMDD.F#",
      "###D###D###",
      "#G.......G#",
      "#D...X...D#",
      "###########"
    ]
  },
  {
    id: 2,
    name: "地下500m: 白亜紀砂岩層 (Cretaceous Sandstone)",
    description: "巡回者[A]と待ち伏せ暗殺者[M]が出現！[M]は3マス以内に近づくと、眼を覚まして猛烈なスピードでダッシュしてきます。無敵シールド[I]で一網打尽にしましょう！",
    theme: {
      bg: "bg-orange-950/30",
      dirt: "bg-orange-850 hover:bg-orange-750/80 border border-orange-900/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] rounded-md",
      rock: "bg-zinc-800 border border-zinc-950 shadow-lg",
      descriptionColor: "text-orange-400"
    },
    map: [
      "###########",
      "#P..GDG..I#",
      "#D#######D#",
      "#D.......D#",
      "#D#DF#D#D#D#",
      "#D#D.A.#D#D#",
      "#S#D###D#S#",
      "#D.GWDWG.D#",
      "#D#######D#",
      "#D.......D#",
      "#D#D#M#D#D#",
      "#D#D.F.#D#D#",
      "#T#D###D#T#",
      "#G.......G#",
      "#D...X...D#",
      "###########"
    ]
  },
  {
    id: 3,
    name: "地下800m: 結晶幻影洞窟 (Illuminated Caverns)",
    description: "壁をすり抜けるゴースト[H]と、障害物を超えて追うチェイサー[C]の猛攻！超電磁ドリル[T]を拾って、土を瞬時に粉砕しながらスピーディーに鉱石をハントしよう！",
    theme: {
      bg: "bg-emerald-950/20",
      dirt: "bg-emerald-800 hover:bg-emerald-700/80 border border-emerald-900/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] rounded-md",
      rock: "bg-neutral-800 border border-neutral-900 shadow-md",
      descriptionColor: "text-emerald-400"
    },
    map: [
      "###########",
      "#P...T...G#",
      "#D#######D#",
      "#DF..H..SD#",
      "#D#######D#",
      "#D...A...D#",
      "#D#D###D#D#",
      "#D#D.C.#D#D#",
      "#D#D###D#D#",
      "#G...M...G#",
      "#D#######D#",
      "#S..GIG..F#",
      "#D#######D#",
      "#G.......G#",
      "#D...X...D#",
      "###########"
    ]
  },
  {
    id: 4,
    name: "地下1200m: 太古代火山亀裂 (Volcanic Fissures)",
    description: "非常に固いマグマ岩が迷路を形成しています。おとり罠（ZまたはXキーで左右に穴を掘る）を活用して、巡回する敵や猛追する敵をハメ殺しにしましょう！",
    theme: {
      bg: "bg-red-950/30",
      dirt: "bg-amber-900 hover:bg-amber-800/80 border border-red-950/50 shadow-[inset_0_3px_5px_rgba(0,0,0,0.6)] rounded-sm",
      rock: "bg-stone-900 border border-stone-950 shadow-2xl",
      descriptionColor: "text-red-400"
    },
    map: [
      "###########",
      "#P.......G#",
      "#D###D###D#",
      "#D#GF.SGD#D#",
      "#D###D###D#",
      "#D.......D#",
      "#D###D###D#",
      "#D#H.A.C#D#",
      "#D###D###D#",
      "#D.......D#",
      "#D###D###D#",
      "#D#M.T.I#D#",
      "#D###D###D#",
      "#G.......G#",
      "#D...X...D#",
      "###########"
    ]
  },
  {
    id: 5,
    name: "地球コア: 地底核最終深淵 (Final Frontier Core)",
    description: "極限深度の最終試験！チェイサー、ゴースト、パトローラー、アンブッシャーが同時に襲いかかります。すべてのバリア、凍結土、スピード土、ドリルを使いこなしてください！",
    theme: {
      bg: "bg-rose-950/40",
      dirt: "bg-rose-900 hover:bg-rose-800/80 border border-rose-950 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] rounded-sm",
      rock: "bg-slate-950 border border-black shadow-inner",
      descriptionColor: "text-rose-500"
    },
    map: [
      "###########",
      "#P..FTIG..G#",
      "#D#######D#",
      "#D.C.A.W.D#",
      "#D#######D#",
      "#D.H.M.H.D#",
      "#D#######D#",
      "#G.......G#",
      "#D#######D#",
      "#D..F.S..D#",
      "#D#######D#",
      "#G.......G#",
      "#D#######D#",
      "#S.......F#",
      "#D...X...D#",
      "###########"
    ]
  }
];

export function parseLevel(levelIndex: number): Level {
  const rawIdx = levelIndex % levelsRaw.length;
  const raw = levelsRaw[rawIdx];

  const grid: CellType[][] = [];
  let playerStart: Position = { x: 1, y: 1 };
  let goalPos: Position = { x: 1, y: 1 };
  const enemyStarts: { pos: Position; type: EnemyType }[] = [];

  const height = raw.map.length;
  const width = raw.map[0].length;

  for (let y = 0; y < height; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < width; x++) {
      const char = raw.map[y][x];
      switch (char) {
        case '#':
          row.push(CellType.WALL);
          break;
        case 'D':
          row.push(CellType.DIRT);
          break;
        case 'F':
          row.push(CellType.FREEZE_DIRT);
          break;
        case 'S':
          row.push(CellType.SPEED_DIRT);
          break;
        case 'I':
          row.push(CellType.POWER_SHIELD);
          break;
        case 'T':
          row.push(CellType.POWER_DRILL);
          break;
        case 'G':
          row.push(CellType.GEM);
          break;
        case 'X':
          row.push(CellType.GOAL);
          goalPos = { x, y };
          break;
        case 'P':
          playerStart = { x, y };
          row.push(CellType.EMPTY);
          break;
        case 'C':
          enemyStarts.push({ pos: { x, y }, type: 'CHASER' });
          row.push(CellType.EMPTY);
          break;
        case 'W':
          enemyStarts.push({ pos: { x, y }, type: 'WANDERER' });
          row.push(CellType.EMPTY);
          break;
        case 'H':
          enemyStarts.push({ pos: { x, y }, type: 'GHOST' });
          row.push(CellType.EMPTY);
          break;
        case 'A':
          enemyStarts.push({ pos: { x, y }, type: 'PATROLLER' });
          row.push(CellType.EMPTY);
          break;
        case 'M':
          enemyStarts.push({ pos: { x, y }, type: 'AMBUSHER' });
          row.push(CellType.EMPTY);
          break;
        case '.':
        default:
          row.push(CellType.EMPTY);
          break;
      }
    }
    grid.push(row);
  }

  // 二倍の大きさへスケールアップ (2x Scale Up)
  const scale = 2;
  const scaledGrid: CellType[][] = [];
  const scaledEnemyStarts: { pos: Position; type: EnemyType }[] = [];
  
  const scaledHeight = height * scale;
  const scaledWidth = width * scale;

  // scaledGridをEMPTYで初期化
  for (let y = 0; y < scaledHeight; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < scaledWidth; x++) {
      row.push(CellType.EMPTY);
    }
    scaledGrid.push(row);
  }

  // 各セルを2x2ブロックにマッピングして拡張
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      const ny = y * scale;
      const nx = x * scale;

      if (cell === CellType.WALL) {
        // 外枠のみWALL（灰色の壁）として残し、内部の邪魔な壁はすべて「固い土 (HP 5)」をメインとした有機的迷宮に変換いたします！
        const isBorder = (y === 0 || y === height - 1 || x === 0 || x === width - 1);
        if (isBorder) {
          scaledGrid[ny][nx] = CellType.WALL;
          scaledGrid[ny + 1][nx] = CellType.WALL;
          scaledGrid[ny][nx + 1] = CellType.WALL;
          scaledGrid[ny + 1][nx + 1] = CellType.WALL;
        } else {
          // 内部壁は2x2の一様な塊にせず、4マスごとにランダムな確率で固い土や微細な抜け穴を散開させ、マップの複雑さを跳ね上げます！
          const scatterInternalWall = () => {
            const r = Math.random();
            if (r < 0.20) return CellType.EMPTY; // 抜け穴
            if (r < 0.65) return CellType.HARD_DIRT; // ご主人様絶賛の超固い土
            return CellType.DIRT; // 通常の土
          };
          scaledGrid[ny][nx] = scatterInternalWall();
          scaledGrid[ny + 1][nx] = scatterInternalWall();
          scaledGrid[ny][nx + 1] = scatterInternalWall();
          scaledGrid[ny + 1][nx + 1] = scatterInternalWall();
        }
      } else if (cell === CellType.DIRT) {
        // 土溜まりも4マスそれぞれをカオスに分散させ、砂漠、氷盤、固い地層が入り乱れる楽しい地中を構築します！
        const processSubCell = () => {
          const rand = Math.random();
          if (rand < 0.18) return CellType.EMPTY;       // 風穴
          if (rand < 0.22) return CellType.FREEZE_DIRT;  // 氷結シルト
          if (rand < 0.26) return CellType.SPEED_DIRT;   // ジェット泥
          if (rand < 0.60) return CellType.HARD_DIRT;    // 固い土 (HP 5)
          return CellType.DIRT;                          // 通常の土
        };
        scaledGrid[ny][nx] = processSubCell();
        scaledGrid[ny + 1][nx] = processSubCell();
        scaledGrid[ny][nx + 1] = processSubCell();
        scaledGrid[ny + 1][nx + 1] = processSubCell();
      } else if (cell === CellType.FREEZE_DIRT) {
        // 氷結地層：2x2内に凍結層と土＆空洞を複雑に織り交ぜます
        const fillFreeze = () => Math.random() < 0.6 ? CellType.FREEZE_DIRT : (Math.random() < 0.3 ? CellType.EMPTY : CellType.DIRT);
        scaledGrid[ny][nx] = fillFreeze();
        scaledGrid[ny + 1][nx] = fillFreeze();
        scaledGrid[ny][nx + 1] = fillFreeze();
        scaledGrid[ny + 1][nx + 1] = fillFreeze();
      } else if (cell === CellType.SPEED_DIRT) {
        // 砂地層
        const fillSpeed = () => Math.random() < 0.6 ? CellType.SPEED_DIRT : (Math.random() < 0.3 ? CellType.EMPTY : CellType.DIRT);
        scaledGrid[ny][nx] = fillSpeed();
        scaledGrid[ny + 1][nx] = fillSpeed();
        scaledGrid[ny][nx + 1] = fillSpeed();
        scaledGrid[ny + 1][nx + 1] = fillSpeed();
      } else if (cell === CellType.GEM) {
        // 結晶を掘り出すワクワクを強化するため、2x2の4マスのいずれか1箇所にランダム配置し、残りの3マスには保護シェルターとしての「固い土」や「通常の土」を被せます！
        const targetSlot = Math.floor(Math.random() * 4);
        const getCover = () => Math.random() < 0.4 ? CellType.HARD_DIRT : CellType.DIRT;
        scaledGrid[ny][nx] = targetSlot === 0 ? CellType.GEM : getCover();
        scaledGrid[ny + 1][nx] = targetSlot === 1 ? CellType.GEM : getCover();
        scaledGrid[ny][nx + 1] = targetSlot === 2 ? CellType.GEM : getCover();
        scaledGrid[ny + 1][nx + 1] = targetSlot === 3 ? CellType.GEM : getCover();
      } else if (cell === CellType.POWER_SHIELD) {
        // お助けアイテムも不均一かつ宝探しのように土の中に埋もれさせます！
        const targetSlot = Math.floor(Math.random() * 4);
        const getCover = () => Math.random() < 0.5 ? CellType.HARD_DIRT : CellType.EMPTY;
        scaledGrid[ny][nx] = targetSlot === 0 ? CellType.POWER_SHIELD : getCover();
        scaledGrid[ny + 1][nx] = targetSlot === 1 ? CellType.POWER_SHIELD : getCover();
        scaledGrid[ny][nx + 1] = targetSlot === 2 ? CellType.POWER_SHIELD : getCover();
        scaledGrid[ny + 1][nx + 1] = targetSlot === 3 ? CellType.POWER_SHIELD : getCover();
      } else if (cell === CellType.POWER_DRILL) {
        const targetSlot = Math.floor(Math.random() * 4);
        const getCover = () => Math.random() < 0.5 ? CellType.HARD_DIRT : CellType.EMPTY;
        scaledGrid[ny][nx] = targetSlot === 0 ? CellType.POWER_DRILL : getCover();
        scaledGrid[ny + 1][nx] = targetSlot === 1 ? CellType.POWER_DRILL : getCover();
        scaledGrid[ny][nx + 1] = targetSlot === 2 ? CellType.POWER_DRILL : getCover();
        scaledGrid[ny + 1][nx + 1] = targetSlot === 3 ? CellType.POWER_DRILL : getCover();
      } else if (cell === CellType.GOAL) {
        scaledGrid[ny][nx] = CellType.GOAL;
      } else {
        // もともと空洞だった通路スロット：
        // 予期せぬアイテム追加配置（1.5%で結晶、1.0%で超ドリル/シールド）や土瓦礫が低確率でランダムポップしてスリリングに！
        const spawnWild = () => {
          const rand = Math.random();
          if (rand < 0.012) return CellType.GEM; // 突如落ちている野良ジェム！
          if (rand < 0.017) return CellType.POWER_DRILL; // 野良超ドリル！
          if (rand < 0.022) return CellType.POWER_SHIELD; // 野良シールド！
          if (rand < 0.20) {
            // 瓦礫
            return Math.random() < 0.50 ? CellType.HARD_DIRT : CellType.DIRT;
          }
          return CellType.EMPTY;
        };
        scaledGrid[ny][nx] = spawnWild();
        scaledGrid[ny + 1][nx] = spawnWild();
        scaledGrid[ny][nx + 1] = spawnWild();
        scaledGrid[ny + 1][nx + 1] = spawnWild();
      }
    }
  }

  // 各エンティティ(プレイヤー、目標、敵)の座標を2倍にする
  const scaledPlayerStart: Position = {
    x: playerStart.x * scale,
    y: playerStart.y * scale
  };

  const scaledGoalPos: Position = {
    x: goalPos.x * scale,
    y: goalPos.y * scale
  };

  enemyStarts.forEach(enemy => {
    scaledEnemyStarts.push({
      pos: {
        x: enemy.pos.x * scale,
        y: enemy.pos.y * scale
      },
      type: enemy.type
    });
  });

  // Safety overrides to guarantee non-blocked spawns
  scaledGrid[scaledPlayerStart.y][scaledPlayerStart.x] = CellType.EMPTY;
  const safeDirections = [
    { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }
  ];
  safeDirections.forEach(d => {
    const ax = scaledPlayerStart.x + d.dx;
    const ay = scaledPlayerStart.y + d.dy;
    if (ax >= 0 && ax < scaledWidth && ay >= 0 && ay < scaledHeight) {
      if (scaledGrid[ay][ax] !== CellType.WALL && scaledGrid[ay][ax] !== CellType.GEM && scaledGrid[ay][ax] !== CellType.GOAL) {
        scaledGrid[ay][ax] = CellType.EMPTY;
      }
    }
  });

  // Ensure the Goal is strictly placeable and visible (Never empty it!)
  scaledGrid[scaledGoalPos.y][scaledGoalPos.x] = CellType.GOAL;

  // Limit enemies to a maximum of 3 to respect "three enemies is enough" rule
  const slicedEnemyStarts = scaledEnemyStarts.slice(0, 3);

  slicedEnemyStarts.forEach(enemy => {
    if (enemy.pos.y < scaledHeight && enemy.pos.x < scaledWidth) {
      scaledGrid[enemy.pos.y][enemy.pos.x] = CellType.EMPTY;
    }
  });

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    grid: scaledGrid,
    playerStart: scaledPlayerStart,
    enemyStarts: slicedEnemyStarts,
    goalPos: scaledGoalPos,
    theme: raw.theme,
  };
}

export const totalLevelsCount = levelsRaw.length;
