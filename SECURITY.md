# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Project Singularity, **please do not open a public GitHub issue.**

Instead, report it privately:

1. **Email:** Send details to the repository owner via GitHub (see profile)
2. **GitHub Private Advisories:** Use the [Security Advisory](https://github.com/xxxASHxxx/project-singularity/security/advisories/new) feature to report privately

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 1 week
- **Fix:** Depends on severity; critical issues are prioritized

## Security Design

### What this project does NOT do

- **No facial recognition** — The person detector counts bodies in a zone using bounding boxes only. No biometric data is captured, stored, or processed.
- **No real payments by default** — Razorpay runs in TEST mode. No real money is charged unless you explicitly swap to live keys.
- **No PII collection** — Telemetry contains only zone occupancy counts and shelf fill ratios. No personally identifiable information.

### Safety rails

| Control | Description |
|---------|-------------|
| `AUTO_APPROVE=false` | All missions require human approval before agents act |
| Test-mode payments | Razorpay TEST keys — no real transactions |
| Sandboxed supplier | Mock supplier is a local-only site; never targets real vendors |
| Webhook verification | HMAC-SHA256 signature verification on all Razorpay webhooks |
| CORS restrictions | API only accepts requests from the configured frontend origin |

### Secrets management

- **Never commit `.env`** — it's in `.gitignore`
- API keys and secrets should only be set via `.env` or environment variables
- The `.env.example` file contains placeholder values for documentation only
- Docker Compose reads secrets from `.env` via variable interpolation

### Dependencies

- Keep dependencies updated. Run `npm audit` (frontend/mock-supplier) and `pip audit` (edge) periodically
- The CI pipeline runs on every push/PR to catch issues early
