"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();

  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "follower";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("");

  function handleLogout() {
    logout();
    router.push("/landing");
  }

  /* ── Dynamic navigation based on role ── */
  const navSections = [
    // Admin-only section
    ...(isAdmin
      ? [
          {
            label: "Admin",
            items: [
              { href: "/", icon: "📊", label: "Dashboard" },
              { href: "/leaderboard", icon: "🏆", label: "Leaderboard" },
            ],
          },
        ]
      : []),
    {
      label: "Trading",
      items: [
        { href: "/masters", icon: "👑", label: "Master Traders" },
        { href: "/portfolio", icon: "💼", label: "Portfolio" },
        { href: "/copied-trades", icon: "🔄", label: "Copied Trades" },
        { href: "/subscriptions", icon: "📋", label: "Subscriptions" },
        { href: "/paper-trading", icon: "📝", label: "Paper Trading" },
        { href: "/broker", icon: "🔗", label: "Connect Broker" },
      ],
    },
    {
      label: "Notifications",
      items: [
        { href: "/notifications", icon: "🔔", label: "Trade Alerts" },
      ],
    },
    {
      label: "Finance",
      items: [{ href: "/fees", icon: "💰", label: "Fees & Billing" }],
    },
    {
      label: "Controls",
      items: [
        { href: "/risk", icon: "🛡️", label: "Risk Manager" },
        { href: "/audit", icon: "🔐", label: "Audit Trail" },
        { href: "/mara-demo", icon: "🧮", label: "MARA Demo" },
        { href: "/settings", icon: "⚙️", label: "Settings" },
      ],
    },
  ];

  return (
    <div className="app-layout">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">⚡</span>
          InvestSync
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? "active" : ""}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link href="/settings" className="sidebar-user">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{displayName}</div>
              <div className="user-role">{displayRole}</div>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-soft)"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none"; }}
          >
            🚪
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-search">
              🔍 <span>Search anything…</span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="topbar-btn" title="Notifications">🔔</button>
            <button className="topbar-btn" title="Help">❓</button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
