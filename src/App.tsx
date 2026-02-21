import { useState, useEffect, useCallback } from "react";

const OZ_PER_CONTRACT = 10;
const TEXT = "#1a2535";
const TEXT_MID = "#3a4f66";
const TEXT_LIGHT = "#6b7e96";
const BORDER = "#dde3ef";
const BG = "#eef0f6";
const CARD = "#fff";
const GOLD = "#c8900a";
const GOLD_BG = "rgba(200,144,10,0.1)";
const F = "'Inter', sans-serif";
const FH = "'Syne', sans-serif";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const fmtShort = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().split("T")[0];
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

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

function CalendarView({ trades }: { trades: any[] }) {
  const [calDate, setCalDate] = useState(new Date());
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const monthName = calDate.toLocaleString("default", { month: "long", year: "numeric" });
  const dayMap: Record<string, number> = {};
  const dayCountMap: Record<string, number> = {};
  trades.forEach((t) => {
    const d = new Date(t.date + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      dayMap[t.date] = (dayMap[t.date] || 0) + t.dollar;
      dayCountMap[t.date] = (dayCountMap[t.date] || 0) + 1;
    }
  });
  const monthPnl = Object.values(dayMap).reduce((s, v) => s + v, 0);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateKey = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const todayStr = today();

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 14px rgba(0,0,0,0.04)", marginBottom: 28 }}>
      <div style={{ padding: "20px 28px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 16, background: "#f8f9fd" }}>
        <div style={{ fontSize: 13, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700, fontFamily: F }}>P&L CALENDAR</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: TEXT }}>{monthName}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: monthPnl >= 0 ? "#00a040" : "#ff3366", fontFamily: F }}>{fmtShort(monthPnl)}</span>
          <button onClick={() => setCalDate(new Date())} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: F, fontWeight: 600 }}>Today</button>
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 12px", fontSize: 16, cursor: "pointer" }}>‹</button>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 12px", fontSize: 16, cursor: "pointer" }}>›</button>
        </div>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 120px", borderBottom: `1px solid ${BORDER}` }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} style={{ padding: "12px 0", textAlign: "center", fontSize: 12, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700, fontFamily: F }}>{d}</div>
          ))}
          <div style={{ padding: "12px 16px", fontSize: 12, color: TEXT_LIGHT, fontWeight: 700, borderLeft: `1px solid ${BORDER}`, fontFamily: F }}>WEEK</div>
        </div>
        {weeks.map((week, wi) => {
          const weekPnl = week.reduce((s, d) => s + (d ? (dayMap[dateKey(d)] || 0) : 0), 0);
          const weekTrades = week.reduce((s, d) => s + (d ? (dayCountMap[dateKey(d)] || 0) : 0), 0);
          return (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 120px", borderBottom: wi < weeks.length - 1 ? `1px solid #f0f3fa` : "none", minHeight: 86 }}>
              {week.map((d, di) => {
                if (!d) return <div key={di} style={{ background: "#fafbfd", borderRight: di < 6 ? `1px solid #f0f3fa` : "none" }} />;
                const key = dateKey(d);
                const pnl = dayMap[key];
                const count = dayCountMap[key] || 0;
                const isToday = key === todayStr;
                const hasData = pnl !== undefined;
                const isWin = hasData && pnl > 0;
                const isLoss = hasData && pnl < 0;
                return (
                  <div key={di} style={{
                    padding: "10px 12px", borderRight: di < 6 ? `1px solid #f0f3fa` : "none",
                    background: isToday ? "rgba(0,191,255,0.05)" : isWin ? "rgba(0,192,80,0.05)" : isLoss ? "rgba(255,51,102,0.04)" : "transparent",
                    minHeight: 86, display: "flex", flexDirection: "column", justifyContent: "space-between",
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "#00bfff" : "transparent", fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : TEXT_MID, fontFamily: F }}>{d}</div>
                    {hasData && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isWin ? "#00a040" : "#ff3366", fontFamily: F }}>{fmtShort(pnl)}</div>
                        <div style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 2, fontFamily: F }}>{count} trade{count !== 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ padding: "14px 16px", borderLeft: `1px solid ${BORDER}`, background: weekPnl > 0 ? "rgba(0,192,80,0.06)" : weekPnl < 0 ? "rgba(255,51,102,0.05)" : "#fafbfd", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                <div style={{ fontSize: 11, color: TEXT_LIGHT, fontWeight: 600, fontFamily: F }}>Week {wi + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: weekPnl > 0 ? "#00a040" : weekPnl < 0 ? "#ff3366" : TEXT_LIGHT, fontFamily: F }}>{weekTrades > 0 ? fmtShort(weekPnl) : "$0"}</div>
                <div style={{ fontSize: 11, color: TEXT_LIGHT, fontFamily: F }}>{weekTrades} trades</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionModal({ sessions, activeId, onSelect, onCreate, onRename, onDelete, onClose }:
  { sessions: any[]; activeId: string; onSelect: (id: string) => void; onCreate: (name: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,30,50,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: CARD, borderRadius: 20, padding: "36px 32px", width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid ${BORDER}`, fontFamily: F }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Sessions</div>
        <div style={{ fontSize: 14, color: TEXT_LIGHT, marginBottom: 26 }}>Save and switch between named trade logs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, maxHeight: 300, overflowY: "auto" }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, border: `1.5px solid ${s.id === activeId ? "#00bfff" : BORDER}`, background: s.id === activeId ? "rgba(0,191,255,0.05)" : "#fafbfd", cursor: "pointer" }}
              onClick={() => { onSelect(s.id); onClose(); }}>
              <div style={{ flex: 1 }}>
                {renaming === s.id ? (
                  <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onRename(s.id, renameVal); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                    autoFocus onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 15, border: "1px solid #00bfff", borderRadius: 6, padding: "5px 12px", color: TEXT, width: "100%", fontFamily: F }} />
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: TEXT_LIGHT, marginTop: 3 }}>{loadSessionTrades(s.id).length} trades</div>
                  </>
                )}
              </div>
              {s.id === activeId && <span style={{ fontSize: 11, color: "#00bfff", fontWeight: 700, letterSpacing: 1 }}>ACTIVE</span>}
              <button onClick={(e) => { e.stopPropagation(); setRenaming(s.id); setRenameVal(s.name); }} style={{ background: "none", border: "none", color: TEXT_LIGHT, cursor: "pointer", fontSize: 15, padding: "2px 6px" }}>✏️</button>
              {sessions.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${s.name}"?`)) onDelete(s.id); }} style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", fontSize: 18, padding: "2px 4px" }}>×</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, color: TEXT_LIGHT, marginBottom: 12, fontWeight: 700 }}>CREATE NEW SESSION</div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              placeholder='e.g. "Week of Feb 17"'
              style={{ flex: 1, background: "#f4f6fb", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: "13px 18px", fontSize: 15, fontFamily: F }} />
            <button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              style={{ background: "linear-gradient(135deg,#00bfff,#0070ff)", border: "none", borderRadius: 10, color: "#fff", padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>
              + CREATE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    let sess = loadSessions();
    if (!sess.length) { const def = { id: uid(), name: "Default Session", createdAt: Date.now() }; sess = [def]; saveSessions(sess); }
    setSessions(sess);
    const lastActive = localStorage.getItem("atr-active-session") || sess[0].id;
    const validId = sess.find((s: any) => s.id === lastActive) ? lastActive : sess[0].id;
    setActiveId(validId); setTrades(loadSessionTrades(validId)); setLoading(false);
  }, []);

  const switchSession = (id: string) => { setActiveId(id); setTrades(loadSessionTrades(id)); localStorage.setItem("atr-active-session", id); setFilter("all"); };
  const createSession = (name: string) => { const s = { id: uid(), name, createdAt: Date.now() }; const u = [...sessions, s]; setSessions(u); saveSessions(u); switchSession(s.id); setShowSessions(false); showToast(`Session "${name}" created`); };
  const renameSession = (id: string, name: string) => { const u = sessions.map((s) => s.id === id ? { ...s, name } : s); setSessions(u); saveSessions(u); };
  const deleteSession = (id: string) => { const u = sessions.filter((s) => s.id !== id); setSessions(u); saveSessions(u); localStorage.removeItem(`atr-sess-${id}`); switchSession(u[0].id); showToast("Session deleted"); };
  const saveTrades = useCallback((u: any[], id: string) => { saveSessionTrades(id, u); }, []);
  const showToast = (msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2200); };

  const pointsNum = parseFloat(points);
  const contractsNum = parseInt(contracts) || 1;
  const pointsValid = !isNaN(pointsNum) && pointsNum !== 0;
  const previewDollar = pointsValid ? pointsNum * OZ_PER_CONTRACT * contractsNum : null;
  const isWin = pointsValid ? pointsNum > 0 : null;

  const addTrade = () => {
    if (!pointsValid) return showToast("Enter a non-zero points value", "error");
    const dollar = pointsNum * OZ_PER_CONTRACT * contractsNum;
    const u = [{ id: Date.now(), date, points: pointsNum, contracts: contractsNum, dollar }, ...trades];
    setTrades(u); saveTrades(u, activeId); setPoints("");
    showToast(dollar > 0 ? `+${fmt(dollar)} logged` : `${fmt(dollar)} logged`, dollar > 0 ? "success" : "loss");
  };
  const deleteTrade = (id: number) => { const u = trades.filter((t) => t.id !== id); setTrades(u); saveTrades(u, activeId); showToast("Trade removed"); };
  const saveEdit = (id: number) => {
    const p = parseFloat(editPoints); if (isNaN(p) || p === 0) return;
    const u = trades.map((t) => t.id === id ? { ...t, points: p, dollar: p * OZ_PER_CONTRACT * t.contracts } : t);
    setTrades(u); saveTrades(u, activeId); setEditId(null); showToast("Trade updated");
  };

  const displayed = trades.filter((t) => filter === "wins" ? t.points > 0 : filter === "losses" ? t.points < 0 : true);
  const stats = computeStats(trades);
  const activeSession = sessions.find((s) => s.id === activeId);

  if (loading) return <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_LIGHT, fontFamily: F, fontSize: 16 }}>Loading...</div>;

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: F }}>
      {showSessions && <SessionModal sessions={sessions} activeId={activeId} onSelect={switchSession} onCreate={createSession} onRename={renameSession} onDelete={deleteSession} onClose={() => setShowSessions(false)} />}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 999, background: CARD, border: `2px solid ${toast.type === "error" ? "#ff3366" : toast.type === "loss" ? "#ff6633" : "#00cc60"}`, borderRadius: 12, padding: "14px 24px", color: toast.type === "error" ? "#ff3366" : toast.type === "loss" ? "#ff6633" : "#00a040", fontSize: 15, fontWeight: 600, fontFamily: F, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "22px 36px", display: "flex", alignItems: "center", gap: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT_MID, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: F, fontWeight: 600 }}>← Back</button>
        <div style={{ width: 1, height: 28, background: BORDER }} />
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: TEXT }}>
          📈 ATR <span style={{ color: "#00bfff" }}>Trailing Stop</span>
        </div>
        <div style={{ fontSize: 13, color: TEXT_LIGHT, letterSpacing: 1, fontFamily: F }}>· 7MIN · /MGC · $10/PT/CTR</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
          {stats && <span style={{ fontSize: 16, color: stats.totalPnl >= 0 ? "#00a040" : "#ff3366", fontWeight: 700, fontFamily: F }}>{fmt(stats.totalPnl)}</span>}
          <button onClick={() => setShowSessions(true)} style={{ background: GOLD_BG, border: `1.5px solid ${GOLD}`, borderRadius: 10, color: GOLD, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 10 }}>
            <span>📁</span><span>{activeSession?.name || "Session"}</span><span style={{ fontSize: 12, color: TEXT_LIGHT }}>▾</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 28px" }}>

        {/* ① LOG INPUT */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "28px 30px", marginBottom: 26, boxShadow: "0 2px 14px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 13, letterSpacing: 1, color: TEXT_LIGHT, marginBottom: 22, fontWeight: 700 }}>LOG NEW TRADE</div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ minWidth: 170 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>DATE</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: "13px 16px", fontSize: 15, width: "100%", fontFamily: F }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>POINTS <span style={{ color: GOLD }}>◆</span></div>
              <div style={{ display: "flex", alignItems: "center", background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                <span style={{ padding: "0 16px", color: GOLD, fontSize: 15, fontWeight: 700 }}>PT</span>
                <input type="number" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrade()}
                  placeholder="+ win  /  − loss"
                  style={{ background: "transparent", border: "none", color: TEXT, padding: "13px 16px 13px 0", fontSize: 16, width: "100%", fontFamily: F, fontWeight: 600 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>RESULT</div>
              <div style={{
                padding: "13px 26px", borderRadius: 10, fontSize: 15, fontWeight: 800, fontFamily: FH, letterSpacing: 1, minWidth: 120, textAlign: "center",
                background: isWin === null ? "#f5f7fc" : isWin ? "rgba(0,192,80,0.1)" : "rgba(255,51,102,0.09)",
                color: isWin === null ? TEXT_LIGHT : isWin ? "#00a040" : "#ff3366",
                border: `2px solid ${isWin === null ? BORDER : isWin ? "#00c060" : "#ff3366"}`,
                boxShadow: isWin === null ? "none" : isWin ? "0 0 16px rgba(0,192,80,0.2)" : "0 0 16px rgba(255,51,102,0.18)",
                transition: "all 0.2s",
              }}>
                {isWin === null ? "— —" : isWin ? "✓ WIN" : "✕ LOSS"}
              </div>
            </div>
            <div style={{ minWidth: 120 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>/MGC CTRS</div>
              <input type="number" min="1" value={contracts} onChange={(e) => setContracts(e.target.value)}
                style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: "13px 16px", fontSize: 15, width: "100%", textAlign: "center", fontFamily: F }} />
            </div>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>P&L PREVIEW</div>
              <div style={{
                padding: "13px 18px", background: "#f5f7fc",
                border: `2px solid ${previewDollar !== null ? (previewDollar > 0 ? "#00c060" : "#ff3366") : BORDER}`,
                borderRadius: 10, fontSize: 16, fontWeight: 700, textAlign: "right", fontFamily: F,
                color: previewDollar !== null ? (previewDollar > 0 ? "#00a040" : "#ff3366") : TEXT_LIGHT,
                boxShadow: previewDollar !== null ? `0 0 14px ${previewDollar > 0 ? "rgba(0,192,80,0.2)" : "rgba(255,51,102,0.18)"}` : "none",
                transition: "all 0.2s",
              }}>
                {previewDollar !== null ? fmt(previewDollar) : "$—"}
              </div>
              {previewDollar !== null && <div style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 5, textAlign: "center", fontFamily: F }}>{pointsNum > 0 ? "+" : ""}{pointsNum} pts × {contractsNum}x</div>}
            </div>
            <button onClick={addTrade} className="log-btn"
              style={{ background: "linear-gradient(135deg,#00bfff,#0070ff)", border: "none", borderRadius: 10, color: "#fff", padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 4px 16px rgba(0,128,255,0.26)", whiteSpace: "nowrap", transition: "all .15s" }}>
              LOG TRADE
            </button>
          </div>
        </div>

        {/* ② TRADE TABLE */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {[{ key: "all", label: "ALL", color: "#00bfff" }, { key: "wins", label: "✓ WINS", color: "#00c060" }, { key: "losses", label: "✕ LOSSES", color: "#ff3366" }].map((f) => (
              <div key={f.key} onClick={() => setFilter(f.key)} className="pill"
                style={{ padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", fontFamily: F,
                  background: filter === f.key ? f.color : CARD, color: filter === f.key ? "#fff" : TEXT_MID,
                  border: `1px solid ${filter === f.key ? "transparent" : BORDER}`,
                  boxShadow: filter === f.key ? `0 2px 10px ${f.color}55` : "none" }}>
                {f.label}
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 13, color: TEXT_LIGHT, fontFamily: F }}>{displayed.length} trades · {activeSession?.name}</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 14px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "50px 130px 1fr 90px 140px 90px 50px", padding: "14px 24px", borderBottom: `1px solid ${BORDER}`, background: "#f5f7fc" }}>
              {["#","DATE","POINTS","CTRS","P&L","RESULT",""].map((h) => (
                <div key={h} style={{ fontSize: 12, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700, fontFamily: F }}>{h}</div>
              ))}
            </div>
            {displayed.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: TEXT_LIGHT, fontSize: 15, fontFamily: F }}>No trades yet — log one above ↑</div>
            )}
            {displayed.map((t, i) => {
              const win = t.points > 0;
              return (
                <div key={t.id} className="trade-row" style={{ display: "grid", gridTemplateColumns: "50px 130px 1fr 90px 140px 90px 50px", padding: "16px 24px", borderBottom: `1px solid #f0f3fa`, alignItems: "center", background: i % 2 === 0 ? CARD : "#fafbfd", transition: "background 0.1s" }}>
                  <div style={{ color: TEXT_LIGHT, fontSize: 13, fontFamily: F }}>{displayed.length - i}</div>
                  <div style={{ color: TEXT_MID, fontSize: 14, fontFamily: F }}>{t.date}</div>
                  <div>
                    {editId === t.id ? (
                      <input type="number" step="0.5" value={editPoints} onChange={(e) => setEditPoints(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }}
                        autoFocus style={{ background: "#f5f7fc", border: "1px solid #00bfff", borderRadius: 6, color: TEXT, padding: "5px 12px", fontSize: 15, width: 100, fontFamily: F }} />
                    ) : (
                      <span onDoubleClick={() => { setEditId(t.id); setEditPoints(String(t.points)); }}
                        title="Double-click to edit"
                        style={{ color: GOLD, fontSize: 16, fontWeight: 700, cursor: "text", fontFamily: FH }}>
                        {win ? "+" : ""}{t.points} <span style={{ fontSize: 12, color: TEXT_LIGHT, fontFamily: F, fontWeight: 400 }}>pts</span>
                      </span>
                    )}
                  </div>
                  <div style={{ color: TEXT_MID, fontSize: 14, fontFamily: F }}>{t.contracts}x</div>
                  <div style={{ color: win ? "#00a040" : "#ff3366", fontSize: 15, fontWeight: 700, fontFamily: F }}>{fmt(t.dollar)}</div>
                  <div>
                    <span style={{ background: win ? "rgba(0,192,80,0.1)" : "rgba(255,51,102,0.08)", color: win ? "#00a040" : "#ff3366", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, fontFamily: F }}>
                      {win ? "WIN" : "LOSS"}
                    </span>
                  </div>
                  <div>
                    <button className="btn-del" onClick={() => deleteTrade(t.id)} style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1, opacity: 0, transition: "opacity 0.15s" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ③ CALENDAR */}
        <CalendarView trades={trades} />

        {/* ④ STATS */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { label: "WIN RATE", value: `${stats.winPct}%`, sub: `${stats.wins}W / ${stats.losses}L`, color: parseFloat(stats.winPct) >= 50 ? "#00b050" : "#ff3366" },
              { label: "TOTAL P&L", value: fmt(stats.totalPnl), sub: `avg ${fmt(parseFloat(stats.avgDollar))}/trade`, color: stats.totalPnl >= 0 ? "#00bfff" : "#ff3366" },
              { label: "BEST TRADE", value: fmt(stats.largestWin), sub: "single trade", color: "#00b050" },
              { label: "WORST TRADE", value: fmt(stats.largestLoss), sub: "single trade", color: "#ff3366" },
              { label: "WIN STREAK", value: String(stats.longestWin), sub: "consecutive", color: GOLD },
              { label: "LOSS STREAK", value: String(stats.longestLoss), sub: "consecutive", color: "#ff6633" },
              { label: "AVG / DAY", value: stats.perDay, sub: "trades/session", color: "#aa66ff" },
              { label: "TOTAL TRADES", value: String(stats.total), sub: "this session", color: "#00bfff" },
            ].map((s) => (
              <div key={s.label} className="stat-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <div style={{ fontSize: 12, letterSpacing: 1, color: TEXT_LIGHT, marginBottom: 12, fontWeight: 700, fontFamily: F }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: FH, lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: TEXT_LIGHT, marginTop: 8, fontFamily: F }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: "center", marginBottom: 28, fontSize: 12, color: TEXT_LIGHT, fontFamily: F }}>
          Double-click points to edit · /MGC = $10 per point per contract · Data saved to browser
        </div>
      </div>
    </div>
  );
}

const STRATEGIES = [
  { id: "atr-trailing", name: "ATR Trailing Stop", tag: "7MIN · /MGC", description: "ATR trailing stop strategy. Log points manually — positive = win, negative = loss. Auto-calculates P&L per /MGC micro contract.", color: "#00bfff", icon: "📈" },
  { id: "cs1", name: "EMA Crossover", tag: "COMING SOON", description: "5 EMA / 20 EMA crossover strategy tracker. Log crossover signals and track performance over time.", color: "#aa66ff", icon: "🔀", locked: true },
  { id: "cs2", name: "Support & Resistance", tag: "COMING SOON", description: "Key level bounce and break strategy. Track entries off major S/R zones with defined risk.", color: "#ff6633", icon: "⚡", locked: true },
];

function HomePage({ onSelect, tradeCounts }: { onSelect: (id: string) => void; tradeCounts: Record<string, number> }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: F }}>
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "24px 40px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, color: TEXT }}>
          ATR <span style={{ color: "#00bfff" }}>TRADE</span> BACKTESTER
        </div>
        <div style={{ fontSize: 13, color: TEXT_LIGHT, letterSpacing: 2, fontFamily: F }}>· STRATEGY DASHBOARD</div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px" }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: FH, fontSize: 30, fontWeight: 800, color: TEXT, marginBottom: 10 }}>My Strategies</div>
          <div style={{ fontSize: 16, color: TEXT_MID, fontFamily: F }}>Select a strategy to log and analyze your backtesting trades.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {STRATEGIES.map((s: any) => {
            const count = tradeCounts[s.id] || 0;
            return (
              <div key={s.id} onClick={() => !s.locked && onSelect(s.id)} className={s.locked ? "" : "strategy-card"}
                style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 18, padding: "30px 28px", cursor: s.locked ? "default" : "pointer", opacity: s.locked ? 0.5 : 1, transition: "transform 0.18s, box-shadow 0.18s", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: s.locked ? BORDER : s.color, borderRadius: "18px 18px 0 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <span style={{ fontSize: 36 }}>{s.icon}</span>
                  <span style={{ fontSize: 12, letterSpacing: 1, color: s.locked ? TEXT_LIGHT : s.color, fontWeight: 700, background: s.locked ? "#f0f2f8" : `${s.color}16`, padding: "5px 14px", borderRadius: 20, fontFamily: F }}>{s.tag}</span>
                </div>
                <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 12 }}>{s.name}</div>
                <div style={{ fontSize: 14, color: TEXT_MID, lineHeight: 1.7, marginBottom: 24, fontFamily: F }}>{s.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: TEXT_LIGHT, fontFamily: F }}>{s.locked ? "—" : <><span style={{ color: TEXT, fontWeight: 700 }}>{count}</span> trades logged</>}</div>
                  {!s.locked && <div style={{ fontSize: 14, color: s.color, fontWeight: 700, fontFamily: F }}>OPEN →</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<string | null>(null);
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const counts: Record<string, number> = {};
    try { const sessions = loadSessions(); let total = 0; sessions.forEach((s: any) => { total += loadSessionTrades(s.id).length; }); counts["atr-trailing"] = total; } catch {}
    setTradeCounts(counts);
  }, [page]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        input { font-family: 'Inter', sans-serif; }
        input:focus { outline: none !important; border-color: #00bfff !important; box-shadow: 0 0 0 3px rgba(0,191,255,0.13) !important; }
        input[type=date]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.5; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #eef0f6; } ::-webkit-scrollbar-thumb { background: #c8d2e2; border-radius: 3px; }
        .strategy-card:hover { transform: translateY(-5px); box-shadow: 0 16px 40px rgba(0,0,0,0.1) !important; }
        .trade-row:hover { background: #eaecf5 !important; }
        .trade-row:hover .btn-del { opacity: 1 !important; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.07) !important; }
        .log-btn:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,128,255,0.36) !important; }
        .pill:hover { opacity: 0.82; transform: translateY(-1px); }
        @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
      `}</style>
      {page === null && <HomePage onSelect={setPage} tradeCounts={tradeCounts} />}
      {page === "atr-trailing" && <ATRTracker onBack={() => setPage(null)} />}
    </>
  );
}
