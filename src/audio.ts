/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class RetroAudioSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (!muted) {
      this.initCtx();
    }
  }

  getMuted() {
    return this.isMuted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.1
  ) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
      }

      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio fail:", e);
    }
  }

  playDig() {
    // Scratchy sound effect for digging grid blocks
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const duration = 0.12;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate some colored crackly noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start();
    } catch (e) {
      // Fallback
      this.playTone(300, 100, 0.1, 'triangle', 0.1);
    }
  }

  playTrap() {
    // Quick downward digging slide for traps
    this.playTone(440, 110, 0.25, 'triangle', 0.12);
  }

  playGem() {
    // Beautiful clean retro sound for gem pick up
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Arpeggio sound
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.06); // E5

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.setValueAtTime(0.06, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      
      osc2.start(now + 0.06);
      osc2.stop(now + 0.25);
    } catch (e) {
      this.playTone(600, 900, 0.15, 'sine', 0.06);
    }
  }

  playEnemyTrapped() {
    // Cute descending and ascending bubbles
    this.playTone(220, 880, 0.1, 'sine', 0.08);
    setTimeout(() => {
      this.playTone(330, 990, 0.1, 'sine', 0.06);
    }, 80);
  }

  playHurt() {
    // Heavy crunch
    this.playTone(180, 60, 0.35, 'sawtooth', 0.15);
  }

  playDirtRefilled() {
    // Dull rustling sound when trap hole refills
    this.playTone(150, 80, 0.2, 'triangle', 0.1);
  }

  playLevelClear() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major chords
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);
      });
    } catch {
      this.playTone(400, 800, 0.4, 'sine', 0.1);
    }
  }

  playGameOver() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [392.00, 349.23, 311.13, 261.63]; // Descending sad scale
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.1, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.45);
      });
    } catch {
      this.playTone(300, 100, 0.6, 'sawtooth', 0.1);
    }
  }

  playVictory() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Energetic celebratory fanfare
      const notes = [
        { f: 523.25, d: 0.1 },  // C5
        { f: 523.25, d: 0.1 },  // C5
        { f: 523.25, d: 0.1 },  // C5
        { f: 523.25, d: 0.3 },  // C5
        { f: 415.30, d: 0.3 },  // Ab4
        { f: 466.16, d: 0.3 },  // Bb4
        { f: 523.25, d: 0.5 },  // C5
      ];
      
      let accumTime = 0;
      notes.forEach((item) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(item.f, now + accumTime);
        gain.gain.setValueAtTime(0.05, now + accumTime);
        gain.gain.exponentialRampToValueAtTime(0.001, now + accumTime + item.d - 0.02);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(now + accumTime);
        osc.stop(now + accumTime + item.d);
        accumTime += item.d;
      });
    } catch {
      this.playTone(440, 880, 0.6, 'sine', 0.1);
    }
  }
}

export const synth = new RetroAudioSynth();
