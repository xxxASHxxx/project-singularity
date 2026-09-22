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

