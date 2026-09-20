# Project Singularity

An agentic edge-to-commerce demo system. A Python CV edge node detects zone occupancy and shelf fill, posts telemetry to a Spring Boot API, which triggers parallel AI agents (Restock, Pricing, Reporting) visible in a React "technical noir" command center.

## What This Actually Does

1. **A camera watches a store shelf** — counts people in a zone and estimates how full the shelf is
2. **When things get busy or stock runs low** — the API creates a mission that needs human approval
3. **You approve it in the dashboard** — then AI agents automatically restock, reprice, and generate audit reports
4. **Everything is logged** — full artifact trail, no action without approval, no surprises

The whole loop runs in under 2 minutes from "shelf is getting empty" to "purchase order confirmed."

## Quick Start (10 minutes from clone)

### Prerequisites
- Docker Desktop (with Compose v2)
- Python 3.10+ (for running edge node locally — or just use Docker)
- Node.js 20+ (for mock supplier dev mode — optional)
- Java 21 + Maven (for API dev mode — optional)

### 1. Set up environment

```bash
cd project-singularity
cp .env.example .env    # defaults work fine for local dev
```

### 2. Start the full stack

```bash
docker compose up --build
```

This starts everything: MySQL 8, Spring Boot API (port 8080), Mock Supplier (port 3001), React Frontend (port 5173), and the Edge Node in mock mode.

Wait for all services to report healthy (watch for `api | Started SingularityApplication`).

### 3. Open the dashboard

Go to http://localhost:5173. Within 60 seconds, you'll see surge + low-stock events appear as the edge node replays its demo sequence.

### 4. Approve a mission

In the React command center, find the PENDING_APPROVAL mission in the Mission Queue and click **Approve**.

### 5. Watch the agents work

- Restock Agent places an order on the mock supplier at http://localhost:3001
- Pricing Agent adjusts prices via the API
- Reporting Agent assembles a full artifact trail

### Running the edge node locally (instead of Docker)

```bash
pip install -r edge/requirements.txt

# Mock mode (no webcam needed — great for demos)
python edge/main.py --mock

# Or with a real webcam:
python edge/calibrate.py --camera 0    # calibrate ROIs first
python edge/main.py --camera 0          # then run live
```

## Architecture

```
[Webcam] → [Python Edge Node] → POST /api/v1/telemetry → [Spring Boot API] → [MySQL]
                                                                   │
                                                         (threshold crossed)
                                                                   │
                                                       [Antigravity Agents]
                                                  Restock | Pricing | Reporting
                                                           │
                                              [React Command Center]
```

## Safety Rails

- `AUTO_APPROVE=false` (default): all missions require human approval in the UI before agents act
- Mock supplier is a local sandboxed site — no real e-commerce targets
- No facial recognition or biometric code anywhere in this repo
- Razorpay runs in TEST mode — no real money is charged

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:mysql://mysql:3306/singularity` | MySQL JDBC URL |
| `DB_USER` | `singularity` | DB username |
| `DB_PASSWORD` | `singularity_pass` | DB password |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:5173` | React app origin |
| `AUTO_APPROVE` | `false` | Skip approval gate |
| `SURGE_THRESHOLD` | `4` | Occupancy count trigger |
| `LOW_STOCK_THRESHOLD` | `20` | Shelf fill ratio trigger |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | Razorpay test key |
| `RAZORPAY_KEY_SECRET` | `...` | Razorpay test secret |

See [`.env.example`](.env.example) for the full list with defaults you can copy.

## Repo Layout

```
project-singularity/
├── edge/                  # Python CV edge node (detection + telemetry posting)
├── api/                   # Spring Boot REST API (missions, products, analytics)
├── mock-supplier/         # Mock vendor site for demo orders (Next.js)
├── frontend/              # React command center dashboard
├── config/                # Shared config (zone ROIs, thresholds)
├── pitch/                 # Pitch script, checklist, architecture diagram
├── docker-compose.yml     # Full stack orchestration
├── .env.example           # Environment variable reference
├── CONTRIBUTING.md        # How to contribute
├── DECISIONS.md           # Architecture decision log
├── SECURITY.md            # Vulnerability reporting and security design
└── README.md
```

## Troubleshooting

**`docker compose up` fails with "port already in use"**
Something else is using port 3306, 8080, 3001, or 5173. Kill it or change the port mapping in `docker-compose.yml`.

**API keeps restarting with "Communications link failure"**
MySQL isn't ready yet. The API container has `depends_on: mysql` with a health check, but on slower machines it might need a minute. Just wait — it'll retry automatically.

**Edge node says "Config file not found"**
Make sure you're running from the project root: `python edge/main.py --mock`. The edge node looks for `config/zones.json` relative to the project root.

**Dashboard shows "API CONNECTION LOST" banner**
The Spring Boot API isn't reachable. Check that the `api` container is running (`docker compose ps`) and that port 8080 is exposed.

**"shelf_baseline.jpg not found" when running live mode**
You need to calibrate first: `python edge/calibrate.py --camera 0`. This captures a reference image of a full shelf. Not needed for `--mock` mode.

**Mock supplier build fails with "better-sqlite3" errors**
This needs native build tools. The Dockerfile handles this automatically, but if you're running locally: `npm install` requires Python 3 and a C++ compiler on your PATH.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style, and how to make changes.
