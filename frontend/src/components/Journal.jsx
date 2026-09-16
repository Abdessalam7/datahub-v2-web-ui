import { useMemo, useState } from "react";
import { isGoodValue } from "../lib/flatten.js";
import { makeClientColorer } from "../lib/colors.js";

const TECH_LABEL = { airflow: "Airflow", spark: "Spark", starburst: "Starburst" };

function displayValue(tech, field, value) {
  if (typeof value === "boolean") return value ? "OK" : "KO";
  return String(value);
}

function formatDayHeader(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Journal({ tech, entries, loading, error }) {
  const [degradOnly, setDegradOnly] = useState(false);

  const clients = useMemo(() => [...new Set(entries.map((e) => e.client))], [entries]);
  const colorOf = useMemo(() => makeClientColorer(clients), [clients]);

  if (loading) return <div className="state-box">Loading…</div>;
  if (error) return <div className="state-box error">⚠ {error}</div>;
  if (tech === "starburst") {
    return (
      <div className="hist-section">
        <p className="hist-empty">Historique pas encore disponible pour Starburst — la collecte day-partitionnée n'est pas encore branchée sur cette techno.</p>
      </div>
    );
  }

  const byDate = new Map();
  for (const ev of entries) {
    if (degradOnly && isGoodValue(ev.to)) continue;
    if (!byDate.has(ev.date)) byDate.set(ev.date, []);
    byDate.get(ev.date).push(ev);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="hist-section">
      <div className="hist-filters">
        <label className="hist-checkbox">
          <input type="checkbox" checked={degradOnly} onChange={(e) => setDegradOnly(e.target.checked)} />
          <span>Dégradations uniquement</span>
        </label>
      </div>

      {dates.length === 0 ? (
        <p className="hist-empty">Aucun changement pour ce filtre sur la période.</p>
      ) : (
        <div className="hist-log">
          {dates.map((date) => {
            const events = byDate.get(date).slice().sort((a, b) => a.time.localeCompare(b.time));
            return (
              <div key={date} className="hist-day">
                <div className="hist-day-header">
                  <span className="hist-day-title">{formatDayHeader(date)}</span>
                  <span className="hist-day-badge">{events.length} évènement{events.length > 1 ? "s" : ""}</span>
                </div>
                <div className="hist-events">
                  {events.map((ev, i) => {
                    const toGood = isGoodValue(ev.to);
                    return (
                      <div key={i} className="hist-event">
                        <span className="hist-time">{ev.time}</span>
                        <span className={`hist-severity ${toGood ? "hist-severity-up" : "hist-severity-down"}`}
                          role="img" aria-label={toGood ? "Récupération" : "Dégradation"}>
                          {toGood ? "▲" : "▼"}
                        </span>
                        <span className="hist-tech-pill">{TECH_LABEL[ev.tech]}</span>
                        <span className="hist-bl">
                          <span className="hist-bl-dot" style={{ background: colorOf(ev.client) }} />
                          <span>{ev.client}</span>
                        </span>
                        <span className="hist-env">{ev.env}</span>
                        <span className="hist-change">
                          <span className="hist-field">{ev.field}</span> :{" "}
                          <span className={isGoodValue(ev.from) ? "hist-good" : "hist-bad"}>
                            {displayValue(ev.tech, ev.field, ev.from)}
                          </span>
                          <span className="hist-arrow-sep"> → </span>
                          <span className={toGood ? "hist-good" : "hist-bad"}>
                            {displayValue(ev.tech, ev.field, ev.to)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
