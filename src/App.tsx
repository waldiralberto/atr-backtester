import { useState, useEffect, useCallback, useRef } from "react";

const OZ_PER_CONTRACT = 10;
const FEE_PER_CONTRACT = 1.24; // $1.24 per /MGC contract per trade
const TEXT = "#1a2535";
const TEXT_MID = "#3a4f66";
const TEXT_LIGHT = "#6b7e96";
const BORDER = "#dde3ef";
const BG = "#eef0f6";
const CARD = "#fff";
const GOLD = "#c8900a";
const GOLD_BG = "rgba(200,144,10,0.1)";
const F = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const fmtShort = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().split("T")[0];
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// net = gross P&L minus fees
const calcNet = (dollar: number, contracts: number) => dollar - (contracts * FEE_PER_CONTRACT);

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
  const wins = trades.filter((t) => t.net > 0);
  const losses = trades.filter((t) => t.net <= 0);
  const totalNet = trades.reduce((s, t) => s + t.net, 0);
  const totalFees = trades.reduce((s, t) => s + (t.fees || 0), 0);
  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.net > 0) { curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin); }
    else { curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss); }
  }
  const largestWin = wins.length ? Math.max(...wins.map((t) => t.net)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.net)) : 0;
  const days = new Set(trades.map((t) => t.date)).size;
  return {
    total: trades.length, wins: wins.length, losses: losses.length,
    winPct: ((wins.length / trades.length) * 100).toFixed(1),
    totalNet, totalFees, avgNet: totalNet / trades.length,
    longestWin, longestLoss, largestWin, largestLoss,
    perDay: days ? (trades.length / days).toFixed(1) : "0",
  };
}

// ── Calendar ──────────────────────────────────────────────────────────────────
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
      dayMap[t.date] = (dayMap[t.date] || 0) + t.net;
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
        <div style={{ fontSize: 13, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700 }}>P&L CALENDAR <span style={{ fontSize: 11, fontWeight: 400 }}>(net after fees)</span></div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{monthName}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: monthPnl >= 0 ? "#00a040" : "#ff3366" }}>{fmtShort(monthPnl)}</span>
          <button onClick={() => setCalDate(new Date())} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Today</button>
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 12px", fontSize: 16, cursor: "pointer" }}>‹</button>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 12px", fontSize: 16, cursor: "pointer" }}>›</button>
        </div>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 120px", borderBottom: `1px solid ${BORDER}` }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} style={{ padding: "12px 0", textAlign: "center", fontSize: 12, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700 }}>{d}</div>
          ))}
          <div style={{ padding: "12px 16px", fontSize: 12, color: TEXT_LIGHT, fontWeight: 700, borderLeft: `1px solid ${BORDER}` }}>WEEK</div>
        </div>
        {weeks.map((week, wi) => {
          const weekPnl = week.reduce((s, d) => s + (d ? (dayMap[dateKey(d)] || 0) : 0), 0);
          const weekTrades = week.reduce((s, d) => s + (d ? (dayCountMap[dateKey(d)] || 0) : 0), 0);
          return (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 120px", borderBottom: wi < weeks.length - 1 ? `1px solid #f0f3fa` : "none", minHeight: 80 }}>
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
                  <div key={di} style={{ padding: "10px 12px", borderRight: di < 6 ? `1px solid #f0f3fa` : "none", background: isToday ? "rgba(0,191,255,0.05)" : isWin ? "rgba(0,192,80,0.05)" : isLoss ? "rgba(255,51,102,0.04)" : "transparent", minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "#00bfff" : "transparent", fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : TEXT_MID }}>{d}</div>
                    {hasData && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isWin ? "#00a040" : "#ff3366" }}>{fmtShort(pnl)}</div>
                        <div style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 2 }}>{count} trade{count !== 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ padding: "14px 16px", borderLeft: `1px solid ${BORDER}`, background: weekPnl > 0 ? "rgba(0,192,80,0.06)" : weekPnl < 0 ? "rgba(255,51,102,0.05)" : "#fafbfd", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                <div style={{ fontSize: 11, color: TEXT_LIGHT, fontWeight: 600 }}>Week {wi + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: weekPnl > 0 ? "#00a040" : weekPnl < 0 ? "#ff3366" : TEXT_LIGHT }}>{weekTrades > 0 ? fmtShort(weekPnl) : "$0"}</div>
                <div style={{ fontSize: 11, color: TEXT_LIGHT }}>{weekTrades} trades</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({ sessions, activeId, onSelect, onCreate, onRename, onDelete, onClose }:
  { sessions: any[]; activeId: string; onSelect: (id: string) => void; onCreate: (name: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,30,50,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: CARD, borderRadius: 20, padding: "36px 32px", width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Sessions</div>
        <div style={{ fontSize: 14, color: TEXT_LIGHT, marginBottom: 26 }}>Save and switch between named trade logs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, maxHeight: 300, overflowY: "auto" }}>
          {sessions.map((s) => (
            <div key={s.id}>
              {confirmDelete === s.id ? (
                <div style={{ padding: "14px 18px", borderRadius: 12, border: `1.5px solid #ff3366`, background: "rgba(255,51,102,0.05)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 10 }}>Delete "{s.name}"?</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { onDelete(s.id); setConfirmDelete(null); }} style={{ background: "#ff3366", border: "none", borderRadius: 8, color: "#fff", padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Yes, Delete</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, border: `1.5px solid ${s.id === activeId ? "#00bfff" : BORDER}`, background: s.id === activeId ? "rgba(0,191,255,0.05)" : "#fafbfd", cursor: "pointer" }}
                  onClick={() => { onSelect(s.id); onClose(); }}>
                  <div style={{ flex: 1 }}>
                    {renaming === s.id ? (
                      <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { onRename(s.id, renameVal); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                        autoFocus onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 15, border: "1px solid #00bfff", borderRadius: 6, padding: "5px 12px", color: TEXT, width: "100%" }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: TEXT_LIGHT, marginTop: 3 }}>{loadSessionTrades(s.id).length} trades</div>
                      </>
                    )}
                  </div>
                  {s.id === activeId && <span style={{ fontSize: 11, color: "#00bfff", fontWeight: 700, letterSpacing: 1 }}>ACTIVE</span>}
                  <button onClick={(e) => { e.stopPropagation(); setRenaming(renaming === s.id ? null : s.id); setRenameVal(s.name); }} style={{ background: "none", border: "none", color: TEXT_LIGHT, cursor: "pointer", fontSize: 15, padding: "4px 8px", borderRadius: 6 }}>✏️</button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }} style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", fontSize: 18, padding: "4px 8px", borderRadius: 6, lineHeight: 1 }}>🗑</button>
                </div>
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
              style={{ flex: 1, background: "#f4f6fb", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: "13px 18px", fontSize: 15 }} />
            <button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              style={{ background: "linear-gradient(135deg,#00bfff,#0070ff)", border: "none", borderRadius: 10, color: "#fff", padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              + CREATE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────
function CSVImportModal({ onImport, onClose }: { onImport: (trades: any[]) => void; onClose: () => void }) {
  const [preview, setPreview] = useState<any[]>([]);
  const [parsedAll, setParsedAll] = useState<any[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    setError(""); setPreview([]); setParsedAll([]);
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setError("File appears empty or invalid."); return; }
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

    const pnlIdx = headers.findIndex(h => h.includes("p&l") || h === "pnl" || h === "profit" || h === "net p&l");
    const dateIdx = headers.findIndex(h => h.includes("entry time") || h.includes("date") || h.includes("time"));
    const sizeIdx = headers.findIndex(h => h === "size" || h.includes("qty") || h.includes("quantity") || h.includes("contracts"));
    const feesIdx = headers.findIndex(h => h === "fees" || h.includes("fee") || h.includes("commission"));

    if (pnlIdx === -1) { setError("Could not find a P&L column. Expected columns like 'P&L', 'Net P&L', or 'Profit'."); return; }

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 2) continue;
      const grossPnl = parseFloat(cols[pnlIdx]?.replace(/[$,]/g, "") || "");
      if (isNaN(grossPnl)) continue;

      let tradeDate = today();
      if (dateIdx !== -1 && cols[dateIdx]) {
        const d = new Date(cols[dateIdx]);
        if (!isNaN(d.getTime())) tradeDate = d.toISOString().split("T")[0];
      }

      const contracts = sizeIdx !== -1 ? (parseInt(cols[sizeIdx]) || 1) : 1;

      // If CSV has a fees column, use it; otherwise calculate from contract count
      let csvFees = 0;
      if (feesIdx !== -1 && cols[feesIdx]) {
        csvFees = Math.abs(parseFloat(cols[feesIdx]?.replace(/[$,]/g, "") || "0"));
      } else {
        csvFees = contracts * FEE_PER_CONTRACT;
      }

      // Topstep P&L column is GROSS (fees shown separately), so net = grossPnl - fees
      const net = grossPnl - csvFees;
      const points = parseFloat((grossPnl / (OZ_PER_CONTRACT * contracts)).toFixed(2));

      parsed.push({
        id: Date.now() + i,
        date: tradeDate,
        points,
        contracts,
        dollar: grossPnl,
        fees: csvFees,
        net,
      });
    }

    if (!parsed.length) { setError("No valid trades found."); return; }
    setParsedAll(parsed);
    setPreview(parsed.slice(0, 5));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,30,50,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: CARD, borderRadius: 20, padding: "36px 32px", width: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid ${BORDER}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Import from CSV</div>
        <div style={{ fontSize: 14, color: TEXT_LIGHT, marginBottom: 8 }}>Supports Topstep CSV exports. Fees of <strong>${FEE_PER_CONTRACT}/contract</strong> are automatically deducted.</div>
        <div style={{ fontSize: 12, color: TEXT_LIGHT, marginBottom: 24, background: "#f5f7fc", padding: "10px 14px", borderRadius: 8 }}>
          Topstep: Performance tab → Trades → Export CSV
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
          style={{ display: "block", marginBottom: 16, fontSize: 14, color: TEXT }} />
        {error && <div style={{ color: "#ff3366", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "rgba(255,51,102,0.07)", borderRadius: 8 }}>{error}</div>}
        {preview.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: TEXT_LIGHT, fontWeight: 700, marginBottom: 8 }}>PREVIEW — {parsedAll.length} trades found (showing first 5)</div>
            <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 70px 90px", padding: "8px 14px", background: "#f5f7fc", fontSize: 11, color: TEXT_LIGHT, fontWeight: 700 }}>
                <div>DATE</div><div>PTS</div><div>GROSS</div><div>FEES</div><div>NET</div>
              </div>
              {preview.map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 70px 90px", padding: "9px 14px", background: i % 2 === 0 ? CARD : "#fafbfd", fontSize: 13, gap: 8, alignItems: "center" }}>
                  <div style={{ color: TEXT_MID }}>{t.date}</div>
                  <div style={{ color: GOLD, fontWeight: 600 }}>{t.points > 0 ? "+" : ""}{t.points}</div>
                  <div style={{ color: t.dollar >= 0 ? "#00a040" : "#ff3366", fontWeight: 600 }}>{fmt(t.dollar)}</div>
                  <div style={{ color: "#ff6633" }}>-{fmt(t.fees)}</div>
                  <div style={{ color: t.net >= 0 ? "#00a040" : "#ff3366", fontWeight: 700 }}>{fmt(t.net)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT_MID, padding: "12px 22px", fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { if (parsedAll.length) { onImport(parsedAll); onClose(); } }}
            disabled={parsedAll.length === 0}
            style={{ background: parsedAll.length > 0 ? "linear-gradient(135deg,#00bfff,#0070ff)" : BORDER, border: "none", borderRadius: 10, color: parsedAll.length > 0 ? "#fff" : TEXT_LIGHT, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: parsedAll.length > 0 ? "pointer" : "default" }}>
            Import {parsedAll.length > 0 ? `${parsedAll.length} Trades` : ""}
          </button>
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"points"|"date"|null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editDate, setEditDate] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingEquity, setStartingEquity] = useState(50000);
  const [targetEquity, setTargetEquity] = useState(53000);
  const [editingEquity, setEditingEquity] = useState(false);
  const [tempStart, setTempStart] = useState("50000");
  const [tempTarget, setTempTarget] = useState("53000");

  useEffect(() => {
    let sess = loadSessions();
    if (!sess.length) { const def = { id: uid(), name: "Default Session", createdAt: Date.now() }; sess = [def]; saveSessions(sess); }
    setSessions(sess);
    const lastActive = localStorage.getItem("atr-active-session") || sess[0].id;
    const validId = sess.find((s: any) => s.id === lastActive) ? lastActive : sess[0].id;
    setActiveId(validId); setTrades(loadSessionTrades(validId)); setLoading(false);
    const eq = localStorage.getItem("atr-equity-settings");
    if (eq) { try { const { start, target } = JSON.parse(eq); setStartingEquity(start); setTargetEquity(target); setTempStart(String(start)); setTempTarget(String(target)); } catch {} }
  }, []);

  const switchSession = (id: string) => { setActiveId(id); setTrades(loadSessionTrades(id)); localStorage.setItem("atr-active-session", id); setFilter("all"); };
  const createSession = (name: string) => { const s = { id: uid(), name, createdAt: Date.now() }; const u = [...sessions, s]; setSessions(u); saveSessions(u); switchSession(s.id); setShowSessions(false); showToast(`Session "${name}" created`); };
  const renameSession = (id: string, name: string) => { const u = sessions.map((s) => s.id === id ? { ...s, name } : s); setSessions(u); saveSessions(u); };
  const deleteSession = (id: string) => {
    const u = sessions.filter((s) => s.id !== id);
    if (!u.length) { showToast("Can't delete the only session", "error"); return; }
    setSessions(u); saveSessions(u); localStorage.removeItem(`atr-sess-${id}`); switchSession(u[0].id); showToast("Session deleted");
  };
  const saveTrades = useCallback((u: any[], id: string) => { saveSessionTrades(id, u); }, []);
  const showToast = (msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const saveEquitySettings = () => {
    const start = parseFloat(tempStart) || 50000;
    const target = parseFloat(tempTarget) || 53000;
    setStartingEquity(start); setTargetEquity(target);
    localStorage.setItem("atr-equity-settings", JSON.stringify({ start, target }));
    setEditingEquity(false); showToast("Equity settings saved");
  };
  const importTrades = (newTrades: any[]) => {
    const u = [...newTrades, ...trades];
    setTrades(u); saveTrades(u, activeId);
    showToast(`${newTrades.length} trades imported`);
  };

  const pointsNum = parseFloat(points);
  const contractsNum = parseInt(contracts) || 1;
  const pointsValid = !isNaN(pointsNum) && pointsNum !== 0;
  const grossDollar = pointsValid ? pointsNum * OZ_PER_CONTRACT * contractsNum : null;
  const feesAmount = contractsNum * FEE_PER_CONTRACT;
  const previewNet = grossDollar !== null ? grossDollar - feesAmount : null;
  const isWin = previewNet !== null ? previewNet > 0 : null;

  const addTrade = () => {
    if (!pointsValid) return showToast("Enter a non-zero points value", "error");
    const dollar = pointsNum * OZ_PER_CONTRACT * contractsNum;
    const fees = contractsNum * FEE_PER_CONTRACT;
    const net = dollar - fees;
    const u = [{ id: Date.now(), date, points: pointsNum, contracts: contractsNum, dollar, fees, net }, ...trades];
    setTrades(u); saveTrades(u, activeId); setPoints("");
    showToast(net > 0 ? `+${fmt(net)} logged (after fees)` : `${fmt(net)} logged (after fees)`, net > 0 ? "success" : "loss");
  };
  const deleteTrade = (id: number) => { const u = trades.filter((t) => t.id !== id); setTrades(u); saveTrades(u, activeId); showToast("Trade removed"); };
  const startEdit = (t: any, field: "points"|"date") => { setEditingId(t.id); setEditingField(field); if (field === "points") setEditPoints(String(t.points)); if (field === "date") setEditDate(t.date); };
  const cancelEdit = () => { setEditingId(null); setEditingField(null); };
  const commitEdit = (id: number) => {
    const u = trades.map((t) => {
      if (t.id !== id) return t;
      if (editingField === "points") {
        const p = parseFloat(editPoints); if (isNaN(p) || p === 0) return t;
        const dollar = p * OZ_PER_CONTRACT * t.contracts;
        const fees = t.contracts * FEE_PER_CONTRACT;
        return { ...t, points: p, dollar, fees, net: dollar - fees };
      }
      if (editingField === "date") return { ...t, date: editDate };
      return t;
    });
    setTrades(u); saveTrades(u, activeId); cancelEdit(); showToast("Trade updated");
  };

  const displayed = trades.filter((t) => filter === "wins" ? t.net > 0 : filter === "losses" ? t.net <= 0 : true);
  const stats = computeStats(trades);
  const activeSession = sessions.find((s) => s.id === activeId);

  if (loading) return <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_LIGHT, fontSize: 16 }}>Loading...</div>;

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      {showSessions && <SessionModal sessions={sessions} activeId={activeId} onSelect={switchSession} onCreate={createSession} onRename={renameSession} onDelete={deleteSession} onClose={() => setShowSessions(false)} />}
      {showCSV && <CSVImportModal onImport={importTrades} onClose={() => setShowCSV(false)} />}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 1001, background: CARD, border: `2px solid ${toast.type === "error" ? "#ff3366" : toast.type === "loss" ? "#ff6633" : "#00cc60"}`, borderRadius: 12, padding: "14px 24px", color: toast.type === "error" ? "#ff3366" : toast.type === "loss" ? "#ff6633" : "#00a040", fontSize: 15, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", animation: "slideIn .2s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "20px 36px", display: "flex", alignItems: "center", gap: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT_MID, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Back</button>
        <div style={{ width: 1, height: 28, background: BORDER }} />
        <div onClick={onBack} style={{ fontWeight: 800, fontSize: 22, color: TEXT, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          📈 ATR <span style={{ color: "#00bfff" }}>Trailing Stop</span>
        </div>
        <div style={{ fontSize: 13, color: TEXT_LIGHT, letterSpacing: 1 }}>· 7MIN · /MGC · $10/PT/CTR</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {stats && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, color: stats.totalNet >= 0 ? "#00a040" : "#ff3366", fontWeight: 700 }}>{fmt(stats.totalNet)}</div>
              <div style={{ fontSize: 10, color: TEXT_LIGHT }}>net after fees</div>
            </div>
          )}
          <button onClick={() => setShowCSV(true)} style={{ background: "#f0f6ff", border: `1px solid #c0d8ff`, borderRadius: 10, color: "#0070ff", padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            ⬆ Import CSV
          </button>
          <button onClick={() => setShowSessions(true)} style={{ background: GOLD_BG, border: `1.5px solid ${GOLD}`, borderRadius: 10, color: GOLD, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
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
                style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: "13px 16px", fontSize: 15, width: "100%" }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>POINTS <span style={{ color: GOLD }}>◆</span></div>
              <div style={{ display: "flex", alignItems: "center", background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                <span style={{ padding: "0 16px", color: GOLD, fontSize: 15, fontWeight: 700 }}>PT</span>
                <input type="number" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrade()} placeholder="+ win  /  − loss"
                  style={{ background: "transparent", border: "none", color: TEXT, padding: "13px 16px 13px 0", fontSize: 16, width: "100%", fontWeight: 600 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>RESULT</div>
              <div style={{ padding: "13px 26px", borderRadius: 10, fontSize: 15, fontWeight: 800, letterSpacing: 1, minWidth: 120, textAlign: "center", background: isWin === null ? "#f5f7fc" : isWin ? "rgba(0,192,80,0.1)" : "rgba(255,51,102,0.09)", color: isWin === null ? TEXT_LIGHT : isWin ? "#00a040" : "#ff3366", border: `2px solid ${isWin === null ? BORDER : isWin ? "#00c060" : "#ff3366"}`, transition: "all 0.2s" }}>
                {isWin === null ? "— —" : isWin ? "✓ WIN" : "✕ LOSS"}
              </div>
            </div>
            <div style={{ minWidth: 120 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>/MGC CTRS</div>
              <input type="number" min="1" value={contracts} onChange={(e) => setContracts(e.target.value)}
                style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, padding: "13px 16px", fontSize: 15, width: "100%", textAlign: "center" }} />
            </div>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 10, fontWeight: 600 }}>NET P&L <span style={{ fontSize: 11, color: TEXT_LIGHT, fontWeight: 400 }}>(after fees)</span></div>
              <div style={{ padding: "13px 18px", background: "#f5f7fc", border: `2px solid ${previewNet !== null ? (previewNet > 0 ? "#00c060" : "#ff3366") : BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 700, textAlign: "right", color: previewNet !== null ? (previewNet > 0 ? "#00a040" : "#ff3366") : TEXT_LIGHT, transition: "all 0.2s" }}>
                {previewNet !== null ? fmt(previewNet) : "$—"}
              </div>
              {previewNet !== null && <div style={{ fontSize: 10, color: TEXT_LIGHT, marginTop: 5, textAlign: "center" }}>gross {fmt(grossDollar!)} − fees {fmt(feesAmount)}</div>}
            </div>
            <button onClick={addTrade} className="log-btn"
              style={{ background: "linear-gradient(135deg,#00bfff,#0070ff)", border: "none", borderRadius: 10, color: "#fff", padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,128,255,0.26)", whiteSpace: "nowrap", transition: "all .15s" }}>
              LOG TRADE
            </button>
          </div>
        </div>

        {/* ② TRADE TABLE */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {[{ key: "all", label: "ALL", color: "#00bfff" }, { key: "wins", label: "✓ WINS", color: "#00c060" }, { key: "losses", label: "✕ LOSSES", color: "#ff3366" }].map((f) => (
              <div key={f.key} onClick={() => setFilter(f.key)} className="pill"
                style={{ padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: filter === f.key ? f.color : CARD, color: filter === f.key ? "#fff" : TEXT_MID, border: `1px solid ${filter === f.key ? "transparent" : BORDER}`, boxShadow: filter === f.key ? `0 2px 10px ${f.color}55` : "none" }}>
                {f.label}
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 13, color: TEXT_LIGHT }}>{displayed.length} trades · {activeSession?.name}</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 14px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 140px 1fr 70px 110px 90px 80px 70px 40px", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, background: "#f5f7fc" }}>
              {["#","DATE","POINTS","CTRS","GROSS","FEES","NET","WIN/L",""].map((h) => (
                <div key={h} style={{ fontSize: 11, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {displayed.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: TEXT_LIGHT, fontSize: 15 }}>No trades yet — log one above ↑</div>
            )}
            {displayed.map((t, i) => {
              const win = (t.net ?? t.dollar) > 0;
              const fees = t.fees ?? (t.contracts * FEE_PER_CONTRACT);
              const net = t.net ?? (t.dollar - fees);
              const isEditPts = editingId === t.id && editingField === "points";
              const isEditDate = editingId === t.id && editingField === "date";
              return (
                <div key={t.id} className="trade-row" style={{ display: "grid", gridTemplateColumns: "40px 140px 1fr 70px 110px 90px 80px 70px 40px", padding: "13px 20px", borderBottom: `1px solid #f0f3fa`, alignItems: "center", background: i % 2 === 0 ? CARD : "#fafbfd", transition: "background 0.1s" }}>
                  <div style={{ color: TEXT_LIGHT, fontSize: 12 }}>{displayed.length - i}</div>
                  <div>
                    {isEditDate ? (
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(t.id); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ background: "#f5f7fc", border: "1px solid #00bfff", borderRadius: 6, color: TEXT, padding: "5px 10px", fontSize: 12 }} />
                    ) : (
                      <span onDoubleClick={() => startEdit(t, "date")} title="Double-click to edit"
                        style={{ color: TEXT_MID, fontSize: 13, cursor: "text", borderBottom: `1px dashed ${BORDER}`, paddingBottom: 1 }}>{t.date}</span>
                    )}
                  </div>
                  <div>
                    {isEditPts ? (
                      <input type="number" step="0.5" value={editPoints} onChange={(e) => setEditPoints(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(t.id); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ background: "#f5f7fc", border: "1px solid #00bfff", borderRadius: 6, color: TEXT, padding: "5px 12px", fontSize: 14, width: 90 }} />
                    ) : (
                      <span onDoubleClick={() => startEdit(t, "points")} title="Double-click to edit"
                        style={{ color: GOLD, fontSize: 15, fontWeight: 700, cursor: "text", borderBottom: `1px dashed ${BORDER}`, paddingBottom: 1 }}>
                        {t.points > 0 ? "+" : ""}{t.points} <span style={{ fontSize: 11, color: TEXT_LIGHT, fontWeight: 400 }}>pts</span>
                      </span>
                    )}
                  </div>
                  <div style={{ color: TEXT_MID, fontSize: 13 }}>{t.contracts}x</div>
                  <div style={{ color: t.dollar >= 0 ? "#3a8c5a" : "#cc2244", fontSize: 13, fontWeight: 600 }}>{fmt(t.dollar)}</div>
                  <div style={{ color: "#ff6633", fontSize: 12 }}>-{fmt(fees)}</div>
                  <div style={{ color: win ? "#00a040" : "#ff3366", fontSize: 14, fontWeight: 700 }}>{fmt(net)}</div>
                  <div><span style={{ background: win ? "rgba(0,192,80,0.1)" : "rgba(255,51,102,0.08)", color: win ? "#00a040" : "#ff3366", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{win ? "WIN" : "LOSS"}</span></div>
                  <div><button className="btn-del" onClick={() => deleteTrade(t.id)} style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1, opacity: 0, transition: "opacity 0.15s" }}>×</button></div>
                </div>
              );
            })}
            {displayed.length > 0 && (
              <div style={{ padding: "10px 24px", background: "#f8f9fd", borderTop: `1px solid ${BORDER}`, fontSize: 11, color: TEXT_LIGHT, textAlign: "center" }}>
                Double-click DATE or POINTS to edit · NET = Gross − ${FEE_PER_CONTRACT}/contract fees
              </div>
            )}
          </div>
        </div>

        {/* ③ STATS */}
        {stats && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 12 }}>
              {[
                { label: "WIN RATE", value: `${stats.winPct}%`, sub: `${stats.wins}W / ${stats.losses}L`, color: parseFloat(stats.winPct) >= 50 ? "#00b050" : "#ff3366" },
                { label: "NET P&L", value: fmt(stats.totalNet), sub: "after all fees", color: stats.totalNet >= 0 ? "#00bfff" : "#ff3366" },
                { label: "TOTAL FEES", value: fmt(stats.totalFees), sub: `$${FEE_PER_CONTRACT}/contract`, color: "#ff6633" },
                { label: "AVG NET/TRADE", value: fmt(stats.avgNet), sub: "after fees", color: stats.avgNet >= 0 ? "#00a040" : "#ff3366" },
                { label: "BEST TRADE", value: fmt(stats.largestWin), sub: "net", color: "#00b050" },
                { label: "WORST TRADE", value: fmt(stats.largestLoss), sub: "net", color: "#ff3366" },
                { label: "WIN STREAK", value: String(stats.longestWin), sub: "consecutive", color: GOLD },
                { label: "TOTAL TRADES", value: String(stats.total), sub: `avg ${stats.perDay}/day`, color: "#00bfff" },
              ].map((s) => (
                <div key={s.label} className="stat-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, color: TEXT_LIGHT, marginBottom: 10, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 7 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ④ P&L CALENDAR */}
        <CalendarView trades={trades} />

        {/* ⑤ EQUITY CURVE */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 14px rgba(0,0,0,0.04)", marginBottom: 28 }}>
          <div style={{ padding: "20px 28px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 20, background: "#f8f9fd", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, letterSpacing: 1, color: TEXT_LIGHT, fontWeight: 700 }}>EQUITY CURVE <span style={{ fontSize: 11, fontWeight: 400 }}>(net after fees)</span></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {editingEquity ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: TEXT_LIGHT, fontWeight: 600 }}>Starting $</span>
                    <input type="number" value={tempStart} onChange={e => setTempStart(e.target.value)} style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "6px 12px", fontSize: 14, width: 110 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: TEXT_LIGHT, fontWeight: 600 }}>Target $</span>
                    <input type="number" value={tempTarget} onChange={e => setTempTarget(e.target.value)} style={{ background: "#f5f7fc", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "6px 12px", fontSize: 14, width: 110 }} />
                  </div>
                  <button onClick={saveEquitySettings} style={{ background: "#00bfff", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save</button>
                  <button onClick={() => setEditingEquity(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: TEXT_LIGHT }}>Starting</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{fmtShort(startingEquity)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 18, height: 0, borderTop: "2px dashed #ff9500" }} />
                    <span style={{ fontSize: 12, color: "#ff9500", fontWeight: 600 }}>Target {fmtShort(targetEquity)}</span>
                  </div>
                  {(() => {
                    const cur = startingEquity + trades.reduce((s,t) => s + (t.net ?? t.dollar), 0);
                    const pnl = cur - startingEquity;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: TEXT_LIGHT }}>Current</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: pnl >= 0 ? "#00a040" : "#ff3366" }}>{fmtShort(cur)} ({pnl >= 0 ? "+" : ""}{fmtShort(pnl)})</span>
                      </div>
                    );
                  })()}
                  {startingEquity + trades.reduce((s,t) => s + (t.net ?? t.dollar), 0) >= targetEquity && (
                    <span style={{ background: "#00a04020", color: "#00a040", padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>✓ TARGET REACHED</span>
                  )}
                  <button onClick={() => setEditingEquity(true)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MID, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>✏️ Edit</button>
                </>
              )}
            </div>
          </div>
          <div style={{ padding: "16px 24px 20px" }}>
            {trades.length === 0 ? (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_LIGHT, fontSize: 14 }}>Log trades to see your equity curve</div>
            ) : (() => {
              const W = 900, H = 260, PAD = 68;
              const sorted = [...trades].reverse();
              const pts: number[] = [startingEquity];
              sorted.forEach((t) => pts.push(pts[pts.length - 1] + (t.net ?? t.dollar)));
              const minVal = Math.min(...pts, targetEquity) * 0.998;
              const maxVal = Math.max(...pts, targetEquity) * 1.002;
              const range = maxVal - minVal || 1;
              const toX = (i: number) => PAD + (i / Math.max(pts.length - 1, 1)) * (W - PAD * 2);
              const toY = (v: number) => PAD + (1 - (v - minVal) / range) * (H - PAD * 2);
              const pathD = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
              const areaD = pathD + ` L ${toX(pts.length-1).toFixed(1)} ${toY(minVal).toFixed(1)} L ${toX(0).toFixed(1)} ${toY(minVal).toFixed(1)} Z`;
              const targetY = toY(targetEquity);
              const pnl = pts[pts.length-1] - startingEquity;
              const yLabels = Array.from({ length: 5 }, (_, i) => minVal + (range * i) / 4);
              return (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pnl >= 0 ? "#00c060" : "#ff3366"} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={pnl >= 0 ? "#00c060" : "#ff3366"} stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {yLabels.map((v, i) => (
                    <g key={i}>
                      <line x1={PAD} y1={toY(v)} x2={W-PAD} y2={toY(v)} stroke="#eee" strokeWidth="1" />
                      <text x={PAD-8} y={toY(v)+4} textAnchor="end" fontSize="11" fill={TEXT_LIGHT}>{fmtShort(v)}</text>
                    </g>
                  ))}
                  <path d={areaD} fill="url(#eqGrad)" />
                  <line x1={PAD} y1={targetY} x2={W-PAD} y2={targetY} stroke="#ff9500" strokeWidth="1.5" strokeDasharray="6 4" />
                  <text x={W-PAD+6} y={targetY+4} fontSize="11" fill="#ff9500" fontWeight="600">Target</text>
                  <path d={pathD} fill="none" stroke={pnl >= 0 ? "#00c060" : "#ff3366"} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((v, i) => (
                    <circle key={i} cx={toX(i)} cy={toY(v)} r={i === 0 || i === pts.length-1 ? 5 : 3.5} fill={i === 0 ? TEXT_LIGHT : (v >= pts[i-1] ? "#00c060" : "#ff3366")} stroke={CARD} strokeWidth="2" />
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 28, fontSize: 12, color: TEXT_LIGHT }}>
          /MGC = $10/pt/contract · Fees = ${FEE_PER_CONTRACT}/contract/trade · All P&L shown net after fees
        </div>
      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
const STRATEGIES = [
  { id: "atr-trailing", name: "ATR Trailing Stop", tag: "7MIN · /MGC", description: "ATR trailing stop strategy. Log points manually — positive = win, negative = loss. Auto-calculates P&L net of $1.24/contract fees.", color: "#00bfff", icon: "📈" },
  { id: "cs1", name: "EMA Crossover", tag: "COMING SOON", description: "5 EMA / 20 EMA crossover strategy tracker.", color: "#aa66ff", icon: "🔀", locked: true },
  { id: "cs2", name: "Support & Resistance", tag: "COMING SOON", description: "Key level bounce and break strategy. Track entries off major S/R zones with defined risk.", color: "#ff6633", icon: "⚡", locked: true },
];

function HomePage({ onSelect, tradeCounts }: { onSelect: (id: string) => void; tradeCounts: Record<string, number> }) {
  return (
    <div style={{ minHeight: "100vh", background: BG }}>
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "24px 40px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: TEXT }}>ATR <span style={{ color: "#00bfff" }}>TRADE</span> BACKTESTER</div>
        <div style={{ fontSize: 13, color: TEXT_LIGHT, letterSpacing: 2 }}>· STRATEGY DASHBOARD</div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px" }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: TEXT, marginBottom: 10 }}>My Strategies</div>
          <div style={{ fontSize: 16, color: TEXT_MID }}>Select a strategy to log and analyze your backtesting trades.</div>
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
                  <span style={{ fontSize: 12, letterSpacing: 1, color: s.locked ? TEXT_LIGHT : s.color, fontWeight: 700, background: s.locked ? "#f0f2f8" : `${s.color}16`, padding: "5px 14px", borderRadius: 20 }}>{s.tag}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 12 }}>{s.name}</div>
                <div style={{ fontSize: 14, color: TEXT_MID, lineHeight: 1.7, marginBottom: 24 }}>{s.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: TEXT_LIGHT }}>{s.locked ? "—" : <><span style={{ color: TEXT, fontWeight: 700 }}>{count}</span> trades logged</>}</div>
                  {!s.locked && <div style={{ fontSize: 14, color: s.color, fontWeight: 700 }}>OPEN →</div>}
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
      {page === null && <HomePage onSelect={setPage} tradeCounts={tradeCounts} />}
      {page === "atr-trailing" && <ATRTracker onBack={() => setPage(null)} />}
    </>
  );
}
