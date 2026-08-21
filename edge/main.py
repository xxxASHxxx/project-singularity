"""Project Singularity — Edge Telemetry Node.

Usage:
    python edge/main.py --camera 0          # live webcam
    python edge/main.py --mock              # replay canned sequence (no camera)
    python edge/main.py --mock --api-url http://localhost:8080
"""
import argparse
import json
import logging
import os
import sys
import time
from collections import deque
from pathlib import Path
from typing import Dict, Any, Optional

import requests

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('edge')

# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
CONFIG_PATH = ROOT / 'config' / 'zones.json'


def load_config() -> Dict[str, Any]:
    with open(CONFIG_PATH) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------
FAILED_LOG = Path(__file__).parent / 'logs' / 'failed_payloads.jsonl'
FAILED_LOG.parent.mkdir(exist_ok=True)


def post_telemetry(payload: Dict[str, Any], api_url: str, max_retries: int = 3) -> Optional[Dict]:
    url = f"{api_url}/api/v1/telemetry"
    for attempt in range(max_retries):
        try:
            r = requests.post(url, json=payload, timeout=5)
            r.raise_for_status()
            log.info(f"POST {url} → {r.status_code}")
            return r.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            log.warning(f"POST failed (attempt {attempt+1}/{max_retries}): {e}. Retrying in {wait}s")
            if attempt < max_retries - 1:
                time.sleep(wait)
    # All retries exhausted — log for later replay
    log.error("All retries failed. Saving payload to failed_payloads.jsonl")
    with open(FAILED_LOG, 'a') as f:
        f.write(json.dumps(payload) + '\n')
    return None


# ---------------------------------------------------------------------------
# Occupancy debounce
# ---------------------------------------------------------------------------
class OccupancyDebounce:
    """5-sample rolling average with surge detection."""
    def __init__(self, surge_threshold: int, window: int = 5):
        self.surge_threshold = surge_threshold
        self._window = deque(maxlen=window)
        self._consecutive_surge = 0

    def update(self, count: int) -> tuple:
        self._window.append(count)
        avg = sum(self._window) / len(self._window)
        smoothed = round(avg)
        if smoothed >= self.surge_threshold:
            self._consecutive_surge += 1
        else:
            self._consecutive_surge = 0
        # Fire surge event after 3 consecutive above-threshold samples
        surge_flag = self._consecutive_surge >= 3
        return smoothed, surge_flag


# ---------------------------------------------------------------------------
# Live camera loop
# ---------------------------------------------------------------------------
def run_live(args, cfg: Dict[str, Any]):
    import cv2
    import numpy as np
    sys.path.insert(0, str(ROOT / 'edge'))
    from detectors import PersonDetector, ShelfDetector

    SHELF_BASELINE = ROOT / 'config' / 'shelf_baseline.jpg'
    if not SHELF_BASELINE.exists():
        log.error("shelf_baseline.jpg not found. Run: python edge/calibrate.py first.")
        sys.exit(1)

    reference_frame = cv2.imread(str(SHELF_BASELINE))
    zone_roi = cfg['zone_roi']
    shelf_roi = cfg['shelf_roi']
    surge_threshold = cfg.get('surge_threshold', 4)
    low_stock_threshold = cfg.get('low_stock_threshold', 20)
    interval = cfg.get('sample_interval_seconds', 5)
    device_id = cfg.get('device_id', 'edge-node-01')

    person_detector = PersonDetector()
    shelf_detector = ShelfDetector(reference_frame, shelf_roi)
    debounce = OccupancyDebounce(surge_threshold)

    log.info(f"Person detector backend: {person_detector.backend}")
    log.info(f"Shelf detector backend: {shelf_detector._backend}")

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        log.error(f"Cannot open camera {args.camera}")
        sys.exit(1)

    log.info(f"Camera {args.camera} opened. Posting every {interval}s to {args.api_url}")
    last_post = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                log.warning("Frame capture failed; retrying")
                time.sleep(0.1)
                continue

            now = time.time()
            if now - last_post >= interval:
                occupancy_raw = person_detector.detect(frame, zone_roi)
                occupancy, surge_flag = debounce.update(occupancy_raw)
                fill_ratio = shelf_detector.compute_fill_ratio(frame)
                low_stock_flag = fill_ratio <= low_stock_threshold

                import datetime
                payload = {
                    'deviceId': device_id,
                    'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
                    'zoneOccupancyCount': occupancy,
                    'shelfFillRatio': round(fill_ratio, 2),
                    'surgeFlag': surge_flag,
                    'lowStockFlag': low_stock_flag,
                }
                log.info(f"Telemetry: occupancy={occupancy} fill={fill_ratio:.1f}% surge={surge_flag} low_stock={low_stock_flag}")
                post_telemetry(payload, args.api_url)
                last_post = now

            # Show preview
            if not args.headless:
                preview = frame.copy()
                pts = np.array(zone_roi, np.int32).reshape((-1, 1, 2))
                cv2.polylines(preview, [pts], True, (0, 255, 0), 2)
                shelf_pts = np.array(shelf_roi, np.int32).reshape((-1, 1, 2))
                cv2.polylines(preview, [shelf_pts], True, (255, 165, 0), 2)
                cv2.imshow('Singularity Edge Node', preview)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    finally:
        cap.release()
        cv2.destroyAllWindows()


# ---------------------------------------------------------------------------
# Mock mode loop
# ---------------------------------------------------------------------------
def run_mock(args, cfg: Dict[str, Any]):
    from mock_data import get_mock_sequence
    interval = cfg.get('sample_interval_seconds', 5)
    device_id = cfg.get('device_id', 'edge-node-01')
    sequence = get_mock_sequence(device_id)

    log.info(f"[MOCK MODE] Posting every {interval}s to {args.api_url}")
    log.info("Surge will fire at ~t=25s, low-stock at ~t=40s")

    for payload in sequence:
        log.info(
            f"[MOCK] occupancy={payload['zoneOccupancyCount']} "
            f"fill={payload['shelfFillRatio']}% "
            f"surge={payload['surgeFlag']} low_stock={payload['lowStockFlag']}"
        )
        post_telemetry(payload, args.api_url)
        time.sleep(interval)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='Project Singularity Edge Node')
    parser.add_argument('--camera', type=int, default=0, help='Camera index (default: 0)')
    parser.add_argument('--mock', action='store_true', help='Replay canned mock sequence (no camera)')
    parser.add_argument('--api-url', default=None, help='Spring Boot API base URL')
    parser.add_argument('--headless', action='store_true', help='Do not show preview window')
    args = parser.parse_args()

    cfg = load_config()
    if args.api_url is None:
        args.api_url = cfg.get('api_url', 'http://localhost:8080')

    log.info(f"API URL: {args.api_url}")

    if args.mock:
        run_mock(args, cfg)
    else:
        run_live(args, cfg)


if __name__ == '__main__':
    main()
