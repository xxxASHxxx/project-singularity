# Project Singularity — Developer Shortcuts
# Usage: make <target>

.PHONY: help dev down restart logs test lint clean nuke

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Docker ────────────────────────────────────────────────────

dev: ## Start the full stack (docker compose up --build)
	docker compose up --build

down: ## Stop all containers and remove orphans
	docker compose down --remove-orphans

restart: down dev ## Restart the full stack

logs: ## Tail logs from all containers
	docker compose logs -f --tail=100

logs-api: ## Tail API container logs only
	docker compose logs -f --tail=100 api

logs-edge: ## Tail edge node logs only
	docker compose logs -f --tail=100 edge

# ── Testing ───────────────────────────────────────────────────

test: test-edge test-frontend ## Run all tests

test-edge: ## Run Python edge node tests
	cd edge && python -m pytest tests/ -v

test-frontend: ## Run frontend type check (build)
	cd frontend && npm run build

test-api: ## Run API integration tests (requires Docker)
	cd api && mvn verify

# ── Linting ───────────────────────────────────────────────────

lint: ## Lint Python edge code with ruff
	cd edge && ruff check .

lint-fix: ## Lint and auto-fix Python edge code
	cd edge && ruff check --fix .

# ── Cleanup ───────────────────────────────────────────────────

clean: ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf api/target
	rm -rf frontend/dist
	rm -rf edge/logs/failed_payloads.jsonl

nuke: down ## Stop containers and destroy all volumes (⚠️ deletes DB data)
	docker compose down -v --remove-orphans
	@echo "\n⚠️  All volumes destroyed. Next 'make dev' starts fresh."

# ── Edge Node ─────────────────────────────────────────────────

mock: ## Run edge node in mock mode (no camera)
	python edge/main.py --mock

dlq-status: ## Show dead-letter queue status
	python edge/main.py --dlq-status

dlq-replay: ## Replay all buffered failed payloads
	python edge/main.py --replay-failed
