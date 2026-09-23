"""Mock payload sequence for --mock mode.

Ramps occupancy 0→6 to trigger surge, then drops shelf fill to trigger low-stock.
Both triggers fire within 60 seconds at 5s intervals.
"""
import datetime
import random
from typing import Any, Dict, Iterator, Optional

# Sequence of (zone_occupancy_count, shelf_fill_ratio)
# 12 samples × 5s = 60s total
MOCK_SEQUENCE = [
    (1, 85.0),   # t=0s  — quiet
    (2, 82.0),   # t=5s
    (3, 80.0),   # t=10s
    (4, 78.0),   # t=15s  — surge starts (count=4)
    (5, 75.0),   # t=20s  — surge confirmed
    (6, 72.0),   # t=25s  — surge confirmed again → fires SURGE event
    (5, 45.0),   # t=30s  — still busy, shelf getting low
    (4, 30.0),   # t=35s  — shelf dropping
    (3, 18.0),   # t=40s  — LOW STOCK (ratio=18 < threshold 20)
    (2, 15.0),   # t=45s  — confirmed
    (2, 12.0),   # t=50s  — very low
    (1, 10.0),   # t=55s  — resolved traffic, empty shelf
    # Continue cycling to keep dashboard alive during demo
    (2, 10.0),
    (3, 12.0),
    (4, 14.0),
    (5, 16.0),
    (4, 18.0),
    (3, 20.0),
    (2, 25.0),
    (1, 30.0),
]


def validate_telemetry_payload(payload: Dict[str, Any]) -> bool:
    """Validate telemetry payload structure, types, and expected value ranges."""
    required_keys = {"deviceId", "timestamp", "zoneOccupancyCount", "shelfFillRatio", "surgeFlag", "lowStockFlag"}
    if not required_keys.issubset(payload.keys()):
        return False

    if not isinstance(payload["deviceId"], str) or not payload["deviceId"]:
        return False

    if not isinstance(payload["timestamp"], str) or not payload["timestamp"].endswith("Z"):
        return False

    occupancy = payload["zoneOccupancyCount"]
    if not isinstance(occupancy, int) or occupancy < 0:
        return False

    fill = payload["shelfFillRatio"]
    if not isinstance(fill, (int, float)) or fill < 0.0 or fill > 100.0:
        return False

    if not isinstance(payload["surgeFlag"], bool) or not isinstance(payload["lowStockFlag"], bool):
        return False

    return True


def get_mock_sequence(
    device_id: str = "edge-node-01",
    jitter: bool = False,
    seed: Optional[int] = None
) -> Iterator[Dict[str, Any]]:
    """Infinite iterator that cycles through the mock sequence.

    Args:
        device_id: Identifier for the edge sensor node.
        jitter: If True, adds minor realistic sub-percent sensor fluctuations.
        seed: Optional RNG seed for deterministic jitter testing.
    """
    rng = random.Random(seed) if seed is not None else random.Random()
    idx = 0
    while True:
        occupancy, fill = MOCK_SEQUENCE[idx % len(MOCK_SEQUENCE)]

        if jitter:
            # Add small noise (-0.4% to +0.4%) while keeping within valid bounds
            noise = round(rng.uniform(-0.4, 0.4), 2)
            fill = max(0.0, min(100.0, round(fill + noise, 2)))

        surge_flag = occupancy >= 4
        low_stock_flag = fill <= 20.0

        yield {
            "deviceId": device_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
            "zoneOccupancyCount": occupancy,
            "shelfFillRatio": fill,
            "surgeFlag": surge_flag,
            "lowStockFlag": low_stock_flag,
            "cycleCount": idx // len(MOCK_SEQUENCE),
        }
        idx += 1
