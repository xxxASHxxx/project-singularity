# Contributing to Project Singularity

Thanks for wanting to contribute! Here's how to get started without breaking anything.

## Getting the Dev Environment Running

1. Make sure you have Docker Desktop, Python 3.10+, and Node.js 20+ installed
2. Clone the repo and run `docker compose up --build`
3. Wait for the `Started SingularityApplication` log line
4. Run `pip install -r edge/requirements.txt` and `python edge/main.py --mock`

If everything went right, you should see telemetry flowing into the dashboard at http://localhost:5173 within a minute.

## Project Structure

| Directory | What it does | Language |
|-----------|-------------|----------|
| `api/` | Spring Boot REST API — telemetry ingestion, missions, products | Java 21 |
| `edge/` | Computer vision edge node — person + shelf detection | Python |
| `frontend/` | React command center dashboard | TypeScript |
| `mock-supplier/` | Sandboxed fake vendor site for demo | Next.js |
| `pitch/` | Demo script, checklist, architecture diagram | Markdown |
| `config/` | Shared config (zone ROI polygons, thresholds) | JSON |

## Branch Naming

Use descriptive branch names — no strict convention, just make it clear what you're working on:

- `fix/edge-crash-on-missing-config`
- `feat/add-dark-mode-toggle`
- `docs/update-setup-instructions`

## Making Changes

1. Create a branch off `main`
2. Make your changes — keep commits small and focused
3. Test locally:
   - **API:** `docker compose up api mysql` and run the integration tests
   - **Edge:** `cd edge && python -m pytest tests/ -v`
   - **Frontend:** `cd frontend && npm run build` (catches TypeScript errors)
4. Open a PR using the template

## Code Style

- **Python:** Standard PEP 8. We use `logging` instead of `print()` everywhere in production code.
- **Java:** Standard Spring Boot conventions. Flyway migrations for schema changes (never edit existing migrations).
- **TypeScript/React:** Functional components, hooks only. We use Tailwind for utility classes.
- **Commit messages:** Write them like you're telling a coworker what you did. No need for conventional commits or prefixes — just be clear.

## Things to Keep in Mind

- **Never** edit an existing Flyway migration file. Always create a new `V{N}__description.sql`.
- The `AUTO_APPROVE` flag defaults to `false` on purpose — it's a safety rail. Don't change that default.
- Mock supplier is intentionally sandboxed. Don't point agents at real e-commerce sites.
- If you add a new environment variable, document it in the README's env var table and in `.env.example`.

## Running Tests

```bash
# Edge node tests (Python)
cd edge && python -m pytest tests/ -v

# API integration tests (requires Docker)
cd api && mvn verify

# Frontend type check
cd frontend && npm run build
```

## Questions?

Open an issue or just ask in the PR. No dumb questions here.
