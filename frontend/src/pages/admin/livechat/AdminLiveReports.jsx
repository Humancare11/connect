import { useEffect, useMemo, useState } from "react";
import api from "../../../api";
import { hub } from "./liveChatHub";
import { useAdmin } from "../../../context/AdminContext";
import NotificationsBanner from "./NotificationsBanner";
import "./LiveChatPages.css";

// Live Chat > Reports: chats today, % solved by AI, first reply time, rating, bookings after chat, AI cost, and chats
// per hour (AI vs agent), for a date range. Days are in the support time zone from the settings.
const BASE = "/api/admin/livechat";

const seconds = (value) => {
  if (value === null || value === undefined) return "–";
  const s = Math.round(value);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
const usd = (value) => `$${Number(value || 0).toFixed(value >= 10 ? 2 : 4).replace(/0+$/, "").replace(/\.$/, ".00")}`;

const addDays = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const hourShort = (h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;

// Chats per hour: stacked columns, AI at the bottom and agent on top. Fixed spec: columns up to 24px, a 2px gap
// between the segments, a 4px rounded top, one baseline, hairline grid. AI is purple and agents are green (the pair was
// checked with the palette validator; purple/blue was too close). The legend names the series, the tooltip gives the
// exact numbers, and a table view shows the same data.
const AI_COLOR = "#6D4AE0";
const AGENT_COLOR = "#0E9F6E";
const W = 720;
const H = 230;
const M = { left: 34, right: 8, top: 10, bottom: 26 };

function segmentPath(x, y, w, h, roundTop) {
  const r = roundTop ? Math.min(4, h, w / 2) : 0;
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}z`;
  return `M${x},${y + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}h${-w}z`;
}

function HourChart({ perHour }) {
  const [tip, setTip] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(0, ...perHour.map((h) => h.ai + h.agent));
  const niceMax = Math.max(4, Math.ceil(peak / 4) * 4);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const slot = plotW / 24;
  const barW = Math.min(24, slot * 0.62);
  const y = (n) => M.top + plotH - (n / niceMax) * plotH;
  const GAP = 2;
  const busiest = peak ? perHour.reduce((a, b) => (b.ai + b.agent > a.ai + a.agent ? b : a)) : null;
  const total = perHour.reduce((n, h) => n + h.ai + h.agent, 0);

  return (
    <div className="lcp-panel">
      <div className="lcp-panel-head">
        <div>
          <h3>Chats per hour</h3>
          <span className="lcp-help">{total ? `${total} chats in the range${busiest ? `. Busiest hour: ${hourLabel(busiest.hour)} (${busiest.ai + busiest.agent})` : ""}.` : "No chats in this range."}</span>
        </div>
        <button type="button" className="lcp-btn lcp-btn--small" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      <div className="lcp-legend" aria-label="Legend">
        <span>
          <i style={{ background: AI_COLOR }} /> Solved by AI
        </span>
        <span>
          <i style={{ background: AGENT_COLOR }} /> With an agent
        </span>
      </div>

      {asTable ? (
        <div className="lcp-table-wrap">
          <table className="lcp-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Hour</th>
                <th>AI</th>
                <th>Agent</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {perHour
                .filter((h) => h.ai + h.agent > 0)
                .map((h) => (
                  <tr key={h.hour}>
                    <td>
                      {hourLabel(h.hour)}–{hourLabel((h.hour + 1) % 24)}
                    </td>
                    <td className="lcp-mono">{h.ai}</td>
                    <td className="lcp-mono">{h.agent}</td>
                    <td className="lcp-mono">{h.ai + h.agent}</td>
                  </tr>
                ))}
              {total === 0 && (
                <tr>
                  <td colSpan={4} className="lcp-muted">
                    No chats in this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="lcp-chart" onMouseLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chats per hour, solved by AI and with an agent">
            {[0, 1, 2, 3, 4].map((i) => {
              const v = (niceMax / 4) * i;
              return (
                <g key={i}>
                  <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#E8EDF5" strokeWidth="1" />
                  <text x={M.left - 6} y={y(v) + 4} textAnchor="end">
                    {v}
                  </text>
                </g>
              );
            })}
            {perHour.map((h) => {
              const cx = M.left + slot * h.hour + slot / 2;
              const x = cx - barW / 2;
              const aiH = (h.ai / niceMax) * plotH;
              const agentH = (h.agent / niceMax) * plotH;
              const aiTop = y(h.ai);
              return (
                <g key={h.hour}>
                  {h.ai > 0 && <path d={segmentPath(x, aiTop, barW, aiH, h.agent === 0)} fill={AI_COLOR} />}
                  {h.agent > 0 && <path d={segmentPath(x, y(h.ai + h.agent), barW, Math.max(agentH - (h.ai > 0 ? GAP : 0), 1), true)} fill={AGENT_COLOR} />}
                  {h.hour % 3 === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle">
                      {hourShort(h.hour)}
                    </text>
                  )}
                  {/* hit target: the whole column, much bigger than the bar */}
                  <rect
                    x={M.left + slot * h.hour}
                    y={M.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${hourLabel(h.hour)}: ${h.ai} solved by AI, ${h.agent} with an agent`}
                    onMouseEnter={() => setTip({ hour: h.hour, ai: h.ai, agent: h.agent, left: ((cx / W) * 100), top: (y(h.ai + h.agent) / H) * 100 })}
                    onFocus={() => setTip({ hour: h.hour, ai: h.ai, agent: h.agent, left: ((cx / W) * 100), top: (y(h.ai + h.agent) / H) * 100 })}
                    onBlur={() => setTip(null)}
                  />
                </g>
              );
            })}
            <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#C5CEDF" strokeWidth="1" />
          </svg>
          {tip && (
            <div className="lcp-tip" style={{ left: `${tip.left}%`, top: `calc(${tip.top}% - 6px)` }} role="status">
              <b>
                {hourLabel(tip.hour)}–{hourLabel((tip.hour + 1) % 24)}
              </b>
              <br />
              AI {tip.ai} · Agent {tip.agent} · Total {tip.ai + tip.agent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminLiveReports() {
  const { admin } = useAdmin();
  const me = String(admin?._id || admin?.id || "");
  const [range, setRange] = useState({ from: "", to: "" }); // "" = today (the server answers with the real day)
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => hub.acquire(me), [me]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`${BASE}/reports`, { params: range.from ? range : {} })
      .then(({ data: body }) => {
        if (cancelled) return;
        setData(body);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err?.response?.data?.error;
        setError(code === "range_too_long" ? "Choose a range of up to one year." : code === "invalid_range" ? "Choose a valid date range." : "Could not load the reports.");
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const today = data?.range.today;
  const from = range.from || data?.range.from || "";
  const to = range.to || data?.range.to || "";
  const presets = useMemo(
    () =>
      today
        ? [
            ["Today", today, today],
            ["Yesterday", addDays(today, -1), addDays(today, -1)],
            ["Last 7 days", addDays(today, -6), today],
            ["Last 30 days", addDays(today, -29), today],
            ["This month", `${today.slice(0, 7)}-01`, today],
          ]
        : [],
    [today]
  );

  const c = data?.chats;
  const reply = data?.firstReply;
  const rating = data?.rating;
  const bookings = data?.bookings;
  const cost = data?.aiCost;
  const maxStars = Math.max(1, ...(rating?.distribution || []).map((d) => d.count));

  return (
    <div className="lcp">
      <div className="lcp-title">
        <div>
          <div className="lcp-eyebrow">Humancare Admin · Live Chat</div>
          <h2>Reports</h2>
        </div>
        {data && <span className="lcp-mono lcp-muted">Time zone: {data.range.timeZone}</span>}
      </div>
      <NotificationsBanner />

      <div className="lcp-range">
        <div className="lcp-chips" role="group" aria-label="Date range">
          {presets.map(([label, f, t]) => (
            <button key={label} type="button" className="lcp-chip" aria-pressed={from === f && to === t} onClick={() => setRange({ from: f, to: t })}>
              {label}
            </button>
          ))}
        </div>
        <label>
          From
          <input type="date" value={from} max={to || today} onChange={(e) => e.target.value && setRange({ from: e.target.value, to: to && e.target.value <= to ? to : e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setRange({ from: from || e.target.value, to: e.target.value })} />
        </label>
      </div>

      {error && <div className="lcp-error" role="alert">{error}</div>}

      {data && (
        <>
          <div className="lcp-cards">
            <div className="lcp-card">
              <div className="lcp-n">{c.today}</div>
              <div className="lcp-l">Chats today</div>
              <div className="lcp-sub">{c.total} in the selected range</div>
            </div>
            <div className="lcp-card lcp-card--ai">
              <div className="lcp-n">{c.solvedByAiPercent === null ? "–" : `${c.solvedByAiPercent}%`}</div>
              <div className="lcp-l">Solved by AI</div>
              <div className="lcp-sub">
                {c.solvedByAi} of {c.total} chats never needed an agent
              </div>
            </div>
            <div className="lcp-card lcp-card--ok">
              <div className="lcp-n">{seconds(reply.agentAvgSeconds)}</div>
              <div className="lcp-l">Agent first reply</div>
              <div className="lcp-sub">
                From the Queue to the first message{reply.agentChats ? ` · ${reply.agentChats} chats` : ""}. AI: {seconds(reply.aiAvgSeconds)}
              </div>
            </div>
            <div className="lcp-card lcp-card--warn">
              <div className="lcp-n">{rating.average === null ? "–" : `${rating.average} ★`}</div>
              <div className="lcp-l">Rating</div>
              <div className="lcp-sub">{rating.count} rating{rating.count === 1 ? "" : "s"}</div>
            </div>
            <div className="lcp-card">
              <div className="lcp-n">{bookings.chatsWithBooking}</div>
              <div className="lcp-l">Bookings after chat</div>
              <div className="lcp-sub">
                of {bookings.chatsWithContact} chats with contact details booked within {bookings.windowDays} days
                {bookings.truncated ? " (latest 2,000 chats)" : ""}
              </div>
            </div>
            <div className="lcp-card lcp-card--ai">
              <div className="lcp-n">{usd(cost.todayUsd)}</div>
              <div className="lcp-l">AI cost today</div>
              <div className="lcp-sub">
                Cap {usd(cost.dailyCapUsd)} a day · this month {usd(cost.monthUsd)}
              </div>
            </div>
          </div>

          <HourChart perHour={data.perHour} />

          <div className="lcp-panel">
            <h3>Rating</h3>
            <span className="lcp-help">{rating.count ? `${rating.count} rating${rating.count === 1 ? "" : "s"} in the range` : "No ratings in this range."}</span>
            <div className="lcp-bars" role="list">
              {[...rating.distribution].reverse().map((d) => (
                <div key={d.stars} className="lcp-bar-row" role="listitem">
                  <span>{d.stars} ★</span>
                  <span className="lcp-bar-track">
                    <span className="lcp-bar-fill" style={{ width: `${(d.count / maxStars) * 100}%`, display: "block" }} />
                  </span>
                  <span className="lcp-mono">{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lcp-panel">
            <h3>AI cost in the range</h3>
            <span className="lcp-help">
              {usd(cost.rangeUsd)} · {cost.rangeRequests} requests · {cost.rangeInputTokens.toLocaleString()} input and {cost.rangeOutputTokens.toLocaleString()} output tokens. Kept even after
              chats are deleted.
            </span>
          </div>
          <p className="lcp-note">
            "Solved by AI" counts chats that never needed an agent (including chats where the patient left), as a share of all chats started in the
            range. "Bookings after chat" counts a chat when its contact's email belongs to a registered user who booked an appointment within{" "}
            {bookings.windowDays} days after the chat started. Chats started by an admin count as agent chats.
          </p>
        </>
      )}
    </div>
  );
}
