# BGM（バックグラウンドミュージック）再生システム仕様書

地中深くで緊迫した採掘作業に挑む同志の士気を高めるため、ステージプレイ中に躍動感あふれるBGMを再生する仕様を定義します。

---

## 1. 音楽ファイルの配置仕様
ご主人様が用意された音楽ファイル（例: `bgm.mp3` や `stage_theme.wav`）を本システムに読み込ませるための配置基準です。

* **配置パス**: `/public/bgm.mp3` 
  * Vite環境の静的アセットディレクトリ（`public`）の直下に配置します。
  * これにより、ゲーム実行中にブラウザから `"/bgm.mp3"` という相対パスで直接アクセス・ロードが可能になります。

---

## 2. BGM再生エンジンの設計

音量管理（ミュート機能）との連動や、ステージ開始時の自動ループ再生、リトライやクリア時の即時停止を安全に制御するため、既存の `RetroAudioSynth` クラス（`src/audio.ts`）を以下のように拡張、またはHTML5 `Audio` 要素を用いて管理します。

### A. 音声ロード＆ループ再生ロジック（`src/audio.ts` 内での実装設計）

```typescript
// BGM用のHTML5 Audioインスタンスを保持する変数
private bgm: HTMLAudioElement | null = null;

// BGMの初期化と再生
playBGM() {
  if (this.isMuted) return;
  
  if (!this.bgm) {
    // public/bgm.mp3 を自動ループ再生でロード
    this.bgm = new Audio("/bgm.mp3");
    this.bgm.loop = true;
    this.bgm.volume = 0.15; // 効果音を邪魔しない程よい音量に調整
  }
  
  // 再生開始（ブラウザのジェスチャー制限対策として、プレイヤー操作開始時にコールされる）
  this.bgm.play().catch(err => {
    console.warn("BGM Play blocked by browser auto-play restriction:", err);
  });
}

// BGMの停止
stopBGM() {
  if (this.bgm) {
    this.bgm.pause();
    this.bgm.currentTime = 0; // 曲の最初に戻す
  }
}
```

### B. ミュート（消音）処理との連動

既存の `setMute(muted: boolean)` メソッド内で、BGMの音量を一時的にゼロにする、または一時停止する処理を追加します。

```typescript
setMute(muted: boolean) {
  this.isMuted = muted;
  if (this.bgm) {
    this.bgm.muted = muted;
  }
  if (!muted) {
    this.initCtx();
  }
}
```

---

## 3. ゲーム本体（`src/App.tsx`）への統合・仕込みポイント

ゲーム画面の状態遷移（`screen` の変化）をトリガーにして、BGMを再生・停止する処理を仕込みます。

### A. ステージ開始時のトリガー（`startPlaying` 関数）
同志がゲームを開始した瞬間に、地底の爆音BGMを鳴り響かせます。

```typescript
// src/App.tsx の startPlaying 関数内
const startPlaying = (levelSelected: number) => {
  setLives(3);
  setScore(0);
  loadLevel(levelSelected);
  setScreen('PLAYING');
  setGameActive(true);
  
  // ★ ここでBGMを再生します！
  synth.playBGM();
};
```

### B. ステージクリア・ゲームオーバー・タイトル戻り時のトリガー
ステージをクリアした瞬間や、同志が力尽きてしまった瞬間、あるいはタイトル画面に戻った際は、BGMを速やかに停止して、各ジングル（クリア音やゲームオーバー音）が美しく響くようにします。

* **レベルクリア時** (`setScreen('LEVEL_CLEAR')` などの直前):
  ```typescript
  synth.stopBGM();
  ```
* **ゲームオーバー時**:
  ```typescript
  synth.stopBGM();
  ```
* **タイトルへ戻る時** (`handleBackToTitle` 関数内):
  ```typescript
  synth.stopBGM();
  ```
