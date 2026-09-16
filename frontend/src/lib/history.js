import { flattenData, JOURNAL_FIELDS, rowKey } from "./flatten.js";

const STABLE_THRESHOLD = 0.3; // pts — matches the "flat" band used in the ranking badge

// Raw /api/history events -> {ts, rows}[] sorted ascending. Each event already
// has the same {instances:[...]} / {tenants:[...]} shape flattenData expects.
function toSnapshots(events, tech) {
  return events
    .filter((e) => e.ts)
    .map((e) => ({ ts: e.ts, rows: flattenData(e, tech) }))
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

// Per-client daily uptime %, time-weighted across each UTC day using the
// state carried forward from the last snapshot before that day (history is
// diff-only — most days have zero events, meaning "nothing changed").
// `days` should include a lookback buffer beyond what you intend to render,
// so the first rendered days can still find a carry-in state.
export function computeDailyUptime(events, tech, days) {
  const snapshots = toSnapshots(events, tech);
  const clients = [...new Set(snapshots.flatMap((s) => s.rows.map((r) => r.client)))].sort();

  const today = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    dates.push(d.toISOString().slice(0, 10));
  }

  const series = {};
  clients.forEach((c) => { series[c] = new Array(dates.length).fill(null); });

  if (snapshots.length === 0) return { dates, series, clients };

  for (const client of clients) {
    dates.forEach((dateStr, dayIdx) => {
      const dayStart = Date.parse(`${dateStr}T00:00:00Z`);
      const dayEnd = dayStart + 86_400_000;

      const before = snapshots.filter((s) => Date.parse(s.ts) <= dayStart);
      const within = snapshots.filter((s) => {
        const t = Date.parse(s.ts);
        return t > dayStart && t < dayEnd;
      });
      if (before.length === 0 && within.length === 0) return; // no carry-in yet — leave null

      const boundary = [];
      if (before.length > 0) boundary.push({ t: dayStart, rows: before[before.length - 1].rows });
      within.forEach((s) => boundary.push({ t: Date.parse(s.ts), rows: s.rows }));

      let weightedOk = 0;
      let totalWeight = 0;
      boundary.forEach((seg, i) => {
        const segEnd = i + 1 < boundary.length ? boundary[i + 1].t : dayEnd;
        const duration = segEnd - seg.t;
        if (duration <= 0) return;
        const clientRows = seg.rows.filter((r) => r.client === client);
        if (clientRows.length === 0) return;
        const okFrac = clientRows.filter((r) => r.ok).length / clientRows.length;
        weightedOk += okFrac * duration;
        totalWeight += duration;
      });
      if (totalWeight > 0) {
        series[client][dayIdx] = Math.round((weightedOk / totalWeight) * 1000) / 10;
      }
    });
  }

  return { dates, series, clients };
}

// Field-level status transitions between consecutive snapshots, per
// (client, env) instance — the raw material for the change journal.
export function computeJournal(events, tech) {
  const snapshots = toSnapshots(events, tech);
  const fields = JOURNAL_FIELDS[tech] ?? [];
  const entries = [];

  let prevByKey = new Map();
  for (const snap of snapshots) {
    const curByKey = new Map(snap.rows.map((r) => [rowKey(r), r]));
    for (const [key, row] of curByKey) {
      const prev = prevByKey.get(key);
      if (!prev) continue; // first sighting of this instance, not a transition
      for (const field of fields) {
        if (prev[field] === undefined || row[field] === undefined) continue;
        if (prev[field] !== row[field]) {
          entries.push({
            ts: snap.ts,
            date: snap.ts.slice(0, 10),
            time: snap.ts.slice(11, 16),
            tech,
            client: row.client,
            env: row.env,
            field,
            from: prev[field],
            to: row[field],
          });
        }
      }
    }
    prevByKey = curByKey;
  }

  entries.sort((a, b) => b.ts.localeCompare(a.ts));
  return entries;
}

// This-week vs previous-week average uptime per client, from computeDailyUptime's
// output, sorted most-degraded first (matches the mockup's ranking order).
export function computeRanking(daily) {
  const { dates, series, clients } = daily;
  const n = dates.length;
  if (n === 0) return [];

  const slice = (arr, count, offsetFromEnd) => arr.slice(Math.max(0, n - offsetFromEnd - count), n - offsetFromEnd);
  const avg = (arr) => {
    const vals = arr.filter((v) => v != null);
    return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  return clients
    .map((client) => {
      const vals = series[client];
      const thisWeek = avg(slice(vals, 7, 0));
      const prevWeek = avg(slice(vals, 7, 7));
      const spark = slice(vals, 14, 0).filter((v) => v != null);
      if (thisWeek == null || prevWeek == null) return null;
      const delta = Math.round((thisWeek - prevWeek) * 10) / 10;
      const direction = delta > STABLE_THRESHOLD ? "up" : delta < -STABLE_THRESHOLD ? "down" : "flat";
      return { client, thisWeek, prevWeek, delta, spark, direction };
    })
    .filter(Boolean)
    .sort((a, b) => a.delta - b.delta);
}
