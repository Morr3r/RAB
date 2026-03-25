"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IoVolumeMute } from "react-icons/io5";
import { GoUnmute } from "react-icons/go";

const STORAGE_KEY = "engagement_music_muted";
const DEFAULT_VOLUME = 0.52;

function getInitialMusicMuted() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY) === "muted";
}

export default function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockHandlerRef = useRef<(() => void) | null>(null);
  const [isMuted, setIsMuted] = useState(getInitialMusicMuted);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const clearUnlockHandler = useCallback(() => {
    if (!unlockHandlerRef.current) {
      return;
    }

    window.removeEventListener("pointerdown", unlockHandlerRef.current);
    window.removeEventListener("keydown", unlockHandlerRef.current);
    unlockHandlerRef.current = null;
  }, []);

  const attachUnlockHandler = useCallback(() => {
    if (unlockHandlerRef.current) {
      return;
    }

    const unlockPlayback = () => {
      const player = audioRef.current;
      if (!player) {
        return;
      }

      player.volume = DEFAULT_VOLUME;
      player.muted = isMuted;
      void player
        .play()
        .then(() => {
          setIsBlocked(false);
          clearUnlockHandler();
        })
        .catch(() => {
          setIsBlocked(true);
        });
    };

    unlockHandlerRef.current = unlockPlayback;
    window.addEventListener("pointerdown", unlockPlayback, { once: true });
    window.addEventListener("keydown", unlockPlayback, { once: true });
  }, [clearUnlockHandler, isMuted]);

  useEffect(() => {
    const player = audioRef.current;
    if (!player) {
      return;
    }

    player.volume = DEFAULT_VOLUME;
    player.muted = isMuted;

    void player.play().catch(() => {
      // Browser may block autoplay with audio until user interaction.
      setIsBlocked(true);
      attachUnlockHandler();
    });

    return () => {
      clearUnlockHandler();
    };
  }, [attachUnlockHandler, clearUnlockHandler, isMuted]);

  const toggleMusic = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    window.localStorage.setItem(STORAGE_KEY, nextMuted ? "muted" : "unmuted");
  };

  const statusLabel = isPlaying
    ? isMuted
      ? "Now Playing (Muted)"
      : "Now Playing"
    : isBlocked
      ? "Tap screen to allow audio"
      : "Starting...";

  return (
    <div className={`music-player-shell ${isPlaying ? "is-playing" : ""} ${isMuted ? "is-muted" : "is-unmuted"}`}>
      <audio
        ref={audioRef}
        src="/hindia.mp3"
        loop
        preload="auto"
        autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="music-player-orb" aria-hidden>
        <span>♪</span>
      </div>

      <div className="music-player-copy">
        <p className="music-player-title">Hindia - everything u are</p>
        <p className="music-player-status">{statusLabel}</p>
        <div className="music-player-eq" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <button
        type="button"
        className={`music-player-toggle ${isMuted ? "is-muted" : "is-unmuted"}`}
        onClick={toggleMusic}
        aria-pressed={!isMuted}
        aria-label={isMuted ? "Sound off, klik untuk unmute" : "Sound on, klik untuk mute"}
        title={isMuted ? "Sound Off" : "Sound On"}
      >
        <span className="music-player-toggle-icon" aria-hidden="true">
          {isMuted ? <IoVolumeMute /> : <GoUnmute />}
        </span>
      </button>
    </div>
  );
}
