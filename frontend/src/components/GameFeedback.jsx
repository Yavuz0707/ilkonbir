import { useCallback, useEffect, useState } from "react";

const SOUND_KEY = "ilkonbir-sound-enabled";

function readSoundEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_KEY) === "1";
}

function tone(freq, duration, type = "sine") {
  if (!readSoundEnabled()) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function useGameFeedback() {
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  const playCorrect = useCallback(() => {
    tone(523, 0.12, "triangle");
    window.setTimeout(() => tone(784, 0.16, "triangle"), 90);
  }, []);

  const playWrong = useCallback(() => {
    tone(220, 0.22, "sawtooth");
  }, []);

  const celebrate = useCallback(() => setBurst((value) => value + 1), []);

  return {
    soundEnabled,
    setSoundEnabled,
    playCorrect,
    playWrong,
    celebrate,
    burst,
  };
}

export function SoundToggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="rounded-lg border border-white/10 bg-void/70 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted transition hover:border-[var(--accent-line)] hover:text-[color-mix(in_srgb,var(--accent)_82%,white)]"
      title="Ses efektleri"
    >
      {enabled ? "Ses Açık" : "Ses Kapalı"}
    </button>
  );
}

export function ConfettiBurst({ burst }) {
  if (!burst) return null;
  return (
    <div key={burst} className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {Array.from({ length: 34 }).map((_, index) => {
        const left = 8 + ((index * 29) % 84);
        const hue = (index * 47) % 360;
        const delay = (index % 8) * 0.04;
        return (
          <span
            key={index}
            className="absolute top-[-20px] h-3 w-1.5 animate-[confetti-fall_1.3s_ease-out_forwards] rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: `hsl(${hue} 90% 62%)`,
              animationDelay: `${delay}s`,
              transform: `rotate(${index * 17}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
