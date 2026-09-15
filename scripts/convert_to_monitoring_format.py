"""
convert_to_monitoring_format.py

Lit le fichier infra_status.json produit par pysmoke-test
et le convertit au format attendu par l'application de monitoring.

Usage:
    python convert_to_monitoring_format.py \
        --input  infra_status.json \
        --output airflow/status.json
"""

import json
import argparse
import re
from datetime import datetime, timezone


# ── Mapping instance → (client, env) ─────────────────────────────────────────
# À maintenir au fil des nouvelles instances.
INSTANCE_MAPPING = {
    "ap43877": ("BCEF",   "dev"),
    "ap91055": ("BCEF",   "dev"),
    "ap92045": ("PF",     "dev"),
    "ap11604": ("PF",     "qual"),
    "ap43970": ("Cardif", "qual"),
    "ap84264": ("Cardif", "qual"),
    "ap24216": ("BCEF",   "dev"),
    "ap75279": ("PF",     "dev"),
}

UNKNOWN_CLIENT = "unknown"
UNKNOWN_ENV    = "unknown"


def extract_instance_id(url: str) -> str:
    match = re.search(r"astronomer-(ap\d+)-", url)
    return match.group(1) if match else url


def all_components_healthy(components: dict) -> bool:
    return all(
        v.get("status") == "healthy"
        for v in components.values()
        if isinstance(v, dict)
    )


def build_component(raw: dict, heartbeat_key: str) -> dict:
    return {
        "status": raw.get("status", "unknown"),
        "latest_heartbeat": raw.get(heartbeat_key),
    }


def convert(raw: dict, tech: str = "airflow") -> dict:
    now = datetime.now(timezone.utc).isoformat()
    tree: dict[str, dict[str, list]] = {}
    tech_data = raw.get(tech, {})

    for url, result in tech_data.items():
        instance_id = extract_instance_id(url)
        client, env = INSTANCE_MAPPING.get(instance_id, (UNKNOWN_CLIENT, UNKNOWN_ENV))
        tree.setdefault(client, {}).setdefault(env, [])

        status     = result.get("status", "ERROR")
        components = result.get("components", {})
        error      = result.get("error")

        if status == "ERROR" or not components:
            check = {
                "id":              f"airflow-{instance_id}-{env}-health",
                "label":           "Airflow Health",
                "instance":        f"astronomer-{instance_id}",
                "namespace":       "airflow",
                "url":             url,
                "status_code":     0,
                "ok":              False,
                "latency_ms":      0,
                "last_checked_at": now,
                "error":           error,
                "components":      None,
            }
        else:
            ok = all_components_healthy(components)
            check = {
                "id":              f"airflow-{instance_id}-{env}-health",
                "label":           "Airflow Health",
                "instance":        f"astronomer-{instance_id}",
                "namespace":       "airflow",
                "url":             url,
                "status_code":     200 if ok else 503,
                "ok":              ok,
                "latency_ms":      0,
                "last_checked_at": now,
                "components": {
                    "dag_processor": build_component(
                        components.get("dag_processor", {}),
                        "latest_dag_processor_heartbeat"
                    ),
                    "metadatabase": build_component(
                        components.get("metadatabase", {}),
                        "latest_metadatabase_heartbeat"
                    ),
                    "scheduler": build_component(
                        components.get("scheduler", {}),
                        "latest_scheduler_heartbeat"
                    ),
                    "triggerer": build_component(
                        components.get("triggerer", {}),
                        "latest_triggerer_heartbeat"
                    ),
                },
            }

        tree[client][env].append(check)

    clients = []
    for client_name, envs in sorted(tree.items()):
        environments = []
        for env_name, checks in sorted(envs.items()):
            environments.append({"name": env_name, "checks": checks})
        clients.append({"name": client_name, "environments": environments})

    return {"generated_at": now, "clients": clients}


def main():
    parser = argparse.ArgumentParser(description="Convert infra_status.json to monitoring format")
    parser.add_argument("--input",  required=True, help="Path to infra_status.json")
    parser.add_argument("--output", required=True, help="Output path (e.g. airflow/status.json)")
    parser.add_argument("--tech",   default="airflow", help="Tech key in input JSON (default: airflow)")
    args = parser.parse_args()

    with open(args.input, "r") as f:
        raw = json.load(f)

    result = convert(raw, tech=args.tech)

    import os
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    with open(args.output, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✓ Converti → {args.output}")
    print(f"  Clients   : {[c['name'] for c in result['clients']]}")
    print(f"  Checks    : {sum(len(e['checks']) for c in result['clients'] for e in c['environments'])}")


if __name__ == "__main__":
    main()
