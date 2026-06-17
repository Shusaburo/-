/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { synth } from '../audio';

interface SoundToggleProps {
  onToggle?: (muted: boolean) => void;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ onToggle }) => {
  const [muted, setMuted] = useState(synth.getMuted());

  const handleToggle = () => {
    const nextMuted = !muted;
    synth.setMute(nextMuted);
    setMuted(nextMuted);
    if (onToggle) {
      onToggle(nextMuted);
    }
  };

  return (
    <button
      id="sound-toggle-btn"
      onClick={handleToggle}
      className={`p-2.5 rounded-lg border flex items-center gap-2 font-mono text-xs transition-all ${
        muted
          ? 'bg-red-950/40 text-red-400 border-red-900/60 hover:bg-red-900/50'
          : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60 hover:bg-emerald-900/50'
      }`}
      title={muted ? "ミュート解除" : "ミュート"}
    >
      {muted ? (
        <>
          <VolumeX className="w-4 h-4" />
          <span>SOUND: OFF</span>
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4 animate-pulse-subtle" />
          <span>SOUND: PLAY</span>
        </>
      )}
    </button>
  );
};
