# Project Singularity — Demo Checklist

Run these commands in order. Expected total time from clone to live demo: < 10 minutes.

## Prerequisites
- [ ] Docker Desktop running with Compose v2 (`docker compose version`)
- [ ] Python 3.10+ on PATH (`python --version`)
- [ ] Node.js 20+ on PATH (for local dev, optional if using Docker) (`node --version`)
- [ ] Ports free: 3306 (MySQL), 8080 (API), 3001 (Mock Supplier), 5173 (Frontend)

---

## Step 1: Clone and navigate
```bash
git clone <repo-url> project-singularity
cd project-singularity
```

## Step 2: Start the full stack
```bash
docker compose up --build
```

Expected output sequence:
1. `mysql` starts, runs health check
2. `api` waits for MySQL, then starts (watch for `Started SingularityApplication`)
3. `mock-supplier` builds and starts on port 3001
4. `frontend` builds and starts on port 5173 (via nginx)

Wait for all four to be green. Takes ~3–5 minutes on first run (Docker image pulls).

**Verify:**
- [ ] `curl http://localhost:8080/api/v1/products` returns 7 products (JSON array)
- [ ] `curl http://localhost:8080/api/v1/missions` returns `[]`
- [ ] Browser: http://localhost:5173 shows black command center
- [ ] Browser: http://localhost:3001 redirects to /catalog

---

## Step 3: Install edge node dependencies
```bash
pip install -r edge/requirements.txt
```

> **Note:** `ultralytics` installs YOLOv8n model (~6MB) on first detection run. This happens automatically.

---

## Step 4: Start the edge node in mock mode
```bash
python edge/main.py --mock
```

Expected output every 5 seconds:
```
10:15:25 [INFO] edge: [MOCK] occupancy=1 fill=85.0% surge=False low_stock=False
10:15:30 [INFO] edge: POST http://localhost:8080/api/v1/telemetry → 200
...
10:15:50 [INFO] edge: [MOCK] occupancy=5 fill=75.0% surge=False low_stock=False
10:15:55 [INFO] edge: [MOCK] occupancy=6 fill=72.0% surge=True low_stock=False
```

**Verify (at ~t=25s, surge fires):**
- [ ] Dashboard chart shows occupancy line crossing the surge threshold (red dashed line)
- [ ] A RESTOCK mission appears in the Mission Queue at PENDING_APPROVAL

**Verify (at ~t=40s, low-stock fires):**
- [ ] Dashboard chart shows fill ratio dropping below 20%
- [ ] A REPRICE mission appears in the Mission Queue at PENDING_APPROVAL

---

## Step 5: Approve missions (human-in-the-loop demo)

1. In the browser at http://localhost:5173
2. Find the RESTOCK mission in the Mission Queue
3. Click the green **✓ APPROVE** button
4. Confirm the status pill changes from PENDING → APPROVED
5. Repeat for the REPRICE mission

---

## Step 6: Simulate agent actions (demo stand-in)

For the pitch recording, use these curl commands to simulate what the Antigravity agents would do:

### Simulate Restock Agent
```bash
# Get the mission ID from the dashboard (e.g., mission #1)
MISSION_ID=1

# Update status to RUNNING
curl -X PATCH http://localhost:8080/api/v1/missions/$MISSION_ID/status \
  -H 'Content-Type: application/json' \
  -d '{"status": "RUNNING", "summary": "Navigating mock supplier, adding SKU-001 to cart"}'

# Post a plan artifact
curl -X POST http://localhost:8080/api/v1/missions/$MISSION_ID/artifacts \
  -H 'Content-Type: application/json' \
  -d '{
    "artifactType": "PLAN_MD",
    "storagePath": "## Restock Plan\n\n**Trigger:** shelfFillRatio=14.2 (threshold: 20)\n**SKU:** SKU-001 Premium Widget\n**Reorder Qty:** 43 units\n**Formula:** (100 - 14.2) / 100 * 50 = 42.9 ≈ 43\n\n### Steps\n1. Navigate http://localhost:3001/catalog\n2. Add SKU-001 qty=43 to cart\n3. Proceed to checkout\n4. Place order\n5. Screenshot confirmation"
  }'

# Post a screenshot artifact (URL to local confirmation page)
curl -X POST http://localhost:8080/api/v1/missions/$MISSION_ID/artifacts \
  -H 'Content-Type: application/json' \
  -d '{
    "artifactType": "SCREENSHOT",
    "storagePath": "http://localhost:3001/orders"
  }'

# Mark COMPLETED
curl -X PATCH http://localhost:8080/api/v1/missions/$MISSION_ID/status \
  -H 'Content-Type: application/json' \
  -d '{"status": "COMPLETED", "summary": "Order APX-ABC123 placed for 43x SKU-001 Premium Widget"}'
```

### Verify supplier order
- [ ] Browse to http://localhost:3001/orders — should show orders if agent ran
- [ ] Mission Detail Drawer in command center shows full artifact trail

---

## Step 7: Demo recording tips

- Use `--mock` mode always for recordings (deterministic)
- Keep both the command center (localhost:5173) and supplier site (localhost:3001) open in separate windows
- The surge fires at t≈25s, low-stock at t≈40s — have the approval ready
- Record at 1920×1080, 30fps
- Narrate from pitch/script.md

---

## Shutdown
```bash
docker compose down
```

To reset all data:
```bash
docker compose down -v  # removes MySQL volume
del mock-supplier\supplier.db  # removes SQLite orders
```
