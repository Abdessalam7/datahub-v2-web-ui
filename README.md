# Datahub V2 — Smoke Tests Monitoring

Web application for monitoring the health of data infrastructure components (Airflow, Spark, Starburst).

## Stack

|Component |Technology                              |
|----------|----------------------------------------|
|Backend   |FastAPI (Python)                        |
|Frontend  |React + Vite                            |
|Storage   |IBM Cloud Object Storage (S3-compatible)|
|Deployment|Docker / Kubernetes (IKS)               |

## Architecture

```
datahub-v2-monitoring/
├── backend/                  # FastAPI REST API
│   ├── main.py               # API routes + CORS
│   ├── cos_client.py         # JSON reader from IBM COS
│   ├── cache.py              # In-memory cache (TTL 5 min)
│   ├── config.py             # Environment variables
│   └── requirements.txt
├── frontend/                 # React/Vite app
│   ├── src/
│   │   ├── App.jsx               # Main component
│   │   ├── api.js                # HTTP calls to backend
│   │   ├── components/
│   │   │   ├── Hero.jsx          # Fixed brand band: combined uptime + tech-card tab switcher
│   │   │   ├── Sparkline.jsx     # Inline SVG trend for the combined uptime figure
│   │   │   ├── Filters.jsx       # Business line / environment filters
│   │   │   ├── StatusTable.jsx   # Results table
│   │   │   ├── StatusBadge.jsx   # OK / KO badge
│   │   │   └── UptimeChart.jsx   # 24h uptime charts (per system)
│   │   └── styles/global.css
│   ├── index.html
│   └── vite.config.js
└── scripts/                  # Conversion utilities
```

## Features

- **Command Center hero**: fixed brand band (does not follow the viewer's OS
  theme — deliberate, unlike the workspace below it) showing the combined
  uptime across all three systems, with a trend sparkline built from real
  history stored in the browser (not fabricated data — it starts empty and
  fills in after a few refresh cycles).
- **Tech cards as tab switcher**: Airflow / Spark / Starburst cards in the
  hero show each system's live status (dot + bar + OK/total) and switch the
  workspace below — all three are fetched every refresh cycle, so switching
  tabs is instant and every system's history keeps accumulating even while
  you're looking at another tab.
- **KPI row**: Total / OK / KO / Uptime % for the active system
- **Filters**: by business line and environment (dev / qual / int)
- **Accordion table**: grouped by business line, sortable columns
- **Flat view**: standard ungrouped table
- **CSV export**: export filtered data
- **Uptime charts**: 24h history global and per business line (localStorage)
- **Auto-refresh**: every 5 minutes, for all three systems at once
- **Status banner**: global green / red indicator per system

### Design

BNP Paribas green as brand accent, IBM Plex Sans/Mono for UI and data,
Fraunces (serif) for the hero uptime figure. See the design conversation in
the originating Claude session for the two earlier concept iterations.

## COS Data Format

JSON files are read from IBM COS:

|Tech     |COS Path                                    |
|---------|--------------------------------------------|
|Airflow  |`monitoring-web/input/airflow/status.json`  |
|Spark    |`monitoring-web/input/spark/status.json`    |
|Starburst|`monitoring-web/input/starburst/status.json`|

### Airflow Format

```json
{
  "generated_at": "2026-03-13T10:00:00+00:00",
  "instances": [
    {
      "business_line": "bcef",
      "env": "dev",
      "url": "astronomer-ap80414-dev-8d8300e8",
      "version": "3.4.1",
      "http": true,
      "dag_processor": true,
      "scheduler": true,
      "trigger": true,
      "meta_db": true,
      "error": null
    }
  ]
}
```

> Full URL is built as: `https://{url}.data.cloud.net.intra`  
> An instance is KO if **at least one** component is `false`.

### Spark Format

```json
{
  "generated_at": "2026-03-13T10:00:00+00:00",
  "tenants": [
    {
      "business_line": "bcef",
      "env": "dev",
      "tenant_name": "spark-ap80414-dev-80c2d1ff",
      "status": "Healthy",
      "sync_argo": "Synced",
      "global_status": "Synced",
      "all_healthy": true,
      "version": "4.1.4",
      "deprecated": false,
      "ibm_account": "5c2448e5383c47eab541c46a869b3b3e",
      "iks_cluster": "iks-ap80414-hprd-6274773f"
    }
  ]
}
```

> URL is built as: `https://sparkui-{tenant_name replacing "spark-"}.data.cloud.net.intra`

### Starburst Format

```json
{
  "generated_at": "2026-03-13T10:00:00+00:00",
  "instances": [
    {
      "business_line": "bcef",
      "env": "dev",
      "url": "starburst-ap80414-dev-8d8300e8",
      "number_of_catalogs": 21,
      "healthy_catalogs": 21,
      "coordinator_uptime": "10.55d",
      "coordinator_health": true,
      "number_of_workers": 3,
      "workers_health": true,
      "version": "474-e.8",
      "starburst_instance_health": true,
      "errors": null,
      "failed_catalogs": null
    }
  ]
}
```

> An instance is KO if `starburst_instance_health` is `false` or `healthy_catalogs < number_of_catalogs`.

## Local Setup

### Prerequisites

- Python 3.12+
- Node.js 18+

### Backend

```bash
cd backend
cp .env.example .env   # Fill in COS credentials
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8081
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Access: http://localhost:5173
```

## Environment Variables

`backend/.env` file:

```ini
COS_ENDPOINT_URL=https://s3.direct.<region>.cloud-object-storage.appdomain.cloud
COS_ACCESS_KEY_ID=<access_key>
COS_SECRET_ACCESS_KEY=<secret_key>
COS_REGION=us-east-1
COS_BUCKET_NAME=<bucket_name>
```

> ⚠️ Never commit the `.env` file (included in `.gitignore`)

## Tips

- Clear uptime chart history: run `localStorage.clear()` in the browser console
- Port already in use: `netstat -ano | findstr :8081` then `taskkill /PID <pid> /F`
- Upload file to COS: `rclone copyto <file> <bucket>:monitoring-web/input/<tech>/status.json`
