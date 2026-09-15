const BASE_URL = "/api";

export async function fetchStatus(tech) {
  const res = await fetch(`${BASE_URL}/status?tech=${tech}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
