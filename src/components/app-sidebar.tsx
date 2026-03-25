"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: "dashboard" | "history";
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Kelola budget event",
    icon: "dashboard",
  },
  {
    href: "/history",
    label: "History",
    description: "Perubahan terbaru",
    icon: "history",
  },
];

const MOBILE_BREAKPOINT_PX = 1080;

function isNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ type }: { type: NavItem["icon"] }) {
  if (type === "history") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          d="M12 3a9 9 0 1 0 8.75 11.13 1 1 0 1 0-1.94-.48A7 7 0 1 1 12 5a6.97 6.97 0 0 1 4.95 2.05H15a1 1 0 1 0 0 2h4.5a1 1 0 0 0 1-1V3.5a1 1 0 0 0-2 0v2.01A8.94 8.94 0 0 0 12 3Zm-.75 4.5a1 1 0 0 1 1 1v3.09l2.36 1.57a1 1 0 1 1-1.11 1.66l-2.81-1.88a1 1 0 0 1-.44-.83V8.5a1 1 0 0 1 1-1Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M3 11.5a1 1 0 0 1 .34-.75l8-7a1 1 0 0 1 1.32 0l8 7A1 1 0 0 1 21 11.5V20a1 1 0 0 1-1 1h-5.25a1 1 0 0 1-1-1v-4h-3.5v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const toggleLabel = isOpen ? "Tutup sidebar" : "Buka sidebar";

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

    const syncState = (matches: boolean) => {
      setIsMobile(matches);
      setIsOpen(!matches);
    };

    syncState(media.matches);

    const onChange = (event: MediaQueryListEvent) => {
      syncState(event.matches);
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const handleNavClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {isMobile && isOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          aria-label="Tutup sidebar"
        />
      )}
      <aside
        className={`app-sidebar ${isOpen ? "is-open" : "is-collapsed"} ${isMobile ? "is-mobile" : "is-desktop"}`}
      >
      <div className="app-sidebar-head">
        <div className="app-sidebar-brand">
          <p className="app-sidebar-eyebrow">Engagement Control</p>
          <p className="app-sidebar-title">Budget Workspace</p>
          <p className="app-sidebar-copy">
            Track perubahan lintas halaman dengan realtime history.
          </p>
        </div>
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={toggleLabel}
          aria-expanded={isOpen}
          title={toggleLabel}
        >
          <svg viewBox="0 0 24 24" aria-hidden focusable="false">
            {isOpen ? (
              <path
                d="M14.78 6.22a1 1 0 0 1 0 1.41L10.41 12l4.37 4.37a1 1 0 1 1-1.41 1.41l-5.08-5.08a1 1 0 0 1 0-1.41l5.08-5.08a1 1 0 0 1 1.41 0Z"
                fill="currentColor"
              />
            ) : (
              <path
                d="M9.22 17.78a1 1 0 0 1 0-1.41L13.59 12 9.22 7.63a1 1 0 1 1 1.41-1.41l5.08 5.08a1 1 0 0 1 0 1.41l-5.08 5.08a1 1 0 0 1-1.41 0Z"
                fill="currentColor"
              />
            )}
          </svg>
        </button>
      </div>

      <nav className="app-sidebar-nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-sidebar-link ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={!isOpen ? item.label : undefined}
              onClick={handleNavClick}
            >
              <span className="app-sidebar-link-icon">
                <NavIcon type={item.icon} />
              </span>
              <span className="app-sidebar-link-copy">
                <span className="app-sidebar-link-label">{item.label}</span>
                <span className="app-sidebar-link-description">{item.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-foot">
        <p className="app-sidebar-foot-title">Status</p>
        <p className="app-sidebar-foot-copy">Autosync aktif setiap 10 detik saat tidak ada draft lokal.</p>
      </div>
      </aside>
    </>
  );
}
