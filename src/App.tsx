import { useState, useEffect, useCallback } from "react";

const OZ_PER_CONTRACT = 10;
const TEXT = "#2a3348";
const TEXT_MID = "#52647e";
const TEXT_LIGHT = "#8896ae";
const BORDER = "#dde3ef";
const BG = "#eef0f6";
const CARD = "#fff";
const GOLD = "#c8900a";
const GOLD_BG = "rgba(200,144,10,0.1)";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const today = () => new Date().toISOString().split("T")[0];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Session helpers ──────────────────────────────────────────────────────────
function loadSessions(): any[] {
  try { return JSON.parse(localStorage.getItem("atr-sessions-v2") || "[]"); } catch { return []; }
}
function saveSessions(s: any[]) {
  try { localStorage.setItem("atr-sessions-v2", JSON.stringify(s)); } catch {}
}
function loadSessionTrades(id: string): any[] {
  try { return JSON.parse(localStorage.getItem(`atr-sess-${id}`) || "[]"); } catch { return []; }
}
function saveSessionTrades(id: string, trades: any[]) {
  try { localStorage.setItem(`atr-sess-${id}`, JSON.stringify(trades)); } catch {}
}

// ── Stats ────────────────────────────────────────────────────────────────────
function computeStats(trades: any[]) {
  if (!trades.length) return null;
  const wins = trades.filter((t) => t.points > 0);
  const losses = trades.filter((t) => t.points < 0);
  const totalPnl = trades.reduce((s, t) => s + t.dollar, 0);
  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.points > 0) { curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin); }
    else if (t.points < 0) { curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss); }
    else { curWin = 0; curLoss = 0; }
  }
  const largestWin = wins.length ? Math.max(...wins.map((t) => t.dollar)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.dollar)) : 0;
  const days = new Set(trades.map((t) => t.date)).size;
  return {
    total: trades.length, wins: wins.length, losses: losses.length,
    winPct: ((wins.length / trades.length) * 100).toFixed(1),
    totalPnl, avgDollar: (totalPnl / trades.length).toFixed(2),
    longestWin, longestLoss, largestWin, largestLoss,
    perDay: days ? (trades.length / days).toFixed(1) : "0",
  };
}

// ── Session Modal ────────────────────────────────────────────────────────────
function SessionModal({ sessions, activeId, onSelect, onCreate, onRename, onDelete, onClose }:
  { sessions: any[]; activeId: string; onSelect: (id: string) => void; onCreate: (name: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,30,50,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ background: CARD, borderRadius: 18, padding: "32px 28px", width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid ${BORDER}` }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Sessions</div>
        <div style={{ fontSize: 12, color: TEXT_LIGHT, marginBottom: 22 }}>Save and switch between named trade logs — e.g. "Week of Feb 17"</div>

        {/* Existing sessions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22, maxHeight: 280, overflowY: "auto" }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${s.id === activeId ? "#00bfff" : BORDER}`, background: s.id === activeId ? "rgba(0,191,255,0.05)" : "#fafbfd", cursor: "pointer" }}
              onClick={() => { onSelect(s.id); onClose(); }}>
              <div style={{ flex: 1 }}>
                {renaming === s.id ? (
                  <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onRename(s.id, renameVal); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                    autoFocus onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 13, border: "1px solid #00bfff", borderRadius: 6, padding: "3px 8px", color: TEXT, width: "100%", fontFamily: "inherit" }} />
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, letterSpacing: 0.2 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: TEXT_LIGHT, marginTop: 2 }}>{loadSessionTrades(s.id).length} trades</div>
                  </>
                )}
              </div>
              {s.id === activeId && <span style={{ fontSize: 10, color: "#00bfff", fontWeight: 700, letterSpacing: 1 }}>ACTIVE</span>}
              <button onClick={(e) => { e.stopPropagation(); setRenaming(s.id); setRenameVal(s.name); }}
                style={{ background: "none", border: "none", color: TEXT_LIGHT, cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 5 }} title="Rename">✏️</button>
              {sessions.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${s.name}"?`)) onDelete(s.id); }}
                  style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", fontSize: 15, padding: "2px 4px" }} title="Delete">×</button>
              )}
            </div>
          ))}
        </div>

        {/* New session */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: TEXT_LIGHT, marginBottom: 8 }}>CREATE NEW SESSION</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              placeholder='e.g. "Week of Feb 17"'
              style={{ flex: 1, background: "#f4f6fb", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "9px 14px", fontSize: 13, fontFamily: "inherit" }} />
            <button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              style={{ background: "linear-gradient(135deg,#00bfff,#0070ff)", border: "none", borderRadius: 8, color: "#fff", padding: "9px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne',sans-serif", letterSpacing: 1, whiteSpace: "nowrap" }}>
              + CREATE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ATR Tracker ───────────────────────────────────────────────────────────────
function ATRTracker({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [trades, setTrades] = useState<any[]>([]);
  const [date, setDate] = useState(today());
  const [points, setPoints] = useState("");
  const [contracts, setContracts] = useState("3");
  const [filter, setFilter] = useState("all");
  const [editId, setEditId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [loading, setLoading] = useState(true);

  // Boot: load or create default session
  useEffect(() => {
    let sess = loadSessions();
    if (!sess.length) {
      const def = { id: uid(), name: "Default Session", createdAt: Date.now() };
      sess = [def];
      saveSessions(sess);
    }
    setSessions(sess);
    const lastActive = localStorage.getItem("atr-active-session") || sess[0].id;
    const validId = sess.find((s: any) => s.id === lastActive) ? lastActive : sess[0].id;
    setActiveId(validId);
    setTrades(loadSessionTrades(validId));
    setLoading(false);
  }, []);

  const switchSession = (id: string) => {
    setActiveId(id);
    setTrades(loadSessionTrades(id));
    localStorage.setItem("atr-active-session", id);
    setFilter("all");
  };

  const createSession = (name: string) => {
    const s = { id: uid(), name, createdAt: Date.now() };
    const updated = [...sessions, s];
    setSessions(updated);
    saveSessions(updated);
    switchSession(s.id);
    setShowSessions(false);
    showToast(`Session "${name}" created`);
  };

  const renameSession = (id: string, name: string) => {
    const updated = sessions.map((s) => s.id === id ? { ...s, name } : s);
    setSessions(updated);
    saveSessions(updated);
    showToast("Session renamed");
  };

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    saveSessions(updated);
    localStorage.removeItem(`atr-sess-${id}`);
    const nextId = updated[0].id;
    switchSession(nextId);
    showToast("Session deleted");
  };

  const saveTrades = useCallback((updated: any[], id: string) => {
    saveSessionTrades(id, updated);
  }, []);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  };

  const pointsNum = parseFloat(points);
  const contractsNum = parseInt(contracts) || 1;
  const pointsValid = !isNaN(pointsNum) && pointsNum !== 0;
  const previewDollar = pointsValid ? pointsNum * OZ_PER_CONTRACT * contractsNum : null;
  const isWin = pointsValid ? pointsNum > 0 : null;

  const addTrade = () => {
    if (!pointsValid) return showToast("Enter a non-zero points value", "error");
    const dollar = pointsNum * OZ_PER_CONTRACT * contractsNum;
    const newTrade = { id: Date.now(), date, points: pointsNum, contracts: contractsNum, dollar };
    const updated = [newTrade, ...trades];
    setTrades(updated);
    saveTrades(updated, activeId);
    setPoints("");
    showToast(dollar > 0 ? `+${fmt(dollar)} logged` : `${fmt(dollar)} logged`, dollar > 0 ? "success" : "loss");
  };

  const deleteTrade = (id: number) => {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    saveTrades(updated, activeId);
    showToast("Trade removed");
  };

  const saveEdit = (id: number) => {
    const p = parseFloat(editPoints);
    if (isNaN(p) || p === 0) return;
    const updated = trades.map((t) => t.id === id ? { ...t, points: p, dollar: p * OZ_PER_CONTRACT * t.contracts } : t);
    setTrades(updated);
    saveTrades(updated, activeId);
    setEditId(null);
    showToast("Trade updated");
  };

  const displayed = trades.filter((t) => {
    if (filter === "wins") return t.points > 0;
    if (filter === "losses") return t.points < 0;
    return true;
  });

  const stats = computeStats(trades);
  const activeSession = sessions.find((s) => s.id === activeId);

  if (loading) return <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_LIGHT }}>Loading...</div>;

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      {showSessions && (
        <SessionModal sessions={sessions} activeId={activeId}
          onSelect={switchSession} onCreate={createSession} onRename={renameSession}
          onDelete={deleteSession} onClose={() => setShowSessions(false)} />
      )}

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: CARD, border: `2px solid ${toast.type === "error" ? "#ff3366" : toast.type === "loss" ? "#ff6633" : "#00cc60"}`, borderRadius: 10, padding: "10px 20px", color: toast.type === "error" ? "#ff3366" : toast.type === "loss" ? "#ff6633" : "#00a040", fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontWeight: 600, animation: "slideIn .2s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "16px 28px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
        <div style={{ width: 1, height: 20, background: BORDER }} />
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: TEXT }}>
          📈 ATR <span style={{ color: "#00bfff" }}>Trailing Stop</span>
        </div>
        <div style={{ fontSize: 10, color: TEXT_LIGHT, letterSpacing: 2 }}>· 7MIN · /MGC · $10/PT/CTR</div>

        {/* Session switcher */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {stats && <span style={{ fontSize: 12, color: stats.totalPnl >= 0 ? "#00a040" : "#ff3366", fontWeight: 700 }}>{fmt(stats.totalPnl)}</span>}
          <button onClick={() => setShowSessions(true)}
            style={{ background: GOLD_BG, border: `1.5px solid ${GOLD}`, borderRadius: 8, color: GOLD, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📁</span>
            <span>{activeSession?.name || "Session"}</span>
            <span style={{ fontSize: 10, color: TEXT_LIGHT }}>▾</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "26px 22px" }}>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(138px, 1fr))", gap: 11, marginBottom: 26 }}>
            {[
              { label: "WIN RATE", value: `${stats.winPct}%`, sub: `${stats.wins}W / ${stats.losses}L`, color: parseFloat(stats.winPct) >= 50 ? "#00b050" : "#ff3366" },
              { label: "TOTAL P&L", value: fmt(stats.totalPnl), sub: `avg ${fmt(parseFloat(stats.avgDollar))}/trade`, color: stats.totalPnl >= 0 ? "#00bfff" : "#ff3366" },
              { label: "BEST TRADE", value: fmt(stats.largestWin), sub: "single trade", color: "#00b050" },
              { label: "WORST TRADE", value: fmt(stats.largestLoss), sub: "single trade", color: "#ff3366" },
              { label: "WIN STREAK", value: String(stats.longestWin), sub: "consecutive", color: GOLD },
              { label: "LOSS STREAK", value: String(stats.longestLoss), sub: "consecutive", color: "#ff6633" },
              { label: "AVG / DAY", value: stats.perDay, sub: "trades/session", color: "#aa66ff" },
              { label: "TOTAL", value: String(stats.total), sub: "this session", color: "#00bfff" },
            ].map((s) => (
              <div key={s.label} className="stat-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 15px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: TEXT_LIGHT, marginBottom: 7 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: TEXT_LIGHT, marginTop: 5 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 22px", marginBottom: 22, boxShadow: "0 2px 14px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: TEXT_LIGHT, marginBottom: 16 }}>LOG NEW TRADE</div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>

            {/* Date */}
            <div style={{ minWidth: 148 }}>
              <div style={{ fontSize: 10, color: TEXT_MID, marginBottom: 6, letterSpacing: 1 }}>DATE</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "9px 12px", fontSize: 13, width: "100%", fontFamily: "inherit" }} />
            </div>

            {/* Points */}
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 10, color: TEXT_MID, marginBottom: 6, letterSpacing: 1 }}>POINTS &nbsp;<span style={{ color: GOLD, fontWeight: 700 }}>◆</span></div>
              <div style={{ display: "flex", alignItems: "center", background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                <span style={{ padding: "0 12px", color: GOLD, fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>PT</span>
                <input type="number" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrade()}
                  placeholder="+ win  /  − loss"
                  style={{ background: "transparent", border: "none", color: TEXT, padding: "9px 12px 9px 0", fontSize: 14, width: "100%", fontFamily: "inherit", fontWeight: 600 }} />
              </div>
            </div>

            {/* Result badge */}
            <div>
              <div style={{ fontSize: 10, color: TEXT_MID, marginBottom: 6, letterSpacing: 1 }}>RESULT</div>
              <div style={{
                padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 800, fontFamily: "'Syne', sans-serif", letterSpacing: 1, minWidth: 100, textAlign: "center",
                background: isWin === null ? "#f5f7fc" : isWin ? "rgba(0,192,80,0.1)" : "rgba(255,51,102,0.09)",
                color: isWin === null ? TEXT_LIGHT : isWin ? "#00a040" : "#ff3366",
                border: `2px solid ${isWin === null ? BORDER : isWin ? "#00c060" : "#ff3366"}`,
                boxShadow: isWin === null ? "none" : isWin ? "0 0 14px rgba(0,192,80,0.2)" : "0 0 14px rgba(255,51,102,0.18)",
                transition: "all 0.2s",
              }}>
                {isWin === null ? "— —" : isWin ? "✓ WIN" : "✕ LOSS"}
              </div>
            </div>

            {/* Contracts */}
            <div style={{ minWidth: 100 }}>
              <div style={{ fontSize: 10, color: TEXT_MID, marginBottom: 6, letterSpacing: 1 }}>/MGC CONTRACTS</div>
              <input type="number" min="1" value={contracts} onChange={(e) => setContracts(e.target.value)}
                style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "9px 12px", fontSize: 13, width: "100%", textAlign: "center", fontFamily: "inherit" }} />
            </div>

            {/* P&L Preview */}
            <div style={{ minWidth: 132 }}>
              <div style={{ fontSize: 10, color: TEXT_MID, marginBottom: 6, letterSpacing: 1 }}>P&L PREVIEW</div>
              <div style={{
                padding: "9px 14px", background: "#f5f7fc",
                border: `2px solid ${previewDollar !== null ? (previewDollar > 0 ? "#00c060" : "#ff3366") : BORDER}`,
                borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: "right",
                color: previewDollar !== null ? (previewDollar > 0 ? "#00a040" : "#ff3366") : TEXT_LIGHT,
                boxShadow: previewDollar !== null ? `0 0 14px ${previewDollar > 0 ? "rgba(0,192,80,0.2)" : "rgba(255,51,102,0.18)"}` : "none",
                transition: "all 0.2s",
              }}>
                {previewDollar !== null ? fmt(previewDollar) : "$—"}
              </div>
              {previewDollar !== null && <div style={{ fontSize: 9, color: TEXT_LIGHT, marginTop: 4, textAlign: "center" }}>{pointsNum > 0 ? "+" : ""}{pointsNum} pts × {contractsNum}x</div>}
            </div>

            <button onClick={addTrade} className="log-btn"
              style={{ background: "linear-gradient(135deg,#00bfff,#0070ff)", border: "none", borderRadius: 8, color: "#fff", padding: "10px 26px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne',sans-serif", letterSpacing: 1, boxShadow: "0 4px 16px rgba(0,128,255,0.26)", whiteSpace: "nowrap", transition: "all .15s" }}>
              LOG TRADE
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {[{ key: "all", label: "ALL", color: "#00bfff" }, { key: "wins", label: "✓ WINS", color: "#00c060" }, { key: "losses", label: "✕ LOSSES", color: "#ff3366" }].map((f) => (
            <div key={f.key} onClick={() => setFilter(f.key)} className="pill"
              style={{ padding: "5px 16px", borderRadius: 20, fontSize: 11, letterSpacing: 1, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                background: filter === f.key ? f.color : CARD, color: filter === f.key ? "#fff" : TEXT_MID,
                border: `1px solid ${filter === f.key ? "transparent" : BORDER}`,
                boxShadow: filter === f.key ? `0 2px 10px ${f.color}55` : "none" }}>
              {f.label}
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: TEXT_LIGHT }}>{displayed.length} trades · {activeSession?.name}</div>
        </div>

        {/* Table */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 14px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px 118px 1fr 80px 124px 76px 44px", padding: "11px 20px", borderBottom: `1px solid ${BORDER}`, background: "#f5f7fc" }}>
            {["#", "DATE", "POINTS", "CTRS", "P&L", "RESULT", ""].map((h) => (
              <div key={h} style={{ fontSize: 9, letterSpacing: 2, color: TEXT_LIGHT, fontWeight: 700 }}>{h}</div>
            ))}
          </div>

          {displayed.length === 0 && (
            <div style={{ padding: "50px 20px", textAlign: "center", color: TEXT_LIGHT, fontSize: 13 }}>
              No trades in this session yet — log one above ↑
            </div>
          )}

          {displayed.map((t, i) => {
            const win = t.points > 0;
            return (
              <div key={t.id} className="trade-row"
                style={{ display: "grid", gridTemplateColumns: "44px 118px 1fr 80px 124px 76px 44px", padding: "13px 20px", borderBottom: `1px solid #f0f3fa`, alignItems: "center", background: i % 2 === 0 ? CARD : "#fafbfd", transition: "background 0.1s" }}>
                <div style={{ color: TEXT_LIGHT, fontSize: 11 }}>{displayed.length - i}</div>
                <div style={{ color: TEXT_MID, fontSize: 12 }}>{t.date}</div>
                <div>
                  {editId === t.id ? (
                    <input type="number" step="0.5" value={editPoints} onChange={(e) => setEditPoints(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }}
                      autoFocus style={{ background: "#f5f7fc", border: "1px solid #00bfff", borderRadius: 5, color: TEXT, padding: "3px 8px", fontSize: 13, width: 90, fontFamily: "inherit" }} />
                  ) : (
                    <span onDoubleClick={() => { setEditId(t.id); setEditPoints(String(t.points)); }}
                      title="Double-click to edit"
                      style={{ color: GOLD, fontSize: 15, fontWeight: 700, cursor: "text", fontFamily: "'Syne', sans-serif" }}>
                      {win ? "+" : ""}{t.points} <span style={{ fontSize: 10, color: TEXT_LIGHT, fontFamily: "inherit", fontWeight: 400 }}>pts</span>
                    </span>
                  )}
                </div>
                <div style={{ color: TEXT_MID, fontSize: 12 }}>{t.contracts}x</div>
                <div style={{ color: win ? "#00a040" : "#ff3366", fontSize: 13, fontWeight: 700 }}>{fmt(t.dollar)}</div>
                <div>
                  <span style={{ background: win ? "rgba(0,192,80,0.1)" : "rgba(255,51,102,0.08)", color: win ? "#00a040" : "#ff3366", borderRadius: 5, padding: "2px 10px", fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>
                    {win ? "WIN" : "LOSS"}
                  </span>
                </div>
                <div>
                  <button className="btn-del" onClick={() => deleteTrade(t.id)}
                    style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1, opacity: 0, transition: "opacity 0.15s" }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 10, color: TEXT_LIGHT, letterSpacing: 1 }}>
          DOUBLE-CLICK POINTS TO EDIT · /MGC = $10 PER POINT PER CONTRACT · DATA SAVED TO BROWSER
        </div>
      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
const STRATEGIES = [
  { id: "atr-trailing", name: "ATR Trailing Stop", tag: "7MIN · /MGC", description: "ATR trailing stop strategy. Log points manually — positive = win, negative = loss. Auto-calculates P&L per /MGC micro contract.", color: "#00bfff", icon: "📈" },
  { id: "cs1", name: "EMA Crossover", tag: "COMING SOON", description: "5 EMA / 20 EMA crossover strategy tracker. Log crossover signals and track performance over time.", color: "#aa66ff", icon: "🔀", locked: true },
  { id: "cs2", name: "Support & Resistance", tag: "COMING SOON", description: "Key level bounce and break strategy. Track entries off major S/R zones with defined risk.", color: "#ff6633", icon: "⚡", locked: true },
];

function HomePage({ onSelect, tradeCounts }: { onSelect: (id: string) => void; tradeCounts: Record<string, number> }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "18px 36px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: TEXT }}>
          ATR <span style={{ color: "#00bfff" }}>TRADE</span> BACKTESTER
        </div>
        <div style={{ fontSize: 10, color: TEXT_LIGHT, letterSpacing: 3 }}>· STRATEGY DASHBOARD</div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px" }}>
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: TEXT, marginBottom: 6 }}>My Strategies</div>
          <div style={{ fontSize: 13, color: TEXT_MID, letterSpacing: 0.2 }}>Select a strategy to log and analyze your backtesting trades.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {STRATEGIES.map((s: any) => {
            const count = tradeCounts[s.id] || 0;
            return (
              <div key={s.id} onClick={() => !s.locked && onSelect(s.id)} className={s.locked ? "" : "strategy-card"}
                style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: "26px 24px", cursor: s.locked ? "default" : "pointer", opacity: s.locked ? 0.5 : 1, transition: "transform 0.18s, box-shadow 0.18s", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.locked ? BORDER : s.color, borderRadius: "16px 16px 0 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <span style={{ fontSize: 30 }}>{s.icon}</span>
                  <span style={{ fontSize: 10, letterSpacing: 2, color: s.locked ? TEXT_LIGHT : s.color, fontWeight: 700, background: s.locked ? "#f0f2f8" : `${s.color}16`, padding: "3px 10px", borderRadius: 20 }}>{s.tag}</span>
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 8, letterSpacing: -0.3 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: TEXT_MID, lineHeight: 1.7, marginBottom: 20 }}>{s.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: TEXT_LIGHT }}>{s.locked ? "—" : <><span style={{ color: TEXT, fontWeight: 700 }}>{count}</span> trades logged</>}</div>
                  {!s.locked && <div style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>OPEN →</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<string | null>(null);
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const counts: Record<string, number> = {};
    try {
      const sessions = loadSessions();
      let total = 0;
      sessions.forEach((s: any) => { total += loadSessionTrades(s.id).length; });
      counts["atr-trailing"] = total;
    } catch {}
    setTradeCounts(counts);
  }, [page]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: 'IBM Plex Mono', monospace; }
        input:focus { outline: none !important; border-color: #00bfff !important; box-shadow: 0 0 0 3px rgba(0,191,255,0.13) !important; }
        input[type=date]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.5; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #eef0f6; } ::-webkit-scrollbar-thumb { background: #c8d2e2; border-radius: 2px; }
        .strategy-card:hover { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(0,0,0,0.09) !important; }
        .trade-row:hover { background: #eaecf5 !important; }
        .trade-row:hover .btn-del { opacity: 1 !important; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.07) !important; }
        .log-btn:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0,128,255,0.36) !important; }
        .pill:hover { opacity: 0.82; transform: translateY(-1px); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
      `}</style>
      {page === null && <HomePage onSelect={setPage} tradeCounts={tradeCounts} />}
      {page === "atr-trailing" && <ATRTracker onBack={() => setPage(null)} />}
    </>
  );
}
