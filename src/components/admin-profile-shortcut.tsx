"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AuthSessionApiResponse = {
  isAdmin?: boolean;
  username?: string | null;
};

function initialsFromName(name: string) {
  const cleaned = name.trim();
  if (cleaned.length === 0) {
    return "A";
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

export default function AdminProfileShortcut() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const syncSession = useCallback(async () => {
    setIsSyncingSession(true);

    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        setIsAdmin(false);
        setUsername("");
        return;
      }

      const payload = (await response.json()) as AuthSessionApiResponse;
      const nextIsAdmin = payload.isAdmin === true;
      const nextUsername =
        nextIsAdmin && typeof payload.username === "string" ? payload.username.trim() : "";

      setIsAdmin(nextIsAdmin);
      setUsername(nextUsername);
    } catch {
      setIsAdmin(false);
      setUsername("");
    } finally {
      setIsSyncingSession(false);
    }
  }, []);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!(event.target instanceof Node)) {
        return;
      }

      if (!containerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const avatarLabel = useMemo(() => initialsFromName(username || "Admin"), [username]);
  const title = isAdmin ? "Menu admin" : "Menu login admin";
  const menuButtonText = isAdmin ? "Logout" : "Login";

  const toggleMenu = () => {
    setIsMenuOpen((current) => {
      const next = !current;
      if (next) {
        void syncSession();
      }
      return next;
    });
  };

  const handleLoginClick = () => {
    setIsMenuOpen(false);
  };

  const logout = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Gagal logout admin.");
      }

      setIsAdmin(false);
      setUsername("");
      setIsMenuOpen(false);
      router.refresh();
    } catch {
      setIsMenuOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`admin-profile-shell${isMenuOpen ? " is-open" : ""}`} ref={containerRef}>
      <button
        type="button"
        className="admin-profile-shortcut"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={toggleMenu}
      >
        <span className="admin-profile-shortcut-avatar">{avatarLabel}</span>
        <span className="admin-profile-shortcut-copy">
          <span className="admin-profile-shortcut-label">{isAdmin ? username || "Admin" : "Admin"}</span>
          <span className="admin-profile-shortcut-caption">
            {isAdmin ? "Admin Aktif" : "Login Admin"}
          </span>
        </span>
        <span className="admin-profile-shortcut-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9.25L12 15.25L18 9.25"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div className="admin-profile-dropdown" role="menu" aria-hidden={!isMenuOpen}>
        <p className="admin-profile-dropdown-status">
          {isSyncingSession ? "Memuat status..." : isAdmin ? "Admin sedang login" : "Belum login"}
        </p>
        {isAdmin ? (
          <button
            className="admin-profile-menu-item is-danger"
            role="menuitem"
            type="button"
            disabled={isSubmitting}
            onClick={logout}
          >
            {isSubmitting ? "Memproses..." : menuButtonText}
          </button>
        ) : (
          <Link className="admin-profile-menu-item" role="menuitem" href="/admin" onClick={handleLoginClick}>
            {menuButtonText}
          </Link>
        )}
      </div>
    </div>
  );
}
