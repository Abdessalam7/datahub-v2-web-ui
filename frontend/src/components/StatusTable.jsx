import { useState, useMemo } from "react";
import StatusBadge from "./StatusBadge.jsx";

function BoolBadge({ value }) {
  return <StatusBadge ok={value === true} label={value === true ? "✓" : "✗"} />;
}

function TextBadge({ value, okValue }) {
  if (!value) return <span className="cell-mono">—</span>;
  const ok = value === okValue;
  return <StatusBadge ok={ok} label={value} />;
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="sort-icon sort-idle">↕</span>;
  return <span className="sort-icon sort-active">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ─── CSV export ────────────────────────────────────────────────────────────────

export function exportCSV(rows, tech) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let headers, lines;

  if (tech === "spark") {
    headers = ["Business Line", "Env", "Tenant Name", "Status", "Sync(ArgoCD)", "Global Status", "All Healthy", "Version", "Deprecated", "IBM Account", "IKS Cluster"];
    lines = [
      headers.join(","),
      ...rows.map((r) => [
        r.client, r.env, r.tenant_name, r.status, r.sync_argo,
        r.global_status, r.all_healthy, r.version, r.deprecated,
        r.ibm_account, r.iks_cluster,
      ].map(escape).join(",")),
    ];
  } else if (tech === "starburst") {
    headers = ["Business Line", "Env", "URL", "Version", "# Catalogs", "Healthy Catalogs", "Coordinator Uptime", "Coordinator Health", "# Workers", "Workers Health", "Instance Health", "Errors", "Failed Catalogs"];
    lines = [
      headers.join(","),
      ...rows.map((r) => [
        r.client, r.env, r.url, r.version,
        r.number_of_catalogs, r.healthy_catalogs, r.coordinator_uptime,
        r.coordinator_health, r.number_of_workers, r.workers_health,
        r.starburst_instance_health, r.errors ?? "",
        (r.failed_catalogs ?? []).join("|"),
      ].map(escape).join(",")),
    ];
  } else {
    headers = ["Business Line", "Env", "URL", "Version", "HTTP", "DAG Processor", "Scheduler", "Trigger", "Meta DB", "Error"];
    lines = [
      headers.join(","),
      ...rows.map((r) => [
        r.client, r.env, r.url, r.version,
        r.http, r.dag_processor, r.scheduler, r.trigger, r.meta_db,
        r.error ?? "",
      ].map(escape).join(",")),
    ];
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `smoke-tests-${tech}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Airflow ───────────────────────────────────────────────────────────────────

function AirflowRows({ rows, sortCol, sortDir }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return sorted.map((row, i) => (
    <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
      <td className="cell-mono">{row.env}</td>
      <td className="cell-mono cell-tenant">
        <a href={row.url_href} target="_blank" rel="noopener noreferrer" className="url-link">
          {row.url}
        </a>
      </td>
      <td className="cell-mono">{row.version}</td>
      <td><BoolBadge value={row.http} /></td>
      <td><BoolBadge value={row.dag_processor} /></td>
      <td><BoolBadge value={row.scheduler} /></td>
      <td><BoolBadge value={row.trigger} /></td>
      <td><BoolBadge value={row.meta_db} /></td>
      <td className="cell-error">{row.error ?? ""}</td>
    </tr>
  ));
}

function AirflowAccordion({ clientName, rows, sortCol, sortDir, colProps }) {
  const [open, setOpen] = useState(true);
  const total = rows.length;
  const ko    = rows.filter((r) => !r.ok).length;
  const ok    = total - ko;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span className="accordion-chevron">{open ? "▾" : "▸"}</span>
        <span className="accordion-client">{clientName}</span>
        <span className="accordion-stats">
          <span className="acc-stat acc-ok">✓ {ok} OK</span>
          {ko > 0 && <span className="acc-stat acc-ko">✗ {ko} KO</span>}
          <span className="acc-stat acc-total">{total} instances</span>
        </span>
      </div>
      {open && (
        <div className="accordion-body">
          <table>
            <thead>
              <tr>
                <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("url")}>URL <SortIcon col="url" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("http")}>HTTP <SortIcon col="http" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>DAG Processor</th>
                <th>Scheduler</th>
                <th>Trigger</th>
                <th>Meta DB</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <AirflowRows rows={rows} sortCol={sortCol} sortDir={sortDir} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AirflowFlatTable({ rows, sortCol, sortDir, handleSort }) {
  const colProps = (col) => ({
    onClick: () => handleSort(col),
    className: "th-sortable",
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <table>
      <thead>
        <tr>
          <th {...colProps("client")}>Business Line <SortIcon col="client" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("url")}>URL <SortIcon col="url" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("http")}>HTTP <SortIcon col="http" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>DAG Processor</th>
          <th>Scheduler</th>
          <th>Trigger</th>
          <th>Meta DB</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
            <td className="cell-mono">{row.client}</td>
            <td className="cell-mono">{row.env}</td>
            <td className="cell-mono cell-tenant">
              <a href={row.url_href} target="_blank" rel="noopener noreferrer" className="url-link">
                {row.url}
              </a>
            </td>
            <td className="cell-mono">{row.version}</td>
            <td><BoolBadge value={row.http} /></td>
            <td><BoolBadge value={row.dag_processor} /></td>
            <td><BoolBadge value={row.scheduler} /></td>
            <td><BoolBadge value={row.trigger} /></td>
            <td><BoolBadge value={row.meta_db} /></td>
            <td className="cell-error">{row.error ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Spark ─────────────────────────────────────────────────────────────────────

function SparkRows({ rows, sortCol, sortDir }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return sorted.map((row, i) => (
    <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
      <td className="cell-mono">{row.env}</td>
      <td className="cell-mono cell-tenant">
        <a href={row.url_href} target="_blank" rel="noopener noreferrer" className="url-link">
          {row.tenant_name}
        </a>
      </td>
      <td><TextBadge value={row.status} okValue="Healthy" /></td>
      <td><TextBadge value={row.sync_argo} okValue="Synced" /></td>
      <td><TextBadge value={row.global_status} okValue="Synced" /></td>
      <td className="cell-mono">{row.version}</td>
      <td className="cell-mono">{row.deprecated ? "Yes" : "No"}</td>
      <td className="cell-mono cell-account">{row.ibm_account}</td>
      <td className="cell-mono cell-cluster">{row.iks_cluster}</td>
    </tr>
  ));
}

function SparkAccordion({ clientName, rows, sortCol, sortDir, colProps }) {
  const [open, setOpen] = useState(true);
  const total = rows.length;
  const ko    = rows.filter((r) => !r.ok).length;
  const ok    = total - ko;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span className="accordion-chevron">{open ? "▾" : "▸"}</span>
        <span className="accordion-client">{clientName}</span>
        <span className="accordion-stats">
          <span className="acc-stat acc-ok">✓ {ok} OK</span>
          {ko > 0 && <span className="acc-stat acc-ko">✗ {ko} KO</span>}
          <span className="acc-stat acc-total">{total} tenants</span>
        </span>
      </div>
      {open && (
        <div className="accordion-body">
          <table>
            <thead>
              <tr>
                <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("tenant_name")}>Tenant Name <SortIcon col="tenant_name" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("status")}>Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("sync_argo")}>Sync(ArgoCD) <SortIcon col="sync_argo" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Global Status</th>
                <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Deprecated</th>
                <th>IBM Account</th>
                <th>IKS Cluster</th>
              </tr>
            </thead>
            <tbody>
              <SparkRows rows={rows} sortCol={sortCol} sortDir={sortDir} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SparkFlatTable({ rows, sortCol, sortDir, handleSort }) {
  const colProps = (col) => ({
    onClick: () => handleSort(col),
    className: "th-sortable",
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <table>
      <thead>
        <tr>
          <th {...colProps("client")}>Business Line <SortIcon col="client" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("tenant_name")}>Tenant Name <SortIcon col="tenant_name" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("status")}>Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("sync_argo")}>Sync(ArgoCD) <SortIcon col="sync_argo" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Global Status</th>
          <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Deprecated</th>
          <th>IBM Account</th>
          <th>IKS Cluster</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
            <td className="cell-mono">{row.client}</td>
            <td className="cell-mono">{row.env}</td>
            <td className="cell-mono cell-tenant">{row.tenant_name}</td>
            <td><TextBadge value={row.status} okValue="Healthy" /></td>
            <td><TextBadge value={row.sync_argo} okValue="Synced" /></td>
            <td><TextBadge value={row.global_status} okValue="Synced" /></td>
            <td className="cell-mono">{row.version}</td>
            <td className="cell-mono">{row.deprecated ? "Yes" : "No"}</td>
            <td className="cell-mono cell-account">{row.ibm_account}</td>
            <td className="cell-mono cell-cluster">{row.iks_cluster}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// ─── Starburst ─────────────────────────────────────────────────────────────────

function StarburstRows({ rows, sortCol, sortDir }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return sorted.map((row, i) => (
    <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
      <td className="cell-mono">{row.env}</td>
      <td className="cell-mono cell-tenant">
        <a href={row.url_href} target="_blank" rel="noopener noreferrer" className="url-link">
          {row.url}
        </a>
      </td>
      <td className="cell-mono">{row.number_of_catalogs}</td>
      <td className="cell-mono">{row.healthy_catalogs}</td>
      <td className="cell-mono">{row.coordinator_uptime}</td>
      <td><BoolBadge value={row.coordinator_health} /></td>
      <td className="cell-mono">{row.number_of_workers}</td>
      <td><BoolBadge value={row.workers_health} /></td>
      <td className="cell-mono">{row.version}</td>
      <td><BoolBadge value={row.starburst_instance_health} /></td>
      <td className="cell-error">{row.errors ?? ""}</td>
      <td className="cell-mono cell-failed">
        {row.failed_catalogs?.length
          ? row.failed_catalogs.map((c, j) => <span key={j} className="failed-catalog">{c}</span>)
          : ""}
      </td>
    </tr>
  ));
}

function StarburstAccordion({ clientName, rows, sortCol, sortDir, colProps }) {
  const [open, setOpen] = useState(true);
  const total = rows.length;
  const ko    = rows.filter((r) => !r.ok).length;
  const ok    = total - ko;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span className="accordion-chevron">{open ? "▾" : "▸"}</span>
        <span className="accordion-client">{clientName}</span>
        <span className="accordion-stats">
          <span className="acc-stat acc-ok">✓ {ok} OK</span>
          {ko > 0 && <span className="acc-stat acc-ko">✗ {ko} KO</span>}
          <span className="acc-stat acc-total">{total} instances</span>
        </span>
      </div>
      {open && (
        <div className="accordion-body">
          <table>
            <thead>
              <tr>
                <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("url")}>URL <SortIcon col="url" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("number_of_catalogs")}># Catalogs <SortIcon col="number_of_catalogs" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("healthy_catalogs")}>Healthy <SortIcon col="healthy_catalogs" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...colProps("coordinator_uptime")}>Coord. Uptime <SortIcon col="coordinator_uptime" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Coord. Health</th>
                <th {...colProps("number_of_workers")}># Workers <SortIcon col="number_of_workers" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Workers Health</th>
                <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
                <th>Instance Health</th>
                <th>Errors</th>
                <th>Failed Catalogs</th>
              </tr>
            </thead>
            <tbody>
              <StarburstRows rows={rows} sortCol={sortCol} sortDir={sortDir} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StarburstFlatTable({ rows, sortCol, sortDir, handleSort }) {
  const colProps = (col) => ({
    onClick: () => handleSort(col),
    className: "th-sortable",
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "boolean") { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <table>
      <thead>
        <tr>
          <th {...colProps("client")}>Business Line <SortIcon col="client" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("env")}>Env <SortIcon col="env" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("url")}>URL <SortIcon col="url" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("number_of_catalogs")}># Catalogs <SortIcon col="number_of_catalogs" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("healthy_catalogs")}>Healthy <SortIcon col="healthy_catalogs" sortCol={sortCol} sortDir={sortDir} /></th>
          <th {...colProps("coordinator_uptime")}>Coord. Uptime <SortIcon col="coordinator_uptime" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Coord. Health</th>
          <th {...colProps("number_of_workers")}># Workers <SortIcon col="number_of_workers" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Workers Health</th>
          <th {...colProps("version")}>Version <SortIcon col="version" sortCol={sortCol} sortDir={sortDir} /></th>
          <th>Instance Health</th>
          <th>Errors</th>
          <th>Failed Catalogs</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr key={row.id ?? i} className={!row.ok ? "row-ko" : ""}>
            <td className="cell-mono">{row.client}</td>
            <td className="cell-mono">{row.env}</td>
            <td className="cell-mono cell-tenant">
              <a href={row.url_href} target="_blank" rel="noopener noreferrer" className="url-link">
                {row.url}
              </a>
            </td>
            <td className="cell-mono">{row.number_of_catalogs}</td>
            <td className="cell-mono">{row.healthy_catalogs}</td>
            <td className="cell-mono">{row.coordinator_uptime}</td>
            <td><BoolBadge value={row.coordinator_health} /></td>
            <td className="cell-mono">{row.number_of_workers}</td>
            <td><BoolBadge value={row.workers_health} /></td>
            <td className="cell-mono">{row.version}</td>
            <td><BoolBadge value={row.starburst_instance_health} /></td>
            <td className="cell-error">{row.errors ?? ""}</td>
            <td className="cell-mono cell-failed">
              {row.failed_catalogs?.length
                ? row.failed_catalogs.map((c, j) => <span key={j} className="failed-catalog">{c}</span>)
                : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function StatusTable({ rows, tech }) {
  const isSpark = tech === "spark";
  const isStarburst = tech === "starburst";
  const [sortCol, setSortCol] = useState("url");
  const [sortDir, setSortDir] = useState("asc");
  const [viewMode, setViewMode] = useState("accordion");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const colProps = (col) => ({
    onClick: () => handleSort(col),
    className: "th-sortable",
  });

  const groupedByClient = useMemo(() => {
    const map = {};
    for (const row of rows) {
      if (!map[row.client]) map[row.client] = [];
      map[row.client].push(row);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <table><tbody>
          <tr className="empty-row">
            <td colSpan={10}>No results match the current filters.</td>
          </tr>
        </tbody></table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === "accordion" ? "view-btn-active" : ""}`}
            onClick={() => setViewMode("accordion")}
          >
            ☰ By {isSpark ? "business line" : "business line"}
          </button>
          <button
            className={`view-btn ${viewMode === "flat" ? "view-btn-active" : ""}`}
            onClick={() => setViewMode("flat")}
          >
            ≡ Flat
          </button>
        </div>
        <span className="table-count">{rows.length} result{rows.length > 1 ? "s" : ""}</span>
        <button className="export-btn" onClick={() => exportCSV(rows, tech)}>
          ↓ Export CSV
        </button>
      </div>

      {viewMode === "flat" ? (
        isStarburst
          ? <StarburstFlatTable rows={rows} sortCol={sortCol} sortDir={sortDir} handleSort={handleSort} />
          : isSpark
            ? <SparkFlatTable rows={rows} sortCol={sortCol} sortDir={sortDir} handleSort={handleSort} />
            : <AirflowFlatTable rows={rows} sortCol={sortCol} sortDir={sortDir} handleSort={handleSort} />
      ) : (
        <div className="accordion">
          {groupedByClient.map(([clientName, clientRows]) => (
            isStarburst
              ? <StarburstAccordion key={clientName} clientName={clientName} rows={clientRows} sortCol={sortCol} sortDir={sortDir} colProps={colProps} />
              : isSpark
                ? <SparkAccordion key={clientName} clientName={clientName} rows={clientRows} sortCol={sortCol} sortDir={sortDir} colProps={colProps} />
                : <AirflowAccordion key={clientName} clientName={clientName} rows={clientRows} sortCol={sortCol} sortDir={sortDir} colProps={colProps} />
          ))}
        </div>
      )}
    </div>
  );
}
