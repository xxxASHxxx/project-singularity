# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

---

## [0.4.0] — 2026-09-24

### Added
- **Keyboard shortcuts overlay** — press `?` to see all available shortcuts; `Escape` intelligently closes overlay → drawer → nothing
- `useKeyboardShortcuts` hook for global keyboard event handling in the React app
- **Preflight API health check** in edge node — pings the API with exponential backoff before starting the main telemetry loop
- `--skip-healthcheck` CLI flag for the edge node to bypass the preflight check
- Health check reports DLQ buffered payload count on successful connection
- Unit tests for the preflight health check (success, failure, retry-recovery)
- `Makefile` with developer shortcuts (`make dev`, `make test`, `make lint`, etc.)
- `LICENSE` (MIT)
- GitHub Issue Templates for bug reports and feature requests
- This `CHANGELOG.md`

### Changed
- TopBar now shows `⌨ Press ? for shortcuts` instead of `⌨ ESC to close`
- Keyboard shortcuts overlay uses smooth fade-in and scale-in CSS animations

---

## [0.3.0] — 2026-09-21

### Added
- `SECURITY.md` with responsible disclosure policy and security design overview
- SECURITY.md link added to README repo layout

### Changed
- CI workflow: added Python linting with ruff and concurrency groups for Actions
- Added `pytest.ini` and `.dockerignore` for edge node

### Security
- Removed hardcoded secrets from `docker-compose.yml` — all sensitive values now read from env vars

---

## [0.2.0] — 2026-09-20

### Added
- GitHub Actions CI: edge node tests, Python lint (ruff), frontend type-check
- `CONTRIBUTING.md` with project structure, branch naming, and test commands
- `DECISIONS.md` architecture decision log (15 entries)
- `.editorconfig` for consistent formatting
- Pull request template (`.github/PULL_REQUEST_TEMPLATE.md`)

### Fixed
- Frontend: analytics panel now uses `replaceAll` for multi-underscore status labels
- Edge node: mock mode now loops indefinitely instead of stopping after one cycle
- Frontend Dockerfile: switched to `npm ci` for deterministic builds; added `.dockerignore`

---

## [0.1.0] — 2026-09-19

### Added
- Initial release
- Python CV edge node with YOLOv8n person detection and SSIM shelf-fill analysis
- Spring Boot REST API with telemetry ingestion, mission lifecycle, and Razorpay integration
- React "technical noir" command center dashboard
- Mock supplier (Next.js) for sandboxed demo orders
- Docker Compose orchestration for the full stack
- Mock mode for camera-free demos
- Dead-letter queue (DLQ) resilience in edge node
- Occupancy debounce (5-sample rolling average)
- Calibration tool for shelf baseline reference frame
- `README.md` with quick-start guide and troubleshooting
