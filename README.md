<p align="center">
  <img src="docs/assets/banner.jpg" alt="Project Singularity" width="100%" />
</p>

<p align="center">
  <strong>An agentic edge-to-commerce intelligence system that watches a shelf, thinks about what it sees, and acts on it — with a human in the loop.</strong>
</p>

<p align="center">
  <a href="https://github.com/xxxASHxxx/project-singularity/actions/workflows/ci.yml"><img src="https://github.com/xxxASHxxx/project-singularity/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/java-21-ED8B00?logo=openjdk&logoColor=white" alt="Java" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
</p>

<br/>

> **Camera → Detection → Agents → Commerce.**  
> The whole loop runs in under 2 minutes — from "shelf is getting empty" to "purchase order confirmed."

<br/>

---

## 🎬 How it works

A camera watches a store shelf. When things change — too many people or too little stock — the system creates a **mission** that needs your approval. Once you approve, AI agents kick in automatically.

```
  📹 Webcam           🧠 Edge Node          ⚡ Spring Boot API         🗄️ MySQL
  ─────────  ──→  ─────────────────  ──→  ────────────────────  ──→  ─────────
  720p RGB         YOLOv8n persons          POST /api/v1/telemetry     Persists
  live feed        SSIM shelf-fill          Threshold checking         everything
                   every 5 seconds          Mission creation
```

When a threshold is crossed:

```
                         ┌──────────────────────────────────┐
                         │  ⚠  SAFETY RAIL                  │
                         │  AUTO_APPROVE = false             │
                         │  human must approve in dashboard  │
                         └──────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
            🔴 Restock Agent    🟠 Pricing Agent    ⚪ Reporting Agent
            Places purchase     Adjusts prices       Generates full
            orders on mock      (+15% cap on         audit trail with
            supplier site       surge pricing)       Markdown artifacts
```

Everything converges in the **React Command Center** — a technical noir dashboard where you watch telemetry flow, approve missions, and see agents work in real time.

<br/>

<p align="center">
  <img src="docs/assets/dashboard-preview.jpg" alt="Command Center Dashboard" width="90%" />
</p>
<p align="center"><em>The command center — live telemetry, mission queue, agent activity feed, system status. All in one place.</em></p>

<br/>

---

## 🚀 Quick Start

You can have the full system running in about 10 minutes. No cloud accounts needed.

### Prerequisites

| Tool | Version | Required? |
|------|---------|-----------|
| Docker Desktop | with Compose v2 | ✅ Yes |
| Python | 3.10+ | Only for local edge dev |
| Node.js | 20+ | Only for mock supplier dev |
| Java + Maven | 21 | Only for API dev |

### 1. Clone and configure

```bash
git clone https://github.com/xxxASHxxx/project-singularity.git
cd project-singularity
cp .env.example .env    # defaults work out of the box
```

### 2. Fire up the full stack

```bash
docker compose up --build
```

This starts **everything**: MySQL 8, Spring Boot API (`:8080`), Mock Supplier (`:3001`), React Frontend (`:5173`), and the Edge Node in mock mode.

Wait for `api | Started SingularityApplication` in the logs — that's your green light.

### 3. Open the dashboard

Head to **http://localhost:5173**. Within 60 seconds you'll see telemetry events start rolling in as the edge node replays its demo sequence.

### 4. Approve a mission

Find the `PENDING_APPROVAL` mission in the queue. Click **Approve**. That's the human-in-the-loop moment.

### 5. Watch agents work

- **Restock Agent** → browses the mock supplier, adds to cart, places a purchase order
- **Pricing Agent** → calculates a surge price adjustment (capped at +15%), writes a rationale
- **Reporting Agent** → assembles the full audit trail as Markdown artifacts

### Running the edge node locally

If you want to tinker with the edge node outside of Docker:

```bash
pip install -r edge/requirements.txt

# Mock mode — no webcam required, great for development
python edge/main.py --mock

# Live mode — with a real webcam
python edge/calibrate.py --camera 0    # capture shelf baseline first
python edge/main.py --camera 0          # then run live detection
```

<br/>

