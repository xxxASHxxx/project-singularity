"""
Project Singularity — Agent Orchestration Stand-in Scripts

These Python scripts simulate what the three Antigravity Manager agents do.
Use them for:
  - Demo recordings without live Antigravity Manager access
  - Testing the full pipeline end-to-end
  - CI/CD verification

Usage:
  python edge/agent_orchestration.py restock   # run restock agent
  python edge/agent_orchestration.py pricing   # run pricing agent  
  python edge/agent_orchestration.py reporting # run reporting agent
  python edge/agent_orchestration.py all       # run all three in threads
"""
import sys
import json
import time
import math
import datetime
import threading
import logging
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S',
)

API_BASE = "http://localhost:8080"
SUPPLIER_BASE = "http://localhost:3001"
POLL_INTERVAL = 10  # seconds
REORDER_BASE_QTY = 50


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def api_get(path: str):
    r = requests.get(f"{API_BASE}{path}", timeout=10)
    r.raise_for_status()
    return r.json()


def api_patch(path: str, body: dict):
    r = requests.patch(f"{API_BASE}{path}", json=body, timeout=10)
    r.raise_for_status()
    return r.json()


def api_post(path: str, body: dict):
    r = requests.post(f"{API_BASE}{path}", json=body, timeout=10)
    r.raise_for_status()
    return r.json()


def post_artifact(mission_id: int, artifact_type: str, storage_path: str):
    api_post(f"/api/v1/missions/{mission_id}/artifacts", {
        "artifactType": artifact_type,
        "storagePath": storage_path,
    })


def set_status(mission_id: int, status: str, summary: str = None):
    body = {"status": status}
    if summary:
        body["summary"] = summary
    api_patch(f"/api/v1/missions/{mission_id}/status", body)


# ---------------------------------------------------------------------------
# Restock Agent
# ---------------------------------------------------------------------------
def restock_agent():
    log = logging.getLogger("restock-agent")
    log.info("Restock Agent started. Polling for APPROVED RESTOCK missions...")
    seen = set()

    while True:
        try:
            missions = api_get("/api/v1/missions?type=RESTOCK&status=APPROVED")
            for mission in missions:
                mid = mission["id"]
                if mid in seen:
                    continue
                seen.add(mid)
                log.info(f"Processing RESTOCK mission #{mid}")
                run_restock_mission(mission, log)
        except Exception as e:
            log.warning(f"Poll error: {e}")
        time.sleep(POLL_INTERVAL)


def run_restock_mission(mission: dict, log):
    mid = mission["id"]
    event_id = mission["triggeredByEventId"]

    # Get triggering event to compute reorder qty
    try:
        events = api_get(f"/api/v1/telemetry/latest?n=100")
        trigger_event = next((e for e in events if e["id"] == event_id), None)
        shelf_fill = trigger_event["shelfFillRatio"] if trigger_event else 14.2
    except Exception:
        shelf_fill = 14.2

    reorder_qty = max(1, round((100 - shelf_fill) / 100 * REORDER_BASE_QTY))

    # Get products
    products = api_get("/api/v1/products")
    target_sku = products[0]["sku"] if products else "SKU-001"
    target_name = products[0]["name"] if products else "Premium Widget"
    target_price = products[0]["currentPrice"] if products else 29.99

    # Set RUNNING
    set_status(mid, "RUNNING", f"Processing restock: {target_sku} x{reorder_qty}")

    # Post plan artifact BEFORE acting
    plan_md = f"""## Restock Agent — Mission #{mid}

**Trigger Event:** #{event_id}
**Shelf Fill Ratio:** {shelf_fill:.1f}% (threshold: 20%)
**Target SKU:** {target_sku} — {target_name}
**Reorder Quantity:** {reorder_qty} units
**Formula:** `(100 - {shelf_fill:.1f}) / 100 × {REORDER_BASE_QTY} = {reorder_qty}`

### Steps
1. Navigate mock supplier at {SUPPLIER_BASE}/catalog
2. Add {target_sku} qty={reorder_qty} to cart
3. Proceed to /cart → Place Order
4. Screenshot /orders/{{ref}} confirmation
5. POST screenshot artifact
6. Mark mission COMPLETED

### Safety
- Mission was at PENDING_APPROVAL until human approved it in the command center
- Supplier is a local sandbox (no real money, no real vendor)
"""
    post_artifact(mid, "PLAN_MD", plan_md)
    log.info(f"Mission #{mid}: Plan artifact posted")

    # Place order on mock supplier
    try:
        order_resp = requests.post(f"{SUPPLIER_BASE}/api/orders", json={
            "items": [{
                "sku": target_sku,
                "name": target_name,
                "price": target_price,
                "quantity": reorder_qty,
            }]
        }, timeout=10)
        order_resp.raise_for_status()
        order_data = order_resp.json()
        order_ref = order_data.get("orderRef", "APX-UNKNOWN")
        log.info(f"Mission #{mid}: Order placed → {order_ref}")

        # Post confirmation screenshot URL as artifact
        confirmation_url = f"{SUPPLIER_BASE}/orders/{order_ref}"
        post_artifact(mid, "SCREENSHOT", confirmation_url)

        # Mark completed
        set_status(mid, "COMPLETED",
                   f"Order {order_ref} placed: {reorder_qty}× {target_sku} ({target_name})")
        log.info(f"Mission #{mid}: COMPLETED ✓")

    except Exception as e:
        log.error(f"Mission #{mid}: Order failed: {e}")
        set_status(mid, "FAILED", f"Order placement failed: {e}")


# ---------------------------------------------------------------------------
# Pricing Agent
# ---------------------------------------------------------------------------
def pricing_agent():
    log = logging.getLogger("pricing-agent")
    log.info("Pricing Agent started. Polling for APPROVED REPRICE missions...")
    seen = set()

    while True:
        try:
            missions = api_get("/api/v1/missions?type=REPRICE&status=APPROVED")
            for mission in missions:
                mid = mission["id"]
                if mid in seen:
                    continue
                seen.add(mid)
                log.info(f"Processing REPRICE mission #{mid}")
                run_pricing_mission(mission, log)
        except Exception as e:
            log.warning(f"Poll error: {e}")
        time.sleep(POLL_INTERVAL)


def run_pricing_mission(mission: dict, log):
    mid = mission["id"]
    event_id = mission["triggeredByEventId"]

    # Get triggering event
    try:
        events = api_get(f"/api/v1/telemetry/latest?n=100")
        trigger_event = next((e for e in events if e["id"] == event_id), None)
        occupancy = trigger_event["zoneOccupancyCount"] if trigger_event else 6
        surge_threshold = 4
    except Exception:
        occupancy = 6
        surge_threshold = 4

    # Get products
    products = api_get("/api/v1/products")
    if not products:
        set_status(mid, "FAILED", "No products found")
        return

    # Pick first product for demo
    product = products[0]
    pid = product["id"]
    sku = product["sku"]
    before_price = float(product["currentPrice"])

    # Compute demand-based adjustment (capped at +15%)
    surge_multiplier = min(0.15, (occupancy / surge_threshold) * 0.10)
    after_price = round(before_price * (1 + surge_multiplier), 2)
    pct_change = (after_price - before_price) / before_price * 100

    set_status(mid, "RUNNING", f"Computing price adjustment for {sku}")

    # Write rationale artifact BEFORE making the change
    rationale_md = f"""## Pricing Agent — Mission #{mid}

**Trigger Event:** #{event_id}
**SKU:** {sku} — {product['name']}

### Price Adjustment Rationale
| Field | Value |
|-------|-------|
| Before Price | ${before_price:.2f} |
| After Price | ${after_price:.2f} |
| Change | +{pct_change:.1f}% |
| Zone Occupancy | {occupancy} (surge threshold: {surge_threshold}) |
| Surge Multiplier | {surge_multiplier:.2%} |
| Cap Applied | {'Yes (capped at 15%)' if surge_multiplier == 0.15 else 'No'} |

### Formula
```
surge_multiplier = min(0.15, ({occupancy} / {surge_threshold}) × 0.10) = {surge_multiplier:.4f}
new_price = ${before_price:.2f} × (1 + {surge_multiplier:.4f}) = ${after_price:.2f}
```

### Decision
Price increase justified by demand surge. Cap of +15% enforced.
No price change will be made without this artifact being recorded first.
"""
    post_artifact(mid, "PLAN_MD", rationale_md)
    log.info(f"Mission #{mid}: Rationale artifact posted (before price change)")

    # Apply price change
    try:
        api_patch(f"/api/v1/products/{pid}", {
            "currentPrice": after_price,
            "rationale": f"Demand surge: occupancy={occupancy}, multiplier={surge_multiplier:.2%}",
        })
        log.info(f"Mission #{mid}: Price updated {sku}: ${before_price:.2f} → ${after_price:.2f}")

        set_status(mid, "COMPLETED",
                   f"{sku}: ${before_price:.2f} → ${after_price:.2f} (+{pct_change:.1f}%)")
        log.info(f"Mission #{mid}: COMPLETED ✓")

    except Exception as e:
        log.error(f"Mission #{mid}: Price update failed: {e}")
        set_status(mid, "FAILED", f"Price update failed: {e}")


# ---------------------------------------------------------------------------
# Reporting Agent
# ---------------------------------------------------------------------------
def reporting_agent():
    log = logging.getLogger("reporting-agent")
    log.info("Reporting Agent started. Polling for COMPLETED missions...")
    seen = set()

    while True:
        try:
            missions = api_get("/api/v1/missions?status=COMPLETED")
            for mission in missions:
                mid = mission["id"]
                if mid in seen:
                    continue
                seen.add(mid)
                log.info(f"Assembling report for mission #{mid}")
                run_reporting_mission(mission, log)
        except Exception as e:
            log.warning(f"Poll error: {e}")
        time.sleep(15)


def run_reporting_mission(mission: dict, log):
    mid = mission["id"]

    # Fetch all artifacts for this mission
    try:
        artifacts = api_get(f"/api/v1/missions/{mid}/artifacts")
    except Exception:
        artifacts = []

    mission_type = mission.get("missionType", "UNKNOWN")
    status = mission.get("status", "UNKNOWN")
    summary = mission.get("summary", "No summary available")
    created_at = mission.get("createdAt", "")
    completed_at = mission.get("completedAt", "")

    # Assemble markdown report
    report_md = f"""## Mission #{mid} — Complete Audit Trail

**Type:** {mission_type}
**Status:** {status}
**Created:** {created_at}
**Completed:** {completed_at}
**Summary:** {summary}

---

### Trigger Event
Triggered by telemetry event #{mission.get('triggeredByEventId', '?')}

### Actions Taken
{summary}

### Artifact Trail ({len(artifacts)} artifacts)

"""
    for i, artifact in enumerate(artifacts, 1):
        atype = artifact.get("artifactType", "?")
        path = artifact.get("storagePath", "")
        ts = artifact.get("createdAt", "")
        report_md += f"{i}. **{atype}** — {ts}\n   - {path[:80]}{'...' if len(path) > 80 else ''}\n\n"

    report_md += f"""
---

*Report assembled by Reporting Agent at {datetime.datetime.utcnow().isoformat()}Z*
*All agent actions are logged above. No action was taken without a preceding PLAN_MD artifact.*
"""

    # Post as PLAN_MD artifact
    post_artifact(mid, "PLAN_MD", report_md)
    log.info(f"Mission #{mid}: Report artifact posted ✓")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"

    if cmd == "restock":
        restock_agent()
    elif cmd == "pricing":
        pricing_agent()
    elif cmd == "reporting":
        reporting_agent()
    elif cmd == "all":
        print("Starting all three agents in parallel threads...")
        threads = [
            threading.Thread(target=restock_agent, daemon=True, name="restock"),
            threading.Thread(target=pricing_agent, daemon=True, name="pricing"),
            threading.Thread(target=reporting_agent, daemon=True, name="reporting"),
        ]
        for t in threads:
            t.start()
        print("All agents running. Ctrl+C to stop.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down agents.")
    else:
        print(f"Unknown command: {cmd}. Use: restock | pricing | reporting | all")
        sys.exit(1)


if __name__ == "__main__":
    main()
