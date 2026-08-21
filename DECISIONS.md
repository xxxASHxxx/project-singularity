# Project Singularity — Architecture Decisions

This file records every non-obvious decision made during construction without asking the user.

| # | Decision | Choice Made | Rationale |
|---|----------|-------------|------------|
| 1 | Person detector | YOLOv8n primary, OpenCV HOG fallback | Smallest YOLO model; zero-GPU; HOG needs no model download |
| 2 | Shelf fill algorithm | scikit-image SSIM primary, edge-density fallback | SSIM is well-tested; fallback works in CI without heavy deps |
| 3 | reorderBaseQty | 50 units | Round number good for demo math; configurable in zones.json |
| 4 | Pricing surge cap | +15% max | Verbatim from spec |
| 5 | Mock supplier port | 3001 | Avoids collision: Vite=5173, API=8080, MySQL=3306 |
| 6 | AUTO_APPROVE default | false | Spec hard requirement — safety rail |
| 7 | React Query polling interval | 4 seconds | Balances liveness vs. request load for a pitch demo |
| 8 | Mock supplier persistence | SQLite via better-sqlite3 | Zero-config; orders inspectable after demo with any SQLite viewer |
| 9 | Mock supplier framework | Next.js 14 App Router | Current LTS; clean separation of API routes and UI pages |
| 10 | Frontend state/fetching | React Query (TanStack Query v5) | Industry standard for polling/caching REST endpoints |
| 11 | SSE vs polling | Polling only (no SSE) | SSE adds connection management complexity; polling is reliable for a pitch |
| 12 | Mission creation on both flags | If surgeFlag=true → RESTOCK mission; if lowStockFlag=true → REPRICE mission; same event can create both | Decoupled handling per spec |
| 13 | Duplicate telemetry suppression | Unique index on (device_id, recorded_at); return existing mission ID on duplicate | Idempotency without complex distributed locking |
| 14 | Debounce for occupancy | 5-sample rolling average | Prevents camera noise from triggering missions |
| 15 | Shelf ROI comparison | SSIM against a calibrated reference frame | Calibration step makes baseline meaningful without any training data |
