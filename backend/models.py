from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AirflowComponent:
    status: str
    latest_heartbeat: Optional[str]

@dataclass
class AirflowComponents:
    scheduler:     AirflowComponent
    metadatabase:  AirflowComponent
    dag_processor: AirflowComponent
    triggerer:     AirflowComponent

@dataclass
class Check:
    id:              str
    label:           str
    instance:        str
    namespace:       str
    url:             str
    status_code:     int
    ok:              bool
    latency_ms:      int
    last_checked_at: str
    components:      Optional[AirflowComponents] = None

@dataclass
class Environment:
    name:   str
    checks: list[Check] = field(default_factory=list)

@dataclass
class Client:
    name:         str
    environments: list[Environment] = field(default_factory=list)

@dataclass
class StatusReport:
    generated_at: str
    clients:      list[Client] = field(default_factory=list)


def _component(d: dict) -> AirflowComponent:
    return AirflowComponent(
        status=d.get("status", "unknown"),
        latest_heartbeat=d.get("latest_heartbeat"),
    )

def _components(d: Optional[dict]) -> Optional[AirflowComponents]:
    if not d:
        return None
    return AirflowComponents(
        scheduler=     _component(d.get("scheduler",     {})),
        metadatabase=  _component(d.get("metadatabase",  {})),
        dag_processor= _component(d.get("dag_processor", {})),
        triggerer=     _component(d.get("triggerer",     {})),
    )

def parse_status_report(raw: dict) -> StatusReport:
    clients = []
    for c in raw.get("clients", []):
        envs = []
        for e in c.get("environments", []):
            checks = []
            for ch in e.get("checks", []):
                checks.append(Check(
                    id=              ch["id"],
                    label=           ch["label"],
                    instance=        ch["instance"],
                    namespace=       ch["namespace"],
                    url=             ch["url"],
                    status_code=     ch["status_code"],
                    ok=              ch["ok"],
                    latency_ms=      ch["latency_ms"],
                    last_checked_at= ch["last_checked_at"],
                    components=      _components(ch.get("components")),
                ))
            envs.append(Environment(name=e["name"], checks=checks))
        clients.append(Client(name=c["name"], environments=envs))
    return StatusReport(generated_at=raw["generated_at"], clients=clients)
