import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { makeClientColorer } from "../lib/colors.js";

function shortLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-time">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: <strong>{p.value == null ? "—" : `${p.value}%`}</strong>
        </p>
      ))}
    </div>
  );
}

export default function Trend({ tech, daily, loading, error }) {
  const [active, setActive] = useState(null); // null = all active
  const [view, setView] = useState("chart");

  const colorOf = useMemo(() => makeClientColorer(daily?.clients ?? []), [daily?.clients]);

  if (loading) return <div className="state-box">Loading…</div>;
  if (error) return <div className="state-box error">⚠ {error}</div>;
  if (!daily || daily.clients.length === 0) {
    return (
      <div className="trend-card uptime-chart-wrap">
        <div className="trend-empty">
          {tech === "starburst"
            ? "Historique pas encore disponible pour Starburst — la collecte day-partitionnée n'est pas encore branchée sur cette techno."
            : "Pas encore assez d'historique pour afficher une tendance."}
        </div>
      </div>
    );
  }

  const { dates, series, clients } = daily;
  const isActive = (c) => active == null || active.has(c);

  const chartData = dates.map((d, i) => {
    const point = { date: shortLabel(d) };
    clients.forEach((c) => { point[c] = series[c][i]; });
    return point;
  });

  function toggleChip(c) {
    setActive((prev) => {
      const next = new Set(prev ?? clients);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  return (
    <div className="trend-section">
      <div className="trend-controls">
        <div className="trend-chips" role="group" aria-label="Filtrer par ligne métier">
          {clients.map((c) => {
            const color = colorOf(c);
            const on = isActive(c);
            return (
              <button
                key={c} type="button"
                className={`trend-chip ${on ? "" : "inactive"}`}
                style={on ? { borderColor: color, color, background: `${color}14` } : undefined}
                onClick={() => toggleChip(c)}
              >
                <span className="dot" style={{ background: color }} />
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="uptime-chart-wrap trend-card">
        <div className="trend-chart-head">
          <div className="trend-chart-title">Disponibilité par ligne métier</div>
          <button type="button" className="trend-table-toggle" onClick={() => setView(view === "chart" ? "table" : "chart")}>
            {view === "chart" ? "Voir en tableau" : "Voir le graphique"}
          </button>
        </div>

        {view === "chart" ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.ceil(dates.length / 8)} />
                <YAxis domain={["auto", 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip content={<CustomTooltip />} />
                {clients.filter(isActive).map((c) => (
                  <Line
                    key={c} type="monotone" dataKey={c} stroke={colorOf(c)}
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="trend-legend">
              {clients.map((c) => (
                <div key={c} className={`trend-legend-item ${isActive(c) ? "" : "inactive"}`}>
                  <span className="trend-legend-swatch" style={{ background: colorOf(c) }} />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="trend-table-wrap table-wrap">
            <table className="trend-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {clients.map((c) => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {dates.map((d, i) => (
                  <tr key={d}>
                    <td>{shortLabel(d)}</td>
                    {clients.map((c) => {
                      const v = series[c][i];
                      return (
                        <td key={c} className={v != null && v < 95 ? "dip" : ""}>
                          {v == null ? "—" : `${v}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
