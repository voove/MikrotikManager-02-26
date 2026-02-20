# 🛰️ MikroTik Manager

Remote fleet management for MikroTik LTE routers over SSTP VPN — with real-time monitoring, script execution, SMS commands, and a sleek dark dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Admin VM (Docker)                                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ Next.js  │  │ FastAPI  │  │ Celery Workers    │ │
│  │ Frontend │  │   API    │  │ + Beat Scheduler  │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│       │             │                │              │
│  ┌────▼─────────────▼────────────────▼──────────┐  │
│  │  PostgreSQL   InfluxDB   Redis               │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │ SSH over 10.199.199.x (SSTP VPN)
         ▼
┌────────────────────────────────┐
│  MikroTik ATL LTE Routers      │
│  10.199.199.10, .11, .12...    │
└────────────────────────────────┘
```

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/yourorg/mikrotik-manager.git
cd mikrotik-manager
```

### 2. Configure environment
```bash
cp .env.example .env
nano .env
```

Key values to set:
- `POSTGRES_PASSWORD` — strong password
- `INFLUX_PASSWORD` / `INFLUX_TOKEN` — strong values
- `SECRET_KEY` — 32+ char random string
- `SMTP_*` — your email server details
- `TWILIO_*` — Twilio credentials
- `SMS_WHITELIST` — comma-separated phone numbers that can send SMS commands
- `ALLOWED_EMAIL_DOMAINS` — restrict login emails by domain (e.g. `yourcompany.com`)

### 3. Launch
```bash
docker compose up -d
```

Dashboard available at: `http://localhost`

## Features

### 🟢 Heartbeat Monitoring
- Celery Beat polls every 60s via SSH (`:put ok`)
- Stores latency in InfluxDB, updates `last_seen` in Postgres
- Real-time online/offline indicator on dashboard
- Automatic offline alert creation when router goes down

### 📡 Signal Metrics
- RSSI, RSRP, RSRQ, SINR tracked over time
- Interactive line charts with reference lines (good/bad thresholds)
- Time range selector: 1h / 6h / 24h / 7d

### 🖥️ Script Runner
- One-click scripts from the router detail page
- Terminal output display
- Confirmation modal for dangerous scripts (reboot)
- Execution history with expandable output

### 📱 SMS Commands (via Twilio)
Configure your Twilio webhook URL to: `https://yourdomain.com/api/sms/inbound`

Available SMS commands:
```
SIGNAL R01       → LTE signal metrics
SIM R01          → SIM card info
REBOOT R01       → Reboot router
INFO R01         → System info
HELP             → Command list
```

Routers can be referenced by name or partial match. Only whitelisted numbers work.

### 🔐 Magic Link Auth
- Users request login link via email
- Link expires in 15 minutes
- JWT session token stored in cookie (7 day expiry)

## Adding Routers

Via API:
```bash
curl -X POST http://localhost/api/routers/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "R01-Site-Name",
    "ip_address": "10.199.199.10",
    "ssh_port": 22,
    "ssh_user": "admin",
    "ssh_password": "routerpassword",
    "location": "Site Name, City"
  }'
```

## RouterOS Script Notes

The scripts use MikroTik's `/interface lte monitor` command which requires:
- RouterOS 6.45+ for full LTE monitor support
- The LTE interface must be named (check with `/interface lte print`)
- User must have read access (or full admin)

## Development

```bash
# Backend only
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend only
cd frontend
npm install
npm run dev

# Celery worker
celery -A app.tasks.celery_app worker --loglevel=debug

# Celery beat (scheduler)
celery -A app.tasks.celery_app beat --loglevel=debug
```

## Adding New Scripts

Edit `backend/app/scripts/routeros.py` and add to the `SCRIPTS` dict:

```python
"my_script": {
    "label": "My Script",
    "description": "What it does",
    "icon": "cpu",
    "command": "/system resource print",
},
```

Then map the SMS command in `backend/app/services/sms.py`:
```python
SMS_COMMANDS = {
    "MYCOMMAND": "my_script",
    ...
}
```

## Project Structure

```
mikrotik-manager/
├── backend/
│   └── app/
│       ├── api/          # FastAPI route handlers
│       ├── core/         # Config, DB, InfluxDB
│       ├── models/       # SQLAlchemy models
│       ├── schemas/      # Pydantic schemas
│       ├── scripts/      # RouterOS script library
│       ├── services/     # SSH, auth, SMS
│       └── tasks/        # Celery tasks
├── frontend/
│   └── src/
│       ├── app/          # Next.js pages
│       ├── components/   # React components
│       └── lib/          # API client, types
├── nginx/
└── docker-compose.yml
```
