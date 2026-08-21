# Project Singularity

An agentic edge-to-commerce demo system. A Python CV edge node detects zone occupancy and shelf fill, posts telemetry to a Spring Boot API, which triggers parallel AI agents (Restock, Pricing, Reporting) visible in a React "technical noir" command center.

## Quick Start (10 minutes from clone)

### Prerequisites
- Docker Desktop (with Compose v2)
- Python 3.10+ (for edge node)
- Node.js 20+ (for mock supplier dev mode)
- Java 21 + Maven (for API, or use the Docker build)

### 1. Start the full stack
```bash
cd project-singularity
docker compose up --build
```
This starts: MySQL 8, Spring Boot API (port 8080), Mock Supplier (port 3001), React Frontend (port 5173).

Wait for all services to report healthy (watch for `api | Started SingularityApplication`).

### 2. Run the edge node (mock mode — no webcam required)
```bash
pip install -r edge/requirements.txt
python edge/main.py --mock
```
Within 60 seconds, you'll see surge + low-stock events in the dashboard at http://localhost:5173.

### 3. Approve a mission
In the React command center, find the PENDING_APPROVAL mission in the Mission Queue and click **Approve**.

### 4. Watch the agents work
- Restock Agent places an order on the mock supplier at http://localhost:3001
- Pricing Agent adjusts prices via the API
- Reporting Agent assembles a full artifact trail

### Running with a real webcam
```bash
# Calibrate ROIs first (draws polygon on live frame)
python edge/calibrate.py --camera 0

# Then run live
python edge/main.py --camera 0
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

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:mysql://mysql:3306/singularity` | MySQL JDBC URL |
| `DB_USER` | `singularity` | DB username |
| `DB_PASSWORD` | `singularity_pass` | DB password |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:5173` | React app origin |
| `AUTO_APPROVE` | `false` | Skip approval gate |
| `SAMPLE_INTERVAL_SECONDS` | `5` | Edge node posting interval |
| `SURGE_THRESHOLD` | `4` | Occupancy count trigger |
| `LOW_STOCK_THRESHOLD` | `20` | Shelf fill ratio trigger |

## Repo Layout
```
project-singularity/
├── edge/                  # Python CV edge node
├── api/                   # Spring Boot REST API
├── mock-supplier/         # Mock vendor site (Next.js)
├── frontend/              # React command center
├── pitch/                 # Pitch script, checklist, diagram
├── docker-compose.yml
├── DECISIONS.md
└── README.md
```
