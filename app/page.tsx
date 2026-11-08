"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Story = {
  id: string;
  category: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
};
type EventRow = {
  id: string; attempted_email: string; event_type: string; ip_address: string | null;
  city: string | null; region: string | null; country: string | null;
  user_agent: string; created_at: string;
};
type AccountNotification = {
  id: string; event_type: string; ip_address: string | null; city: string | null;
  region: string | null; country: string | null; user_agent: string; created_at: string;
};
type Session = { user: { email: string; isAdmin: boolean } | null; configured: boolean };

const categories = ["All stories", "City", "Province", "Business", "Community", "Culture", "Travel"];

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [feedNote, setFeedNote] = useState("Finding the latest from around Cebu…");
  const [category, setCategory] = useState("All stories");
  const [search, setSearch] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertToast, setAlertToast] = useState<AccountNotification | null>(null);
  const latestNotificationId = useRef<string | null>(null);

  async function loadNews() {
    try {
      const response = await fetch("/api/news", { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data.stories) && data.stories.length) {
        setStories(data.stories);
        setFeedNote(data.live ? "Fresh links · SunStar Cebu" : "Cebu headlines · publisher links");
      } else setFeedNote("Cebu headlines are taking a short break.");
    } catch { setFeedNote("Cebu headlines are taking a short break."); }
  }
  async function loadSession() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      setSession(await response.json());
    } catch { setSession({ configured: false, user: null }); }
  }
  async function loadEvents() {
    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await response.json() as { events?: EventRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not retrieve sign-in activity.");
      setEvents(Array.isArray(data.events) ? data.events : []);
      setEventsError("");
      setEventsLoaded(true);
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : "Could not retrieve sign-in activity.");
      setEventsLoaded(true);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNews();
      void loadSession();
      const verified = new URLSearchParams(window.location.search).get("verified");
      if (verified) {
        setMessage(verified === "1" ? "Your email is verified. You can now sign in." : "That verification link could not be completed. Sign in if the account is already verified, or request a new link.");
        setAuthOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!session?.user?.email) {
      latestNotificationId.current = null;
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/account/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { notifications?: AccountNotification[] };
        if (!active) return;
        const rows = data.notifications ?? [];
        const newest = rows[0];
        if (newest && latestNotificationId.current && newest.id !== latestNotificationId.current) setAlertToast(newest);
        if (newest) latestNotificationId.current = newest.id;
        setNotifications(rows);
      } catch { /* Keep the latest loaded alerts visible. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 12_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.user?.email]);
  useEffect(() => {
    if (!adminOpen || !session?.user?.isAdmin) return;
    void loadEvents();
    const timer = window.setInterval(() => { void loadEvents(); }, 8_000);
    return () => window.clearInterval(timer);
  }, [adminOpen, session?.user?.isAdmin]);
  useEffect(() => {
    if (!alertToast) return;
    const timer = window.setTimeout(() => setAlertToast(null), 9000);
    return () => window.clearTimeout(timer);
  }, [alertToast]);

  const visibleStories = useMemo(() => stories.filter((story) => {
    const matchesCategory = category === "All stories" || story.category === category;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${story.title} ${story.summary} ${story.source}`.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  }), [stories, category, search]);
  const featured = visibleStories[0];
  const rest = featured ? visibleStories.filter((story) => story.id !== featured.id) : [];
  const today = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(new Date());

  function openAuth() { setMode("signin"); setMessage(""); setAuthOpen(true); }
  async function submitAuth(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setMessage(data.message || data.error || "Request completed.");
      if (response.ok && mode === "signin") {
        const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
        setSession(me);
        if (me.user) window.setTimeout(() => setAuthOpen(false), 900);
      } else if (response.ok) setMode("signin");
    } catch { setMessage("The account service could not be reached. Please try again."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession((current) => current ? { ...current, user: null } : current);
    setNotifications([]); latestNotificationId.current = null; setAdminOpen(false);
  }
  function dateLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
    }).format(date);
  }

  return <main className="cebu-site">
    <div className="utility-bar"><span>CEBU CITY + PROVINCE</span><span>{today}</span><span>MAAYONG ADLAW, CEBU</span></div>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Cebu Current home">
        <span className="brand-mark"><i/><i/><i/></span>
        <span className="brand-name">CEBU <b>CURRENT</b><small>LOCAL STORIES, EVERY DAY</small></span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation"><a href="#latest">Latest</a><a href="#latest" onClick={() => setCategory("City")}>Cebu City</a><a href="#latest" onClick={() => setCategory("Province")}>Province</a><a href="#sources">Community</a></nav>
      <div className="account-actions">
        {session?.user ? <>
          <span className="account-name">{session.user.email}</span>
          <button className="account-link" onClick={() => setAlertsOpen(true)}>My alerts <span className="count-pill">{notifications.length}</span></button>
          {session.user.isAdmin && <button className="admin-link" onClick={() => setAdminOpen(!adminOpen)}>Newsroom</button>}
          <button className="sign-in-button" onClick={signOut}>Sign out</button>
        </> : <button className="sign-in-button" onClick={openAuth}>Reader sign in <span>↗</span></button>}
      </div>
    </header>

    <div className="ticker"><span className="ticker-label">THE ISLAND DESK</span><span>{feedNote}</span><button onClick={loadNews} aria-label="Refresh headlines">↻</button></div>

    {adminOpen && session?.user?.isAdmin && <section className="admin-panel" id="newsroom">
      <div className="panel-heading"><div><span className="eyebrow">PRIVATE NEWSROOM</span><h2>Sign-in activity</h2><small>All reader accounts · updates automatically</small></div><div className="panel-actions"><button className="plain-close" onClick={() => void loadEvents()}>Refresh ↻</button><button className="plain-close" onClick={() => setAdminOpen(false)}>Close ×</button></div></div>
      {eventsError ? <p className="empty-copy" role="alert">{eventsError}</p> : !eventsLoaded ? <p className="empty-copy">Loading sign-in activity…</p> : events.length === 0 ? <p className="empty-copy">No failed sign-in attempts have been recorded.</p> : <div className="event-list">{events.map((item) => <article className="event-row" key={item.id}>
        <div><strong>{item.event_type === "locked" ? "Account paused · 3 failed attempts" : item.event_type === "blocked" ? "Attempt blocked during cooldown" : "Failed password attempt"}</strong><span>{item.attempted_email}</span><small>{[item.city, item.region, item.country].filter(Boolean).join(", ") || "Location unavailable"} · {item.ip_address || "IP unavailable"}</small><small>{item.user_agent}</small></div><time>{dateLabel(item.created_at)}</time>
      </article>)}</div>}
      <p className="privacy-note">IP location is approximate. Browser details can be inaccurate or spoofed. Websites cannot read MAC addresses.</p>
    </section>}

    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">YOUR ISLAND, IN THE KNOW</span><h1>Cebu, one story<br/>at a time<span>.</span></h1><p>Fresh news and useful little updates from the city, the province, and all the places that make Cebu feel like home.</p><a className="hero-cta" href="#latest">Catch up on Cebu <b>↓</b></a><div className="hero-note"><span className="live-dot"/><span>Locally focused · Publisher-linked</span></div></div>
      <div className="hero-art-wrap"><CebuIllustration/><div className="art-sticker"><span>MAAYONG</span><b>CEBU!</b></div><div className="art-caption">ISLAND LIFE, IN FULL COLOUR</div></div>
      <div className="hero-footer"><span>01 / THE DAILY BRIEF</span><span>NEWS · PEOPLE · PLACES</span></div>
    </section>

    <section className="latest-section" id="latest">
      <div className="section-heading"><div><span className="eyebrow">A LITTLE OF EVERYTHING</span><h2>What’s happening in Cebu?</h2></div><label className="search-field"><span>⌕</span><input aria-label="Search Cebu stories" placeholder="Find a story…" value={search} onChange={(e) => setSearch(e.target.value)}/></label></div>
      <div className="filter-row">{categories.map((item) => <button key={item} className={category === item ? "filter-chip active" : "filter-chip"} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {featured && <article className="lead-card">
        <div className={`lead-art lead-art-${featured.category.toLowerCase().replace(" ", "-")}`}><StoryIllustration category={featured.category}/><span className="art-tag">{featured.category} / CEBU</span><span className="lead-number">01</span></div>
        <div className="lead-card-copy"><div className="story-meta"><span>{featured.source}</span><time>{dateLabel(featured.publishedAt)}</time></div><h3><a href={featured.url} target="_blank" rel="noopener noreferrer">{featured.title}</a></h3><p>{featured.summary}</p><a className="read-more" href={featured.url} target="_blank" rel="noopener noreferrer">Read the original story <b>↗</b></a></div>
      </article>}
      <div className="story-grid">{rest.map((story, index) => <StoryCard key={story.id} story={story} index={index} dateLabel={dateLabel}/>)}</div>
      {visibleStories.length === 0 && <p className="empty-copy">Nothing in this section yet. Try another topic or clear your search.</p>}
    </section>

    <section className="island-note"><div className="note-icon">♡</div><div><span className="eyebrow">A NOTE FROM THE NEWSROOM</span><h2>Good stories start close to home.</h2><p>These are short previews that point to the original reporting. Follow the links to read full stories and check the latest updates from each publisher.</p></div><span className="note-scribble">Sugbo<br/>stories ✳</span></section>

    <section className="source-section" id="sources"><div><span className="eyebrow">KEEP UP WITH THE ORIGINALS</span><h2>Your Cebu reading list</h2><p>Local reporting and public information, all in one friendly place.</p></div><div className="source-links"><a href="https://www.sunstar.com.ph/cebu" target="_blank" rel="noopener noreferrer"><b>SunStar Cebu</b><span>Local news · English & Bisaya ↗</span></a><a href="https://www.philstar.com/the-freeman" target="_blank" rel="noopener noreferrer"><b>The Freeman</b><span>Cebu reporting since 1919 ↗</span></a><a href="https://pia.gov.ph/regions/region-vii/" target="_blank" rel="noopener noreferrer"><b>Philippine Information Agency</b><span>Central Visayas updates ↗</span></a></div></section>

    <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span className="brand-name">CEBU <b>CURRENT</b></span></Link><span>An independent local-news concept · Cebu, Philippines</span><button onClick={() => session?.user ? setAlertsOpen(true) : openAuth()}>Account security</button></footer>

    {authOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="dialog-close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button><span className="eyebrow">YOUR CEBU CURRENT ACCOUNT</span><h2 id="auth-title">{mode === "signin" ? "Welcome back!" : "Come on in!"}</h2><p className="dialog-copy">{mode === "signin" ? "Sign in to keep your account and security alerts close." : "Make a reader account with email verification."}</p>
      {!session?.configured ? <div className="setup-callout"><b>Reader accounts are getting ready.</b><br/>News is open to everyone. Connect Supabase using DEPLOY.md to turn on reader accounts, sign-in protection, and private alerts.</div> : <><form onSubmit={submitAuth}><label>Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 10 : 1} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 10 characters" : "Your password"}/></label><button className="submit-button" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create reader account"}</button></form>{message && <div className="form-message" role="status">{message}</div>}<p className="switch-mode">{mode === "signin" ? "New around here?" : "Already have an account?"} <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p><p className="dialog-footnote">Three failed password attempts pause sign-in for five minutes. Your in-site security alerts refresh while you are signed in.</p></>}</section></div>}

    {alertsOpen && session?.user && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAlertsOpen(false); }}><section className="account-dialog alerts-dialog" role="dialog" aria-modal="true" aria-labelledby="alerts-title"><button className="dialog-close" onClick={() => setAlertsOpen(false)} aria-label="Close">×</button><span className="eyebrow">JUST FOR YOU</span><h2 id="alerts-title">Account alerts</h2><p className="dialog-copy">Recent sign-in attempts for {session.user.email}. This list checks for new activity while you are signed in.</p>{notifications.length ? <div className="alert-list">{notifications.map((item) => <article className="alert-row" key={item.id}><strong>{item.event_type === "locked" ? "Sign-in paused after three failed attempts" : item.event_type === "blocked" ? "Attempt blocked during the five-minute pause" : "A password attempt failed"}</strong><time>{dateLabel(item.created_at)}</time><span>{[item.city, item.region, item.country].filter(Boolean).join(", ") || "Approximate location unavailable"} · {item.ip_address || "IP unavailable"}</span><small>{item.user_agent}</small></article>)}</div> : <p className="empty-alerts">No failed sign-in attempts have been recorded for this account.</p>}<p className="dialog-footnote">Alerts stay inside Cebu Current. If you are signed out during an attempt, they will appear here after you sign in. Location and browser hints can be inaccurate; websites cannot read MAC addresses.</p></section></div>}
    {alertToast && <button className="alert-toast" onClick={() => { setAlertsOpen(true); setAlertToast(null); }}><span>New account alert</span>{alertToast.event_type === "locked" ? "Sign-in paused after repeated failures." : "A failed password attempt was recorded."}<b>See what happened →</b></button>}
  </main>;
}

function CebuIllustration() {
  return <svg className="cebu-illustration" viewBox="0 0 720 480" role="img" aria-label="Colourful illustration of Cebu island, city buildings, and the sea">
    <rect width="720" height="480" rx="20" fill="#8bd7e8"/><circle cx="550" cy="100" r="54" fill="#ffd465"/>
    <path d="M0 282c86-43 142-46 216-11s128 26 210-12 174-44 294-3v224H0Z" fill="#54b9c9"/>
    <path d="M0 348c120-32 210-27 324 6s222 21 396-23v149H0Z" fill="#278cab"/>
    <path d="M86 279 132 193l43 18 37-77 53 26 39-62 54 47 34-21 63 111 45 45H86Z" fill="#5fa56f"/>
    <path d="M86 279 132 193l43 18 37-77 53 26 39-62 54 47 34-21 63 111" fill="none" stroke="#32745e" strokeWidth="9" strokeLinejoin="round"/>
    <path d="M0 338h720" stroke="#f8f0ce" strokeWidth="7" strokeDasharray="16 20" opacity=".65"/>
    <g fill="#fb6f59" stroke="#173f63" strokeWidth="5">
      <path d="M420 280h42v-94h63v94h24v-69h57v69h35v59H407Z"/>
      <path d="M444 186v-24l18-15 18 15v24M520 211v-25l15-13 15 13v25M582 231v-19l14-12 14 12v19"/>
    </g>
    <g fill="#ffe6ac" stroke="#173f63" strokeWidth="4"><rect x="435" y="239" width="16" height="24" rx="3"/><rect x="473" y="239" width="16" height="24" rx="3"/><rect x="531" y="231" width="16" height="22" rx="3"/><rect x="590" y="246" width="16" height="19" rx="3"/></g>
    <path d="M92 374q52-28 106 0l-17 18H113Z" fill="#ffcf4f" stroke="#173f63" strokeWidth="5"/><path d="M143 354v20M124 384h60" stroke="#173f63" strokeWidth="5"/>
    <path d="M236 393q49-24 98 0l-16 18h-66Z" fill="#f7f4eb" stroke="#173f63" strokeWidth="5"/><path d="M281 374v20M263 403h58" stroke="#173f63" strokeWidth="5"/>
    <g fill="#fff8dc" fontFamily="Arial,sans-serif" fontWeight="800"><text x="35" y="46" fontSize="17" letterSpacing="3">CEBU / CENTRAL VISAYAS</text><text x="37" y="76" fontSize="12" letterSpacing="2">CITY • PROVINCE • ISLAND LIFE</text></g>
    <g fill="#fff8dc" opacity=".8"><path d="M35 431q24-9 48 0t48 0 48 0 48 0"/><path d="M445 430q22-8 44 0t44 0 44 0 44 0"/></g>
  </svg>;
}

function StoryIllustration({ category }: { category: string }) {
  return <div className={`scene scene-${category.toLowerCase().replace(" ", "-")}`} aria-hidden="true"><span className="scene-sun"/><span className="scene-shape shape-one"/><span className="scene-shape shape-two"/><span className="scene-line"/></div>;
}

function StoryCard({ story, index, dateLabel }: { story: Story; index: number; dateLabel: (value: string) => string }) {
  return <article className="story-card">
    <div className={`story-visual visual-${index % 4}`}><StoryIllustration category={story.category}/><span className="visual-tag">{story.category}</span><span className="visual-count">{String(index + 2).padStart(2, "0")}</span></div>
    <div className="story-card-body"><div className="story-meta"><span>{story.source}</span><time>{dateLabel(story.publishedAt)}</time></div><h3><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a></h3><p>{story.summary}</p><a className="read-more" href={story.url} target="_blank" rel="noopener noreferrer">Read the original <b>↗</b></a></div>
  </article>;
}
