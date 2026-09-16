import { useMemo, useState } from "react";
import Sparkline from "./Sparkline.jsx";
import { makeClientColorer } from "../lib/colors.js";

function fmtPct(n) { return n == null ? "—" : `${n.toFixed(1)}%`; }
function fmtDelta(n) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(n).toFixed(1)} pts`;
}

function Badge({ row }) {
  if (row.direction === "up") return <span className="rank-badge is-up">▲ {fmtDelta(row.delta)}</span>;
  if (row.direction === "down") return <span className="rank-badge is-down">▼ {fmtDelta(row.delta)}</span>;
  return <span className="rank-badge is-flat">— stable</span>;
}

export default function Ranking({ tech, rows, loading, error }) {
  const [view, setView] = useState("cards");
  const [sortCol, setSortCol] = useState("delta");
  const [sortDir, setSortDir] = useState("asc");

  const colorOf = useMemo(() => makeClientColorer(rows.map((r) => r.client)), [rows]);

  if (loading) return <div className="state-box">Loading…</div>;
  if (error) return <div className="state-box error">⚠ {error}</div>;
  if (tech === "starburst") {
    return (
      <div className="rank-root">
        <div className="trend-empty">Historique pas encore disponible pour Starburst — la collecte day-partitionnée n'est pas encore branchée sur cette techno.</div>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rank-root">
        <div className="trend-empty">Pas encore deux semaines d'historique pour comparer — revenez plus tard.</div>
      </div>
    );
  }

  const degraded = rows.filter((r) => r.direction === "down");
  const improved = rows.filter((r) => r.direction === "up");
  const worst = rows[0]; // rows already sorted most-degraded first

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const sortedForTable = [...rows].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const caretFor = (c) => sortCol === c ? <span className="sort-caret">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  return (
    <div className="rank-root">
      <div className="rank-stats">
        <div className="rank-stat">
          <div className="rank-stat-num is-ko">{degraded.length}</div>
          <div className="rank-stat-label">Lignes dégradées</div>
        </div>
        <div className="rank-stat">
          <div className="rank-stat-num is-ok">{improved.length}</div>
          <div className="rank-stat-label">Lignes améliorées</div>
        </div>
        <div className="rank-stat">
          <div className="rank-stat-num is-ko">{worst.client} {fmtDelta(worst.delta)}</div>
          <div className="rank-stat-label">Plus forte baisse</div>
        </div>
      </div>

      <div className="rank-toolbar">
        <button type="button" className="rank-toggle-view" onClick={() => setView(view === "cards" ? "table" : "cards")}>
          {view === "cards" ? "Voir en tableau" : "Voir en cartes"}
        </button>
      </div>

      {view === "cards" ? (
        <div className="rank-cards">
          {rows.map((row, i) => (
            <div key={row.client} className="rank-card">
              <div className="rank-rank">#{i + 1}</div>
              <div className="rank-bl">
                <span className="rank-swatch" style={{ background: colorOf(row.client) }} />
                <span style={{ minWidth: 0 }}>
                  <div className="rank-bl-name">{row.client}</div>
                </span>
              </div>
              <div className="rank-uptime">
                <div className="rank-uptime-main">{fmtPct(row.thisWeek)}</div>
                <div className="rank-uptime-prev">vs {fmtPct(row.prevWeek)} sem. précédente</div>
              </div>
              <div><Badge row={row} /></div>
              <div className="rank-spark">
                <Sparkline points={row.spark} width={120} height={28} color={colorOf(row.client)} showArea={false} emptyMessage="—" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th onClick={() => handleSort("client")}>Ligne {caretFor("client")}</th>
                <th onClick={() => handleSort("thisWeek")}>Cette semaine {caretFor("thisWeek")}</th>
                <th onClick={() => handleSort("prevWeek")}>Sem. précédente {caretFor("prevWeek")}</th>
                <th onClick={() => handleSort("delta")}>Δ (pts) {caretFor("delta")}</th>
                <th>Tendance</th>
              </tr>
            </thead>
            <tbody>
              {sortedForTable.map((row, i) => (
                <tr key={row.client}>
                  <td className="mono">#{i + 1}</td>
                  <td><span className="rank-bl"><span className="rank-swatch" style={{ background: colorOf(row.client) }} />{row.client}</span></td>
                  <td className="mono">{fmtPct(row.thisWeek)}</td>
                  <td className="mono">{fmtPct(row.prevWeek)}</td>
                  <td><Badge row={row} /></td>
                  <td><Sparkline points={row.spark} width={120} height={28} color={colorOf(row.client)} showArea={false} emptyMessage="—" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
