/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle, Drill, ShieldAlert, Ghost, Compass, Award, LifeBuoy } from 'lucide-react';

export const Instructions: React.FC = () => {
  return (
    <div id="instructions-container" className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 text-zinc-300 md:max-h-[500px] overflow-y-auto space-y-6">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <HelpCircle className="w-6 h-6 text-yellow-500" />
        <h2 className="text-lg font-display font-bold text-white tracking-wide">
          ゲームマニュアル (Game Manual)
        </h2>
      </div>

      {/* Grid Controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
          <Drill className="w-4 h-4 text-amber-500" />
          基本操作
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 space-y-2">
            <span className="text-amber-400 font-bold block">🏃 移動 & ⛏️ 土を掘る</span>
            <p className="text-zinc-400 leading-relaxed">
              <strong className="text-white">【矢印キー / WASD】</strong> で上下左右に1マスずつ移動します。
            </p>
            <p className="text-zinc-400 leading-relaxed">
              <strong className="text-white">土（茶色マス）</strong>に向けて移動キーを押し続けるか、隣接して<strong className="text-white">【スペースキー】</strong>を押すと、穴を掘って道を作ることができます！
            </p>
          </div>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 space-y-2">
            <span className="text-sky-400 font-bold block">🕳️ 落とし穴を掘る（防衛用）</span>
            <p className="text-zinc-400 leading-relaxed">
              何もない床に、プレイヤーの「左」または「右」側に落とし穴（罠）を瞬時に掘ることができます。
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-white">【Z】キーか【J】キー</strong>: 左側に掘る</li>
              <li><strong className="text-white">【X】キーか【K】キー</strong>: 右側に掘る</li>
            </ul>
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              ※掘られた落とし穴は、敵をハメて足止めさせることができます。数秒後に自動で埋まり、ハメていた敵を退治（+200点＆自動リスポーン）できます。
            </p>
          </div>
        </div>
      </div>

      {/* Enemy Types */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          地底の脅威 (Enemies)
        </h3>

        <div className="space-y-2 text-xs">
          {/* Chaser */}
          <div className="flex items-start gap-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
            <div className="w-8 h-8 rounded bg-red-950/60 border border-red-505/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
            </div>
            <div>
              <span className="text-red-400 font-bold font-mono">CHASER（赤色の追跡者）</span>
              <p className="text-zinc-400 mt-1">
                最も賢い敵です。プレイヤーまでの最短経路を常に計算して、一歩ずつ的確に追跡してきます。
              </p>
            </div>
          </div>

          {/* Wanderer */}
          <div className="flex items-start gap-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
            <div className="w-8 h-8 rounded bg-amber-950/60 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4 text-amber-500 animate-spin" />
            </div>
            <div>
              <span className="text-amber-400 font-bold font-mono">WANDERER（黄色の放浪者）</span>
              <p className="text-zinc-400 mt-1">
                普段はあちこちをランダムに徘徊していますが、プレイヤーと縦または横の直線上で視線が合うと、猛スピードで突進してきます！
              </p>
            </div>
          </div>

          {/* Ghost */}
          <div className="flex items-start gap-3 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
            <div className="w-8 h-8 rounded bg-violet-950/60 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Ghost className="w-4 h-4 text-violet-400 animate-bounce" />
            </div>
            <div>
              <span className="text-violet-400 font-bold font-mono">GHOST（紫色の生霊・ゴースト）</span>
              <p className="text-zinc-400 mt-1">
                空中を浮遊する幽霊です。動きは非常に遅いですが、<strong className="text-white">「土（茶色のマス）」をすり抜けて</strong>進むことができます。挟み撃ちに注意！
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rules for victory */}
      <div className="bg-emerald-950/20 border border-emerald-900/40 p-3.5 rounded-lg space-y-2">
        <h4 className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
          <Award className="w-4 h-4" />
          クリアの掟
        </h4>
        <p className="text-zinc-400 text-xs leading-relaxed">
          1. 各レベルにあるすべての<strong className="text-emerald-400">クリスタル（光るダイヤ）</strong>を回収します。<br />
          2. すべてのクリスタルを集めると、マップ上にある<strong className="text-yellow-400">脱出ハッチ（昇降機）</strong>が活性化して開きます。<br />
          3. 敵に触れずに、その脱出ハッチまで辿り着けばレベルクリアです！
        </p>
      </div>

      {/* Retro layout advice */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
        <LifeBuoy className="w-3.5 h-3.5" />
        <span>TIPS: 掘った土や罠は数秒で自然回復します。あらかじめ退路を確認しておきましょう。</span>
      </div>
    </div>
  );
};
