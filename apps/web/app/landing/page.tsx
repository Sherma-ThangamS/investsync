"use client";

import Link from "next/link";
import { useAuth } from "../components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const stats = [
  { label: "Total AUM", value: "$8.4M+" },
  { label: "Master Traders", value: "50+" },
  { label: "Active Followers", value: "1,200+" },
  { label: "Win Rate", value: "65%" },
];

const features = [
  {
    icon: "👑",
    title: "Follow Top Traders",
    description:
      "Browse a curated leaderboard of verified master traders ranked by Sharpe ratio, win rate, and total P&L.",
  },
  {
    icon: "🔄",
    title: "Automatic Copy Trading",
    description:
      "Trades are mirrored proportionally to your allocated capital in real-time. No manual intervention needed.",
  },
  {
    icon: "🛡️",
    title: "Built-in Risk Controls",
    description:
      "Set max drawdown limits, auto-pause subscriptions, and monitor risk alerts from a unified dashboard.",
  },
  {
    icon: "💰",
    title: "Transparent Fee Engine",
    description:
      "Performance and subscription fees are calculated automatically with full ledger visibility for every party.",
  },
  {
    icon: "📊",
    title: "Real-time Dashboard",
    description:
      "Monitor your portfolio, track copied trades, and view allocation breakdowns across all your subscriptions.",
  },
  {
    icon: "📝",
    title: "Paper Trading Simulator",
    description:
      "Practice with simulated market data before committing real capital. Place orders and track P&L risk-free.",
  },
];

const steps = [
  { num: "01", title: "Create an Account", detail: "Sign up as a follower or master trader in under 30 seconds." },
  { num: "02", title: "Browse Master Traders", detail: "Review strategies, performance history, and risk metrics." },
  { num: "03", title: "Subscribe & Allocate", detail: "Choose your capital allocation and risk limits per subscription." },
  { num: "04", title: "Sit Back & Earn", detail: "Trades are automatically copied. Monitor everything from your dashboard." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  return (
    <div className="landing">
      {/* ─── Nav ─── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="logo-icon">⚡</span> InvestSync
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="landing-hero">
        <div className="hero-badge">🚀 Simulation Platform — No Real Money</div>
        <h1 className="hero-title">
          Copy the Best.<br />
          <span className="hero-gradient">Trade Smarter.</span>
        </h1>
        <p className="hero-subtitle">
          Follow top-performing traders and automatically mirror their strategies.
          Control risk, track performance, and manage fees — all in one platform.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn btn-primary btn-lg">
            Start Trading Free →
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign In
          </Link>
        </div>

        {/* Stats Row */}
        <div className="hero-stats">
          {stats.map((s) => (
            <div key={s.label} className="hero-stat">
              <div className="hero-stat-value">{s.value}</div>
              <div className="hero-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="landing-section">
        <div className="section-header">
          <div className="section-badge">Features</div>
          <h2 className="section-title">Everything you need to copy trade</h2>
          <p className="section-subtitle">
            A full-featured platform built for both master traders and followers.
          </p>
        </div>
        <div className="features-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header">
          <div className="section-badge">How It Works</div>
          <h2 className="section-title">Get started in 4 simple steps</h2>
        </div>
        <div className="steps-grid">
          {steps.map((s) => (
            <div key={s.num} className="step-card">
              <div className="step-num">{s.num}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-detail">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="landing-cta">
        <h2 className="cta-title">Ready to start copy trading?</h2>
        <p className="cta-subtitle">
          Join thousands of traders using InvestSync to build smarter portfolios.
        </p>
        <Link href="/register" className="btn btn-primary btn-lg">
          Create Free Account →
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-brand">
            <span className="logo-icon">⚡</span> InvestSync
          </div>
          <p className="footer-disclaimer">
            Simulation only. Not a broker. Not investment advice. No real money is used on this platform.
          </p>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
