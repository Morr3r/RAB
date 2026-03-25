"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_SCROLL_Y = 280;
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M12.71 5.29a1 1 0 0 0-1.42 0l-5 5a1 1 0 1 0 1.42 1.42L11 8.41V19a1 1 0 1 0 2 0V8.41l3.29 3.3a1 1 0 1 0 1.42-1.42l-5-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMotionPreference = (matches: boolean) => {
      setPrefersReducedMotion(matches);
    };

    syncMotionPreference(motionMediaQuery.matches);

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      syncMotionPreference(event.matches);
    };

    if (typeof motionMediaQuery.addEventListener === "function") {
      motionMediaQuery.addEventListener("change", onMotionPreferenceChange);
    } else {
      motionMediaQuery.addListener(onMotionPreferenceChange);
    }

    let ticking = false;

    const updateScrollMetrics = () => {
      const y = window.scrollY;
      const maxScrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setIsVisible(y > SHOW_AFTER_SCROLL_Y);
      setProgress(clamp(y / maxScrollable, 0, 1));
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateScrollMetrics);
    };

    updateScrollMetrics();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (typeof motionMediaQuery.removeEventListener === "function") {
        motionMediaQuery.removeEventListener("change", onMotionPreferenceChange);
      } else {
        motionMediaQuery.removeListener(onMotionPreferenceChange);
      }
    };
  }, []);

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <button
      type="button"
      className={`scroll-top-button ${isVisible ? "is-visible" : ""}`}
      aria-label="Scroll ke atas"
      title="Scroll ke atas"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        })
      }
    >
      <svg className="scroll-top-ring" viewBox="0 0 52 52" aria-hidden focusable="false">
        <circle className="scroll-top-track" cx="26" cy="26" r={RING_RADIUS} />
        <circle
          className="scroll-top-progress"
          cx="26"
          cy="26"
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="scroll-top-icon">
        <ArrowIcon />
      </span>
    </button>
  );
}
