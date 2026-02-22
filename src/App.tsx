import { useState, useEffect, useCallback, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const OZ = 10;
const FEE = 1.24;

// ── Theme ─────────────────────────────────────────────────────────────────────
type Theme = typeof LIGHT;
const LIGHT = {
  bg:        "#edf0f7",
  card:      "#ffffff",
  cardAlt:   "#f7f9fc",
  border:    "#dce3f0",
  text:      "#111827",
  mid:       "#4b5a6e",
  light:     "#7a8fa8",
  gold:      "#c47f10",
  goldBg:    "rgba(196,127,16,0.1)",
  cyan:      "#0090cc",
  cyanGlow:  "rgba(0,144,204,0.15)",
  green:     "#00904a",
  red:       "#d63048",
  shadow:    "0 2px 16px rgba(0,0,0,0.07)",
  shadowLg:  "0 8px 40px rgba(0,0,0,0.12)",
  mono:      "'JetBrains Mono', monospace",
  inputBg:   "#f2f5fb",
  headerBg:  "#ffffff",
  pill:      "#e8edf7",
  toggleBg:  "#e2e8f4",
  chip:      "rgba(0,144,204,0.08)",
};
const DARK = {
  bg:        "#060b14",
  card:      "#0d1524",
  cardAlt:   "#0a1020",
  border:    "#1b2d47",
  text:      "#e2ebf8",
  mid:       "#7a9bbf",
  light:     "#4a6a8a",
  gold:      "#f0a830",
  goldBg:    "rgba(240,168,48,0.1)",
  cyan:      "#00d4ff",
  cyanGlow:  "rgba(0,212,255,0.18)",
  green:     "#00e676",
  red:       "#ff4466",
  shadow:    "0 2px 20px rgba(0,0,0,0.4)",
  shadowLg:  "0 8px 60px rgba(0,0,0,0.6)",
  mono:      "'JetBrains Mono', monospace",
  inputBg:   "#0a1830",
  headerBg:  "#080f1c",
  pill:      "#0f1e34",
  toggleBg:  "#0f1e34",
  chip:      "rgba(0,212,255,0.08)",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const fmtS = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().split("T")[0];
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const calcNet = (dollar: number, contracts: number) => dollar - contracts * FEE;

function loadSessions(): any[] { try { return JSON.parse(localStorage.getItem("atr-sessions-v2") || "[]"); } catch { return []; } }
function saveSessions(s: any[]) { try { localStorage.setItem("atr-sessions-v2", JSON.stringify(s)); } catch {} }
function loadSessionTrades(id: string): any[] { try { return JSON.parse(localStorage.getItem(`atr-sess-${id}`) || "[]"); } catch { return []; } }
function saveSessionTrades(id: string, t: any[]) { try { localStorage.setItem(`atr-sess-${id}`, JSON.stringify(t)); } catch {} }

function computeStats(trades: any[]) {
  if (!trades.length) return null;
  const wins = trades.filter(t => t.net > 0);
  const losses = trades.filter(t => t.net <= 0);
  const totalNet = trades.reduce((s, t) => s + t.net, 0);
  const totalFees = trades.reduce((s, t) => s + (t.fees || 0), 0);
  let lW = 0, lL = 0, cW = 0, cL = 0;
  for (const t of trades) { if (t.net > 0) { cW++; cL = 0; lW = Math.max(lW, cW); } else { cL++; cW = 0; lL = Math.max(lL, cL); } }
  const days = new Set(trades.map(t => t.date)).size;
  return {
    total: trades.length, wins: wins.length, losses: losses.length,
    winPct: ((wins.length / trades.length) * 100).toFixed(1),
    totalNet, totalFees, avgNet: totalNet / trades.length,
    longestWin: lW, longestLoss: lL,
    largestWin: wins.length ? Math.max(...wins.map(t => t.net)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map(t => t.net)) : 0,
    perDay: days ? (trades.length / days).toFixed(1) : "0",
  };
}

// ── Equity Curve ──────────────────────────────────────────────────────────────
function EquityCurve({ trades, startEq, targetEq, T }: { trades: any[]; startEq: number; targetEq: number; T: Theme }) {
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathLen, setPathLen] = useState(9999);
  const [animated, setAnimated] = useState(false);

  const W = 900, H = 260, PAD = 72;
  const sorted = [...trades].reverse();
  const pts: number[] = [startEq];
  sorted.forEach(t => pts.push(pts[pts.length - 1] + (t.net ?? t.dollar)));

  const minVal = Math.min(...pts, targetEq) * 0.997;
  const maxVal = Math.max(...pts, targetEq) * 1.003;
  const range = maxVal - minVal || 1;
  const toX = (i: number) => PAD + (i / Math.max(pts.length - 1, 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - (v - minVal) / range) * (H - PAD * 2);

  const pathD = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  const areaD = pathD + ` L ${toX(pts.length - 1).toFixed(1)} ${toY(minVal).toFixed(1)} L ${toX(0).toFixed(1)} ${toY(minVal).toFixed(1)} Z`;
  const targetY = toY(targetEq);
  const pnl = pts[pts.length - 1] - startEq;

  useEffect(() => {
    if (pathRef.current && trades.length) {
      const len = pathRef.current.getTotalLength();
      setPathLen(len);
      // small delay then trigger animation
      setTimeout(() => setAnimated(true), 80);
    }
  }, [trades.length]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || pts.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const fraction = Math.max(0, Math.min(1, (mx - PAD) / (W - PAD * 2)));
    const idx = Math.round(fraction * (pts.length - 1));
    setHover({ x: toX(idx), idx });
  };

  const yLabels = Array.from({ length: 5 }, (_, i) => minVal + (range * i) / 4);
  const hoverVal = hover ? pts[hover.idx] : null;
  const hoverLabel = hover && hoverVal !== undefined
    ? (hover.idx === 0 ? "Start" : `Trade ${hover.idx}`)
    : null;

  const lineColor = pnl >= 0 ? T.green : T.red;
  const glowColor = pnl >= 0 ? "rgba(0,230,118,0.25)" : "rgba(255,68,102,0.25)";

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", cursor: pts.length > 1 ? "crosshair" : "default" }}
      onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
          <stop offset="85%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
        <filter id="lineGlow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="dotGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Grid */}
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={PAD} y1={toY(v)} x2={W - PAD} y2={toY(v)} stroke={T.border} strokeWidth="1" strokeDasharray={i > 0 ? "4 4" : "none"} opacity="0.7" />
          <text x={PAD - 10} y={toY(v) + 4} textAnchor="end" fontSize="11" fill={T.light} fontFamily={T.mono}>{fmtS(v)}</text>
        </g>
      ))}

      {/* Target line */}
      <line x1={PAD} y1={targetY} x2={W - PAD} y2={targetY} stroke={T.gold} strokeWidth="1.5" strokeDasharray="7 5" opacity="0.9" />
      <text x={W - PAD + 8} y={targetY + 4} fontSize="11" fill={T.gold} fontWeight="700" fontFamily={T.mono}>Target</text>

      {trades.length > 0 && (
        <>
          {/* Area fill */}
          <path d={areaD} fill="url(#areaGrad)" />

          {/* Glow duplicate path (thicker, blurred) */}
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="6" opacity="0.2" strokeLinejoin="round" strokeLinecap="round" filter="url(#lineGlow)" />

          {/* Animated main line */}
          <path
            ref={pathRef}
            className="eq-path"
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ "--path-len": `${pathLen}` } as any}
          />

          {/* Dots */}
          {pts.map((v, i) => {
            const isLast = i === pts.length - 1;
            const isFirst = i === 0;
            const up = i === 0 || v >= pts[i - 1];
            const dotColor = isFirst ? T.light : up ? T.green : T.red;
            const r = isLast ? 6 : isFirst ? 4 : 3;
            return (
              <g key={i} filter={isLast ? "url(#dotGlow)" : undefined}>
                <circle cx={toX(i)} cy={toY(v)} r={r + 2} fill={dotColor} opacity="0.22" />
                <circle cx={toX(i)} cy={toY(v)} r={r} fill={dotColor} stroke={T.card} strokeWidth="2" />
              </g>
            );
          })}

          {/* Hover vertical line + tooltip */}
          {hover && hoverVal !== undefined && (
            <>
              <line x1={hover.x} y1={PAD - 8} x2={hover.x} y2={H - PAD + 8}
                stroke={T.cyan} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
              <circle cx={hover.x} cy={toY(hoverVal)} r="7" fill={T.cyan} stroke={T.card} strokeWidth="2.5" filter="url(#dotGlow)" />
              {/* Tooltip bubble */}
              {(() => {
                const tx = Math.min(Math.max(hover.x - 70, 4), W - 148);
                const ty = Math.max(toY(hoverVal) - 58, 4);
                const tradeIdx = hover.idx;
                const tradeNet = tradeIdx > 0 ? (pts[tradeIdx] - pts[tradeIdx - 1]) : 0;
                return (
                  <g>
                    <rect x={tx} y={ty} width="140" height="46" rx="8" fill={T.card} stroke={T.cyan} strokeWidth="1.2" opacity="0.96"
                      style={{ filter: `drop-shadow(0 4px 14px ${T.cyanGlow})` }} />
                    <text x={tx + 10} y={ty + 16} fontSize="10" fill={T.light} fontFamily={T.mono}>{hoverLabel}</text>
                    <text x={tx + 10} y={ty + 32} fontSize="13" fontWeight="700" fill={hoverVal >= startEq ? T.green : T.red} fontFamily={T.mono}>{fmtS(hoverVal)}</text>
                    {tradeIdx > 0 && (
                      <text x={tx + 80} y={ty + 32} fontSize="11" fontWeight="600" fill={tradeNet >= 0 ? T.green : T.red} fontFamily={T.mono}>
                        {tradeNet >= 0 ? "+" : ""}{fmtS(tradeNet)}
                      </text>
                    )}
                  </g>
                );
              })()}
            </>
          )}
        </>
      )}

      {trades.length === 0 && (
        <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize="14" fill={T.light} fontFamily="'Outfit', sans-serif">Log trades to see your equity curve</text>
      )}
    </svg>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function CalendarView({ trades, T }: { trades: any[]; T: Theme }) {
  const [calDate, setCalDate] = useState(new Date());
  const year = calDate.getFullYear(); const month = calDate.getMonth();
  const monthName = calDate.toLocaleString("default", { month: "long", year: "numeric" });
  const dayMap: Record<string, number> = {};
  const dayCount: Record<string, number> = {};
  trades.forEach(t => {
    const d = new Date(t.date + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      dayMap[t.date] = (dayMap[t.date] || 0) + t.net;
      dayCount[t.date] = (dayCount[t.date] || 0) + 1;
    }
  });
  const monthPnl = Object.values(dayMap).reduce((s, v) => s + v, 0);
  const first = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  const dk = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const todayStr = today();

  const btnStyle = { background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.mid, padding: "7px 12px", fontSize: 15, cursor: "pointer" };
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow, marginBottom: 24 }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14, background: T.cardAlt, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: T.light, fontWeight: 700 }}>P&L CALENDAR <span style={{ fontSize: 10, fontWeight: 400 }}>(net)</span></div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{monthName}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: monthPnl >= 0 ? T.green : T.red, fontFamily: T.mono }}>{fmtS(monthPnl)}</span>
          <button onClick={() => setCalDate(new Date())} style={{ ...btnStyle, fontSize: 13, padding: "7px 14px", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>Today</button>
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} style={btnStyle}>‹</button>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} style={btnStyle}>›</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr) 110px", borderBottom: `1px solid ${T.border}` }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: 11, letterSpacing: 1, color: T.light, fontWeight: 700 }}>{d}</div>
        ))}
        <div style={{ padding: "10px 14px", fontSize: 11, color: T.light, fontWeight: 700, borderLeft: `1px solid ${T.border}` }}>WEEK</div>
      </div>
      {weeks.map((week, wi) => {
        const wPnl = week.reduce((s, d) => s + (d ? (dayMap[dk(d)] || 0) : 0), 0);
        const wT = week.reduce((s, d) => s + (d ? (dayCount[dk(d)] || 0) : 0), 0);
        return (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr) 110px", borderBottom: wi < weeks.length - 1 ? `1px solid ${T.border}` : "none", minHeight: 76 }}>
            {week.map((d, di) => {
              if (!d) return <div key={di} style={{ background: T.cardAlt, borderRight: di < 6 ? `1px solid ${T.border}` : "none", opacity: 0.4 }} />;
              const k = dk(d); const pnl = dayMap[k]; const cnt = dayCount[k] || 0;
              const isToday = k === todayStr; const has = pnl !== undefined;
              const win = has && pnl > 0; const loss = has && pnl < 0;
              return (
                <div key={di} style={{ padding: "8px 10px", borderRight: di < 6 ? `1px solid ${T.border}` : "none", background: isToday ? T.chip : win ? `${T.green}11` : loss ? `${T.red}0e` : "transparent", minHeight: 76, display: "flex", flexDirection: "column", justifyContent: "space-between", transition: "background 0.2s" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? T.cyan : "transparent", fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : T.mid }}>{d}</div>
                  {has && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: win ? T.green : T.red, fontFamily: T.mono }}>{fmtS(pnl)}</div>
                      <div style={{ fontSize: 10, color: T.light, marginTop: 2 }}>{cnt}t</div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ padding: "12px 14px", borderLeft: `1px solid ${T.border}`, background: wPnl > 0 ? `${T.green}0d` : wPnl < 0 ? `${T.red}0d` : T.cardAlt, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: T.light, fontWeight: 600 }}>Wk {wi + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: wPnl > 0 ? T.green : wPnl < 0 ? T.red : T.light, fontFamily: T.mono }}>{wT > 0 ? fmtS(wPnl) : "$0"}</div>
              <div style={{ fontSize: 10, color: T.light }}>{wT}t</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({ sessions, activeId, onSelect, onCreate, onRename, onDelete, onClose, T }:
  { sessions: any[]; activeId: string; onSelect: (id: string) => void; onCreate: (name: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onClose: () => void; T: Theme }) {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const inp = (extra?: any) => ({ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, padding: "12px 16px", fontSize: 15, fontFamily: "'Outfit', sans-serif", ...extra });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: "34px 30px", width: 480, boxShadow: T.shadowLg, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 6 }}>Sessions</div>
        <div style={{ fontSize: 14, color: T.light, marginBottom: 24 }}>Switch between named trade logs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22, maxHeight: 280, overflowY: "auto" }}>
          {sessions.map(s => (
            <div key={s.id}>
              {confirmDel === s.id ? (
                <div style={{ padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${T.red}`, background: `${T.red}0d` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>Delete "{s.name}"?</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { onDelete(s.id); setConfirmDel(null); }} style={{ background: T.red, border: "none", borderRadius: 8, color: "#fff", padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Delete</button>
                    <button onClick={() => setConfirmDel(null)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.mid, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${s.id === activeId ? T.cyan : T.border}`, background: s.id === activeId ? T.chip : T.cardAlt, cursor: "pointer" }}
                  onClick={() => { onSelect(s.id); onClose(); }}>
                  <div style={{ flex: 1 }}>
                    {renaming === s.id ? (
                      <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { onRename(s.id, renameVal); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                        autoFocus onClick={e => e.stopPropagation()}
                        style={{ ...inp(), padding: "4px 10px", fontSize: 14, width: "100%" }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: T.light, marginTop: 2 }}>{loadSessionTrades(s.id).length} trades</div>
                      </>
                    )}
                  </div>
                  {s.id === activeId && <span style={{ fontSize: 10, color: T.cyan, fontWeight: 700, letterSpacing: 1 }}>ACTIVE</span>}
                  <button onClick={e => { e.stopPropagation(); setRenaming(renaming === s.id ? null : s.id); setRenameVal(s.name); }} style={{ background: "none", border: "none", color: T.light, cursor: "pointer", fontSize: 14, padding: "3px 6px" }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); setConfirmDel(s.id); }} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 16, padding: "3px 6px" }}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: T.light, marginBottom: 10, fontWeight: 700 }}>NEW SESSION</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              placeholder='e.g. "Week of Feb 17"'
              style={{ ...inp(), flex: 1 }} />
            <button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
              style={{ background: `linear-gradient(135deg, ${T.cyan}, #0060cc)`, border: "none", borderRadius: 10, color: "#fff", padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Outfit',sans-serif" }}>
              + Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────
function CSVModal({ onImport, onClose, T }: { onImport: (t: any[]) => void; onClose: () => void; T: Theme }) {
  const [preview, setPreview] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (text: string) => {
    setError(""); setPreview([]); setAll([]);
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setError("File appears empty."); return; }
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const pnlIdx = headers.findIndex(h => h.includes("p&l") || h === "pnl" || h.includes("profit") || h.includes("net p"));
    const dateIdx = headers.findIndex(h => h.includes("entry time") || h.includes("date") || h.includes("time"));
    const sizeIdx = headers.findIndex(h => h === "size" || h.includes("qty") || h.includes("contracts"));
    const feesIdx = headers.findIndex(h => h === "fees" || h.includes("fee") || h.includes("commission"));
    if (pnlIdx === -1) { setError("Could not find a P&L column."); return; }
    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 2) continue;
      const gross = parseFloat(cols[pnlIdx]?.replace(/[$,]/g, "") || "");
      if (isNaN(gross)) continue;
      let date = today();
      if (dateIdx !== -1 && cols[dateIdx]) { const d = new Date(cols[dateIdx]); if (!isNaN(d.getTime())) date = d.toISOString().split("T")[0]; }
      const contracts = sizeIdx !== -1 ? (parseInt(cols[sizeIdx]) || 1) : 1;
      const fees = feesIdx !== -1 && cols[feesIdx] ? Math.abs(parseFloat(cols[feesIdx].replace(/[$,]/g, "")) || contracts * FEE) : contracts * FEE;
      const net = gross - fees;
      const points = parseFloat((gross / (OZ * contracts)).toFixed(2));
      parsed.push({ id: Date.now() + i, date, points, contracts, dollar: gross, fees, net });
    }
    if (!parsed.length) { setError("No valid trades found."); return; }
    setAll(parsed); setPreview(parsed.slice(0, 5));
  };

  const inp = { background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "8px 14px", fontSize: 14, fontFamily: "'Outfit',sans-serif" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: "34px 30px", width: 560, boxShadow: T.shadowLg, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 6 }}>Import from CSV</div>
        <div style={{ fontSize: 13, color: T.light, marginBottom: 8 }}>Topstep exports supported. Fees of <strong style={{ color: T.text }}>${FEE}/contract</strong> auto-deducted.</div>
        <div style={{ fontSize: 12, color: T.light, background: T.cardAlt, padding: "10px 14px", borderRadius: 8, marginBottom: 20, border: `1px solid ${T.border}` }}>
          Topstep: Performance → Trades → Export CSV
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt"
          onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => parse(ev.target?.result as string); r.readAsText(f); }}
          style={{ display: "block", marginBottom: 16, fontSize: 14, color: T.text }} />
        {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 14, padding: "10px 14px", background: `${T.red}11`, borderRadius: 8 }}>{error}</div>}
        {preview.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: T.light, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>PREVIEW — {all.length} trades</div>
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 88px 64px 88px", padding: "8px 14px", background: T.cardAlt, fontSize: 11, color: T.light, fontWeight: 700, gap: 8 }}>
                <div>DATE</div><div>PTS</div><div>GROSS</div><div>FEES</div><div>NET</div>
              </div>
              {preview.map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 88px 64px 88px", padding: "9px 14px", background: i % 2 === 0 ? T.card : T.cardAlt, fontSize: 12, gap: 8, alignItems: "center", fontFamily: T.mono }}>
                  <div style={{ color: T.mid }}>{t.date}</div>
                  <div style={{ color: T.gold }}>{t.points > 0 ? "+" : ""}{t.points}</div>
                  <div style={{ color: t.dollar >= 0 ? T.green : T.red }}>{fmt(t.dollar)}</div>
                  <div style={{ color: "#f97316" }}>-{fmt(t.fees)}</div>
                  <div style={{ color: t.net >= 0 ? T.green : T.red, fontWeight: 700 }}>{fmt(t.net)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 10, color: T.mid, padding: "12px 20px", fontSize: 14, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
          <button onClick={() => { if (all.length) { onImport(all); onClose(); } }} disabled={!all.length}
            style={{ background: all.length ? `linear-gradient(135deg, ${T.cyan}, #0060cc)` : T.border, border: "none", borderRadius: 10, color: all.length ? "#fff" : T.light, padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: all.length ? "pointer" : "default", fontFamily: "'Outfit',sans-serif" }}>
            Import {all.length > 0 ? `${all.length} Trades` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ dark, toggle, T }: { dark: boolean; toggle: () => void; T: Theme }) {
  return (
    <button onClick={toggle} className="theme-toggle"
      style={{ background: T.toggleBg, border: `1px solid ${T.border}`, borderRadius: 20, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: T.mid, transition: "all 0.2s", fontFamily: "'Outfit',sans-serif" }}>
      <span style={{ fontSize: 16 }}>{dark ? "☀️" : "🌙"}</span>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

// ── ATR Tracker ───────────────────────────────────────────────────────────────
function ATRTracker({ onBack, dark, toggleDark, T }: { onBack: () => void; dark: boolean; toggleDark: () => void; T: Theme }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState("");
  const [trades, setTrades] = useState<any[]>([]);
  const [date, setDate] = useState(today());
  const [points, setPoints] = useState("");
  const [contracts, setContracts] = useState("3");
  const [filter, setFilter] = useState("all");
  const [editId, setEditId] = useState<number | null>(null);
  const [editField, setEditField] = useState<"points"|"date"|null>(null);
  const [editPts, setEditPts] = useState("");
  const [editDt, setEditDt] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [showSess, setShowSess] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startEq, setStartEq] = useState(50000);
  const [targetEq, setTargetEq] = useState(53000);
  const [editEq, setEditEq] = useState(false);
  const [tmpStart, setTmpStart] = useState("50000");
  const [tmpTarget, setTmpTarget] = useState("53000");

  useEffect(() => {
    let sess = loadSessions();
    if (!sess.length) { const d = { id: uid(), name: "Default Session", createdAt: Date.now() }; sess = [d]; saveSessions(sess); }
    setSessions(sess);
    const la = localStorage.getItem("atr-active-session") || sess[0].id;
    const vid = sess.find((s: any) => s.id === la) ? la : sess[0].id;
    setActiveId(vid); setTrades(loadSessionTrades(vid)); setLoading(false);
    const eq = localStorage.getItem("atr-equity-settings");
    if (eq) { try { const { start, target } = JSON.parse(eq); setStartEq(start); setTargetEq(target); setTmpStart(String(start)); setTmpTarget(String(target)); } catch {} }
  }, []);

  const sw = (id: string) => { setActiveId(id); setTrades(loadSessionTrades(id)); localStorage.setItem("atr-active-session", id); setFilter("all"); };
  const cr = (name: string) => { const s = { id: uid(), name, createdAt: Date.now() }; const u = [...sessions, s]; setSessions(u); saveSessions(u); sw(s.id); setShowSess(false); showT(`Session "${name}" created`); };
  const rn = (id: string, name: string) => { const u = sessions.map(s => s.id === id ? { ...s, name } : s); setSessions(u); saveSessions(u); };
  const dl = (id: string) => { const u = sessions.filter(s => s.id !== id); if (!u.length) { showT("Can't delete only session", "error"); return; } setSessions(u); saveSessions(u); localStorage.removeItem(`atr-sess-${id}`); sw(u[0].id); showT("Session deleted"); };
  const saveT = useCallback((u: any[], id: string) => { saveSessionTrades(id, u); }, []);
  const showT = (msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const saveEq = () => { const s = parseFloat(tmpStart) || 50000; const tg = parseFloat(tmpTarget) || 53000; setStartEq(s); setTargetEq(tg); localStorage.setItem("atr-equity-settings", JSON.stringify({ start: s, target: tg })); setEditEq(false); showT("Equity settings saved"); };

  const pNum = parseFloat(points); const cNum = parseInt(contracts) || 1;
  const pValid = !isNaN(pNum) && pNum !== 0;
  const grossPrev = pValid ? pNum * OZ * cNum : null;
  const feesPrev = cNum * FEE;
  const netPrev = grossPrev !== null ? grossPrev - feesPrev : null;
  const isWin = netPrev !== null ? netPrev > 0 : null;

  const addTrade = () => {
    if (!pValid) return showT("Enter a non-zero points value", "error");
    const dollar = pNum * OZ * cNum; const fees = cNum * FEE; const net = dollar - fees;
    const u = [{ id: Date.now(), date, points: pNum, contracts: cNum, dollar, fees, net }, ...trades];
    setTrades(u); saveT(u, activeId); setPoints("");
    showT(net > 0 ? `+${fmt(net)} logged (net)` : `${fmt(net)} logged (net)`, net > 0 ? "success" : "loss");
  };
  const delTrade = (id: number) => { const u = trades.filter(t => t.id !== id); setTrades(u); saveT(u, activeId); showT("Trade removed"); };
  const startEdit = (t: any, f: "points"|"date") => { setEditId(t.id); setEditField(f); if (f === "points") setEditPts(String(t.points)); if (f === "date") setEditDt(t.date); };
  const cancelEdit = () => { setEditId(null); setEditField(null); };
  const commitEdit = (id: number) => {
    const u = trades.map(t => {
      if (t.id !== id) return t;
      if (editField === "points") { const p = parseFloat(editPts); if (isNaN(p) || p === 0) return t; const dollar = p * OZ * t.contracts; const fees = t.contracts * FEE; return { ...t, points: p, dollar, fees, net: dollar - fees }; }
      if (editField === "date") return { ...t, date: editDt };
      return t;
    });
    setTrades(u); saveT(u, activeId); cancelEdit(); showT("Updated");
  };

  const importTrades = (nt: any[]) => { const u = [...nt, ...trades]; setTrades(u); saveT(u, activeId); showT(`${nt.length} trades imported`); };
  const displayed = trades.filter(t => filter === "wins" ? t.net > 0 : filter === "losses" ? t.net <= 0 : true);
  const stats = computeStats(trades);
  const activeSess = sessions.find(s => s.id === activeId);
  const currentEq = startEq + trades.reduce((s, t) => s + (t.net ?? t.dollar), 0);
  const eqPnl = currentEq - startEq;
  const reachedTarget = currentEq >= targetEq;

  if (loading) return <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.light, fontSize: 16 }}>Loading...</div>;

  const inp = (extra?: any) => ({ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 15, ...extra });
  const borderColor = T.border;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, transition: "background 0.3s, color 0.3s" }}>
      {showSess && <SessionModal sessions={sessions} activeId={activeId} onSelect={sw} onCreate={cr} onRename={rn} onDelete={dl} onClose={() => setShowSess(false)} T={T} />}
      {showCSV && <CSVModal onImport={importTrades} onClose={() => setShowCSV(false)} T={T} />}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 1001, background: T.card, border: `2px solid ${toast.type === "error" ? T.red : toast.type === "loss" ? "#f97316" : T.green}`, borderRadius: 12, padding: "13px 22px", color: toast.type === "error" ? T.red : toast.type === "loss" ? "#f97316" : T.green, fontSize: 14, fontWeight: 700, boxShadow: T.shadowLg, animation: "slideIn .2s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${borderColor}`, padding: "18px 32px", display: "flex", alignItems: "center", gap: 16, boxShadow: T.shadow, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(10px)" }}>
        <button onClick={onBack} style={{ ...inp(), padding: "9px 18px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: `1px solid ${T.border}` }}>← Back</button>
        <div style={{ width: 1, height: 26, background: T.border }} />
        <div onClick={onBack} style={{ fontWeight: 900, fontSize: 20, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.3px" }}>
          📈 ATR <span style={{ color: T.cyan }}>Trailing Stop</span>
        </div>
        <div style={{ fontSize: 12, color: T.light, letterSpacing: 1 }}>· 7MIN · /MGC · $10/PT/CTR</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {stats && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, color: stats.totalNet >= 0 ? T.green : T.red, fontWeight: 800, fontFamily: T.mono }}>{fmt(stats.totalNet)}</div>
              <div style={{ fontSize: 10, color: T.light }}>net after fees</div>
            </div>
          )}
          <button onClick={() => setShowCSV(true)} style={{ ...inp(), padding: "9px 16px", fontWeight: 700, cursor: "pointer", border: `1px solid ${T.border}`, color: T.cyan, fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>⬆ Import CSV</button>
          <ThemeToggle dark={dark} toggle={toggleDark} T={T} />
          <button onClick={() => setShowSess(true)} style={{ background: T.goldBg, border: `1.5px solid ${T.gold}`, borderRadius: 10, color: T.gold, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
            📁 {activeSess?.name || "Session"} <span style={{ fontSize: 12, color: T.light }}>▾</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* ① LOG */}
        <div className="fade-up" style={{ background: T.card, border: `1px solid ${borderColor}`, borderRadius: 16, padding: "26px 28px", marginBottom: 22, boxShadow: T.shadow }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: T.light, marginBottom: 20, fontWeight: 700 }}>LOG NEW TRADE</div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: 12, color: T.mid, marginBottom: 8, fontWeight: 600 }}>DATE</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp(), padding: "12px 14px", width: "100%" }} />
            </div>
            <div style={{ flex: 1, minWidth: 170 }}>
              <div style={{ fontSize: 12, color: T.mid, marginBottom: 8, fontWeight: 600 }}>POINTS <span style={{ color: T.gold }}>◆</span></div>
              <div style={{ display: "flex", alignItems: "center", background: T.inputBg, border: `1px solid ${borderColor}`, borderRadius: 10, overflow: "hidden" }}>
                <span style={{ padding: "0 14px", color: T.gold, fontSize: 14, fontWeight: 700 }}>PT</span>
                <input type="number" step="0.5" value={points} onChange={e => setPoints(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTrade()} placeholder="+ win  /  − loss"
                  style={{ background: "transparent", border: "none", color: T.text, padding: "12px 14px 12px 0", fontSize: 16, width: "100%", fontWeight: 700, fontFamily: T.mono }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.mid, marginBottom: 8, fontWeight: 600 }}>RESULT</div>
              <div style={{ padding: "12px 22px", borderRadius: 10, fontSize: 14, fontWeight: 800, letterSpacing: 1, minWidth: 110, textAlign: "center", background: isWin === null ? T.inputBg : isWin ? `${T.green}18` : `${T.red}18`, color: isWin === null ? T.light : isWin ? T.green : T.red, border: `2px solid ${isWin === null ? borderColor : isWin ? T.green : T.red}`, transition: "all 0.2s", boxShadow: isWin === null ? "none" : isWin ? `0 0 18px ${T.green}33` : `0 0 18px ${T.red}33` }}>
                {isWin === null ? "— —" : isWin ? "✓ WIN" : "✕ LOSS"}
              </div>
            </div>
            <div style={{ minWidth: 110 }}>
              <div style={{ fontSize: 12, color: T.mid, marginBottom: 8, fontWeight: 600 }}>CTRS</div>
              <input type="number" min="1" value={contracts} onChange={e => setContracts(e.target.value)}
                style={{ ...inp(), padding: "12px 14px", width: "100%", textAlign: "center" }} />
            </div>
            <div style={{ minWidth: 155 }}>
              <div style={{ fontSize: 12, color: T.mid, marginBottom: 8, fontWeight: 600 }}>NET P&L <span style={{ fontSize: 10, color: T.light, fontWeight: 400 }}>(after fees)</span></div>
              <div style={{ padding: "12px 16px", background: T.inputBg, border: `2px solid ${netPrev !== null ? (netPrev > 0 ? T.green : T.red) : borderColor}`, borderRadius: 10, fontSize: 16, fontWeight: 800, textAlign: "right", color: netPrev !== null ? (netPrev > 0 ? T.green : T.red) : T.light, fontFamily: T.mono, transition: "all 0.2s", boxShadow: netPrev !== null ? `0 0 14px ${netPrev > 0 ? T.green : T.red}22` : "none" }}>
                {netPrev !== null ? fmt(netPrev) : "$—"}
              </div>
              {netPrev !== null && <div style={{ fontSize: 10, color: T.light, marginTop: 4, textAlign: "center", fontFamily: T.mono }}>gross {fmt(grossPrev!)} − {fmt(feesPrev)} fees</div>}
            </div>
            <button onClick={addTrade} className="log-btn"
              style={{ background: `linear-gradient(135deg, ${T.cyan}, #0060cc)`, border: "none", borderRadius: 10, color: "#fff", padding: "13px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Outfit',sans-serif", boxShadow: `0 4px 20px ${T.cyanGlow}`, whiteSpace: "nowrap", transition: "all .15s", letterSpacing: "0.5px" }}>
              LOG TRADE
            </button>
          </div>
        </div>

        {/* ② LOG TABLE */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            {[{ k: "all", l: "ALL", c: T.cyan }, { k: "wins", l: "✓ WINS", c: T.green }, { k: "losses", l: "✕ LOSSES", c: T.red }].map(f => (
              <div key={f.k} onClick={() => setFilter(f.k)} className="pill"
                style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", fontFamily: "'Outfit',sans-serif", background: filter === f.k ? f.c : T.pill, color: filter === f.k ? "#fff" : T.mid, boxShadow: filter === f.k ? `0 2px 12px ${f.c}44` : "none", border: `1px solid ${filter === f.k ? "transparent" : borderColor}` }}>
                {f.l}
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 12, color: T.light, fontFamily: T.mono }}>{displayed.length} trades · {activeSess?.name}</div>
          </div>
          <div style={{ background: T.card, border: `1px solid ${borderColor}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
            <div style={{ display: "grid", gridTemplateColumns: "38px 130px 1fr 65px 105px 84px 78px 68px 36px", padding: "12px 20px", borderBottom: `1px solid ${borderColor}`, background: T.cardAlt }}>
              {["#","DATE","POINTS","CTRS","GROSS","FEES","NET","",""].map((h, i) => (
                <div key={i} style={{ fontSize: 11, letterSpacing: 1, color: T.light, fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {displayed.length === 0 && <div style={{ padding: "44px 20px", textAlign: "center", color: T.light, fontSize: 14 }}>No trades yet — log one above ↑</div>}
            {displayed.map((t, i) => {
              const win = (t.net ?? t.dollar) > 0;
              const fees = t.fees ?? (t.contracts * FEE);
              const net = t.net ?? (t.dollar - fees);
              const isEP = editId === t.id && editField === "points";
              const isED = editId === t.id && editField === "date";
              return (
                <div key={t.id} className="trade-row" style={{ display: "grid", gridTemplateColumns: "38px 130px 1fr 65px 105px 84px 78px 68px 36px", padding: "13px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", background: i % 2 === 0 ? T.card : T.cardAlt, transition: "background 0.15s" }}>
                  <div style={{ color: T.light, fontSize: 12, fontFamily: T.mono }}>{displayed.length - i}</div>
                  <div>
                    {isED ? (
                      <input type="date" value={editDt} onChange={e => setEditDt(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(t.id); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ ...inp(), padding: "4px 8px", fontSize: 12, borderRadius: 6 }} />
                    ) : (
                      <span onDoubleClick={() => startEdit(t, "date")} title="Double-click to edit"
                        style={{ color: T.mid, fontSize: 13, cursor: "text", borderBottom: `1px dashed ${T.border}`, paddingBottom: 1 }}>{t.date}</span>
                    )}
                  </div>
                  <div>
                    {isEP ? (
                      <input type="number" step="0.5" value={editPts} onChange={e => setEditPts(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(t.id); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus style={{ ...inp(), padding: "4px 10px", fontSize: 14, width: 90, borderRadius: 6, fontFamily: T.mono }} />
                    ) : (
                      <span onDoubleClick={() => startEdit(t, "points")} title="Double-click to edit"
                        style={{ color: T.gold, fontSize: 15, fontWeight: 700, cursor: "text", borderBottom: `1px dashed ${T.border}`, paddingBottom: 1, fontFamily: T.mono }}>
                        {t.points > 0 ? "+" : ""}{t.points} <span style={{ fontSize: 11, color: T.light, fontWeight: 400 }}>pts</span>
                      </span>
                    )}
                  </div>
                  <div style={{ color: T.mid, fontSize: 13, fontFamily: T.mono }}>{t.contracts}x</div>
                  <div style={{ color: t.dollar >= 0 ? "#3d9e6a" : T.red, fontSize: 13, fontFamily: T.mono }}>{fmt(t.dollar)}</div>
                  <div style={{ color: "#f97316", fontSize: 12, fontFamily: T.mono }}>-{fmt(fees)}</div>
                  <div style={{ color: win ? T.green : T.red, fontSize: 14, fontWeight: 800, fontFamily: T.mono }}>{fmt(net)}</div>
                  <div><span style={{ background: win ? `${T.green}18` : `${T.red}18`, color: win ? T.green : T.red, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{win ? "WIN" : "LOSS"}</span></div>
                  <div><button className="btn-del" onClick={() => delTrade(t.id)} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 18, padding: 0, opacity: 0, transition: "opacity 0.15s" }}>×</button></div>
                </div>
              );
            })}
            {displayed.length > 0 && <div style={{ padding: "9px 20px", background: T.cardAlt, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.light, textAlign: "center" }}>Double-click DATE or POINTS to edit · NET = Gross − ${FEE}/contract</div>}
          </div>
        </div>

        {/* ③ STATS */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 22 }}>
            {[
              { l: "WIN RATE", v: `${stats.winPct}%`, s: `${stats.wins}W / ${stats.losses}L`, c: parseFloat(stats.winPct) >= 50 ? T.green : T.red },
              { l: "NET P&L", v: fmt(stats.totalNet), s: "after fees", c: stats.totalNet >= 0 ? T.cyan : T.red },
              { l: "TOTAL FEES", v: fmt(stats.totalFees), s: `$${FEE}/ctr`, c: "#f97316" },
              { l: "AVG NET/TRADE", v: fmt(stats.avgNet), s: "after fees", c: stats.avgNet >= 0 ? T.green : T.red },
              { l: "BEST TRADE", v: fmt(stats.largestWin), s: "net", c: T.green },
              { l: "WORST TRADE", v: fmt(stats.largestLoss), s: "net", c: T.red },
              { l: "WIN STREAK", v: String(stats.longestWin), s: "consecutive", c: T.gold },
              { l: "TOTAL TRADES", v: String(stats.total), s: `avg ${stats.perDay}/day`, c: T.cyan },
            ].map(s => (
              <div key={s.l} className="stat-card" style={{ background: T.card, border: `1px solid ${borderColor}`, borderRadius: 14, padding: "18px 16px", boxShadow: T.shadow, transition: "transform 0.15s, box-shadow 0.15s" }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: T.light, marginBottom: 10, fontWeight: 700 }}>{s.l}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: s.c, lineHeight: 1.2, fontFamily: T.mono }}>{s.v}</div>
                <div style={{ fontSize: 11, color: T.light, marginTop: 7 }}>{s.s}</div>
              </div>
            ))}
          </div>
        )}

        {/* ④ CALENDAR */}
        <CalendarView trades={trades} T={T} />

        {/* ⑤ EQUITY CURVE */}
        <div style={{ background: T.card, border: `1px solid ${borderColor}`, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow, marginBottom: 28 }}>
          <div style={{ padding: "18px 24px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 16, background: T.cardAlt, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: T.light, fontWeight: 700 }}>EQUITY CURVE <span style={{ fontSize: 10, fontWeight: 400 }}>(net after fees)</span></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {editEq ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.light, fontWeight: 600 }}>Start $</span>
                    <input type="number" value={tmpStart} onChange={e => setTmpStart(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "6px 12px", fontSize: 14, width: 110, fontFamily: T.mono }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.light, fontWeight: 600 }}>Target $</span>
                    <input type="number" value={tmpTarget} onChange={e => setTmpTarget(e.target.value)} style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "6px 12px", fontSize: 14, width: 110, fontFamily: T.mono }} />
                  </div>
                  <button onClick={saveEq} style={{ background: T.cyan, border: "none", borderRadius: 8, color: "#fff", padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Save</button>
                  <button onClick={() => setEditEq(false)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.mid, padding: "7px 12px", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.light }}>Start</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{fmtS(startEq)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 16, borderTop: `2px dashed ${T.gold}` }} />
                    <span style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>Target {fmtS(targetEq)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.light }}>Current</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: eqPnl >= 0 ? T.green : T.red, fontFamily: T.mono }}>{fmtS(currentEq)} ({eqPnl >= 0 ? "+" : ""}{fmtS(eqPnl)})</span>
                  </div>
                  {reachedTarget && <span className="glow-green" style={{ background: `${T.green}20`, color: T.green, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>✓ TARGET REACHED</span>}
                  <button onClick={() => setEditEq(true)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.mid, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>✏️ Edit</button>
                </>
              )}
            </div>
          </div>
          <div style={{ padding: "14px 20px 18px" }}>
            <EquityCurve trades={trades} startEq={startEq} targetEq={targetEq} T={T} />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24, fontSize: 11, color: T.light }}>
          /MGC = $10/pt/contract · Fees = ${FEE}/contract/trade · All P&L net after fees
        </div>
      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
const STRATS = [
  { id: "atr-trailing", name: "ATR Trailing Stop", tag: "7MIN · /MGC", desc: "ATR trailing stop strategy. Log points manually — positive = win, negative = loss. Auto-calculates P&L net of $1.24/contract fees.", color: "#00d4ff", icon: "📈" },
  { id: "cs1", name: "EMA Crossover", tag: "COMING SOON", desc: "5 EMA / 20 EMA crossover strategy tracker.", color: "#a855f7", icon: "🔀", locked: true },
  { id: "cs2", name: "Support & Resistance", tag: "COMING SOON", desc: "Key level bounce and break strategy. Track entries off S/R zones with defined risk.", color: "#f97316", icon: "⚡", locked: true },
];

function HomePage({ onSelect, counts, dark, toggleDark, T }: { onSelect: (id: string) => void; counts: Record<string, number>; dark: boolean; toggleDark: () => void; T: Theme }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, transition: "background 0.3s" }}>
      {/* Header */}
      <div style={{ background: T.headerBg, borderBottom: `1px solid ${T.border}`, padding: "22px 40px", display: "flex", alignItems: "center", gap: 14, boxShadow: T.shadow, position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(10px)" }}>
        <div style={{ fontWeight: 900, fontSize: 24, color: T.text, letterSpacing: "-0.5px" }}>ATR <span style={{ color: T.cyan }}>TRADE</span> BACKTESTER</div>
        <div style={{ fontSize: 12, color: T.light, letterSpacing: 2 }}>· STRATEGY DASHBOARD</div>
        <div style={{ marginLeft: "auto" }}><ThemeToggle dark={dark} toggle={toggleDark} T={T} /></div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 32px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: T.cyan, fontWeight: 700, marginBottom: 10 }}>BACKTESTING DASHBOARD</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: T.text, marginBottom: 12, letterSpacing: "-0.5px", lineHeight: 1.2 }}>My Strategies</div>
          <div style={{ fontSize: 16, color: T.mid, maxWidth: 480, lineHeight: 1.6 }}>Select a strategy to log and analyze your backtesting trades. Fees auto-applied.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 22 }}>
          {STRATS.map((s: any) => {
            const count = counts[s.id] || 0;
            return (
              <div key={s.id} onClick={() => !s.locked && onSelect(s.id)} className={s.locked ? "" : "strategy-card"}
                style={{ background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 20, padding: "30px 26px", cursor: s.locked ? "default" : "pointer", opacity: s.locked ? 0.45 : 1, transition: "transform 0.2s, box-shadow 0.2s", position: "relative", overflow: "hidden", boxShadow: T.shadow }}>
                {/* Top accent bar */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.locked ? T.border : `linear-gradient(90deg, ${s.color}, ${s.color}88)`, borderRadius: "20px 20px 0 0" }} />
                {/* Subtle glow */}
                {!s.locked && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: `linear-gradient(180deg, ${s.color}0a 0%, transparent 100%)`, borderRadius: "20px 20px 0 0", pointerEvents: "none" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <span style={{ fontSize: 38 }}>{s.icon}</span>
                  <span style={{ fontSize: 11, letterSpacing: 1, color: s.locked ? T.light : s.color, fontWeight: 700, background: s.locked ? T.pill : `${s.color}18`, padding: "5px 14px", borderRadius: 20, border: `1px solid ${s.locked ? T.border : s.color + "44"}` }}>{s.tag}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 10, letterSpacing: "-0.3px" }}>{s.name}</div>
                <div style={{ fontSize: 14, color: T.mid, lineHeight: 1.65, marginBottom: 24 }}>{s.desc}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: T.light }}>{s.locked ? "—" : <><span style={{ color: T.text, fontWeight: 700 }}>{count}</span> trades logged</>}</div>
                  {!s.locked && <div style={{ fontSize: 13, color: s.color, fontWeight: 700 }}>OPEN →</div>}
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
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("atr-theme");
    return stored ? stored === "dark" : true; // default dark
  });

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("atr-theme", next ? "dark" : "light");
  };

  const T = dark ? DARK : LIGHT;

  useEffect(() => {
    document.body.style.background = T.bg;
  }, [dark]);

  useEffect(() => {
    const c: Record<string, number> = {};
    try { const sess = loadSessions(); let tot = 0; sess.forEach((s: any) => { tot += loadSessionTrades(s.id).length; }); c["atr-trailing"] = tot; } catch {}
    setCounts(c);
  }, [page]);

  return (
    <>
      {page === null && <HomePage onSelect={setPage} counts={counts} dark={dark} toggleDark={toggleDark} T={T} />}
      {page === "atr-trailing" && <ATRTracker onBack={() => setPage(null)} dark={dark} toggleDark={toggleDark} T={T} />}
    </>
  );
}
