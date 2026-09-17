// Normalizes a raw status payload ({instances:[...]} or {tenants:[...]}) into
// the flat row shape every view (live table, history, journal, ranking) works with.
// Shared between the live "Vue actuelle" fetch and historical COS snapshots,
// which have the exact same per-tech shape.
export function flattenData(data, tech) {
  if (tech === "spark") {
    return (data.tenants ?? []).map((t, i) => ({
      id: `spark-${i}`,
      client: t.business_line.toUpperCase(),
      env: t.env,
      tenant_name: t.tenant_name,
      url_href: `https://${t.tenant_name.replace(/^spark-/, "sparkui-")}.data.cloud.net.intra`,
      status: t.status,
      sync_argo: t.sync_argo,
      global_status: t.global_status,
      all_healthy: t.all_healthy,
      version: t.version,
      deprecated: t.deprecated,
      ibm_account: t.ibm_account,
      iks_cluster: t.iks_cluster,
      ok: t.all_healthy,
    }));
  }
  if (tech === "starburst") {
    return (data.instances ?? []).map((t, i) => ({
      id: `starburst-${i}`,
      client: t.business_line.toUpperCase(),
      env: t.env,
      url: t.url,
      url_href: `https://${t.url}.data.cloud.net.intra`,
      number_of_catalogs: t.number_of_catalogs,
      healthy_catalogs: t.healthy_catalogs,
      coordinator_uptime: t.coordinator_uptime,
      coordinator_health: t.coordinator_health,
      number_of_workers: t.number_of_workers,
      workers_health: t.workers_health,
      version: t.version,
      starburst_instance_health: t.starburst_instance_health,
      errors: t.errors,
      failed_catalogs: t.failed_catalogs,
      ok: t.starburst_instance_health === true && t.healthy_catalogs === t.number_of_catalogs,
    }));
  }
  if (tech === "dags") {
    return (data.dags ?? []).map((d, i) => ({
      id: `dags-${i}`,
      client: d.business_line.toUpperCase(),
      env: d.env,
      url: d.url,
      url_href: `https://${d.url}.data.cloud.net.intra`,
      dag_id: d.dag_id,
      is_paused: d.is_paused,
      state: d.state,
      execution_date: d.execution_date,
      start_date: d.start_date,
      delayed: d.delayed,
      error: d.error,
      ok: d.ok,
    }));
  }
  return (data.instances ?? []).map((t, i) => ({
    id: `airflow-${i}`,
    client: t.business_line.toUpperCase(),
    env: t.env,
    url: t.url,
    url_href: `https://${t.url}.data.cloud.net.intra`,
    version: t.version,
    http: t.http,
    dag_processor: t.dag_processor,
    scheduler: t.scheduler,
    trigger: t.trigger,
    meta_db: t.meta_db,
    error: t.error,
    ok: t.http === true && t.dag_processor === true && t.scheduler === true && t.trigger === true && t.meta_db === true,
  }));
}

// Fields whose transitions are worth surfacing in the change journal, per tech.
// Deliberately excludes purely descriptive fields (version, url, ibm_account...).
export const JOURNAL_FIELDS = {
  airflow: ["http", "dag_processor", "scheduler", "trigger", "meta_db"],
  spark: ["status", "sync_argo", "all_healthy"],
  starburst: ["coordinator_health", "workers_health", "starburst_instance_health"],
  dags: ["state", "delayed"],
};

export function isGoodValue(value) {
  if (typeof value === "boolean") return value === true;
  if (value === "Healthy" || value === "Synced" || value === "success") return true;
  if (value === "Degraded" || value === "OutOfSync" || value === "failed") return false;
  return Boolean(value);
}

// dags rows are one per (client, instance url, dag_id) — a client can have
// several instances sharing the same env, so env alone can't disambiguate.
// Every other tech is one row per (client, env).
export function rowKey(row) {
  return row.dag_id ? `${row.client}|${row.url}|${row.dag_id}` : `${row.client}|${row.env}`;
}
