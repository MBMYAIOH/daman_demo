# Daman Claims Document Processing Interface

Browser interface for uploading member claim documents to an n8n workflow, reviewing the
extracted fields, and walking a claim through coding, document checklist, and adjudication
before resuming the workflow.

Built for Daman (National Health Insurance Company – Daman, UAE). All amounts are handled in AED.

## Layout

```
public/              everything the browser is allowed to fetch
  index.html           main reviewer interface
  confirmation.html    submission confirmation page
  config.js            client configuration and UAE field mappings
  logo.svg             Daman logo, also used as the favicon
cors-proxy.js        Express server: serves public/ and proxies to n8n
fixtures/            sample payloads for local testing (gitignored, never web-served)
render.yaml          Render blueprint
.env.example         environment variables, with placeholder values
```

Only `public/` is served. The proxy source, manifests, and the sample scan in `fixtures/`
are not reachable over HTTP.

## Local development

```bash
npm install
```

```bash
npm start
```

Open <http://localhost:3002>. The page and the proxy share an origin, so no extra
configuration is needed.

A `.env` file is required - the server exits immediately without `N8N_WEBHOOK_URL`.
Copy `.env.example` to `.env` and fill it in. `.env` is gitignored.

## Deployment (Render)

One web service hosts both the interface and the proxy, so they share an origin and
CORS never enters the picture. `render.yaml` is a ready blueprint: push the repo, then
**New -> Blueprint** in the Render dashboard.

Set these under **Environment** when prompted:

| Variable | Required | Notes |
|----------|----------|-------|
| `N8N_WEBHOOK_URL` | yes | The service will not start without it |
| `ALLOWED_WEBHOOK_HOSTS` | if resume URLs use a different host than the upload webhook | Comma-separated |

`PORT` is injected by Render and read automatically. Health checks hit `/health`.

Render's free plan sleeps after inactivity, so the first request after an idle period
takes roughly a minute. Use a paid instance for live demos.

### Why not Vercel

Vercel serverless functions cap request bodies at 4.5 MB, and this app accepts up to
5 files of 50 MB each - a single claim scan is already ~1.7 MB. Function duration limits
(60s Hobby, 300s Pro) are also tight for OCR and extraction. The proxy needs a normal
Node host. Any of Render, Railway, Fly, Cloud Run, or a plain VM works: they all need
only `npm start` and a `PORT` variable.

## Pre-deploy checklist

- [ ] `N8N_WEBHOOK_URL` set in the Render dashboard. It is not in the repo by design.
- [ ] `ALLOWED_WEBHOOK_HOSTS` covers every host the backend returns resume URLs on,
      otherwise claims fail at the "Proceed to Claim Summary" step.
- [ ] Confirm the deployment is access-controlled if real member data will pass through it.

## Configuration

Client configuration lives in `public/config.js`; server configuration comes from the
environment (see `.env.example`).

### Endpoints and limits

| Setting | Description | Default |
|---------|-------------|---------|
| `WEBHOOK_URL` | n8n webhook, used only in direct (non-proxy) mode | Required for direct mode |
| `USE_CORS_PROXY` | Route requests through the proxy | `true` |
| `CORS_PROXY_BASE_URL` | Resolved automatically: same origin when served over HTTP, `localhost:3002` for `file://` | auto |
| `MAX_FILE_SIZE` | Maximum file size in bytes | `52428800` (50 MB) |
| `MAX_FILES` | Maximum number of files per claim | `5` |
| `REQUIRED_FIELDS` | Fields the reviewer must fill before submitting | `['claimed_amount']` |
| `EITHER_OR_FIELDS` | At least one required | `[]` |

The proxy exposes `POST /upload`, `POST /resume`, and `GET /health`. File size and count
limits are enforced server-side as well as in the browser.

### Destination allowlist

`/upload` and `/resume` both receive their destination URL from the browser. The proxy
forwards only to hosts in `ALLOWED_WEBHOOK_HOSTS` (defaulting to the host of
`N8N_WEBHOOK_URL`) and rejects anything else with a 400. Without this, a publicly deployed
proxy would relay requests to arbitrary addresses on behalf of any caller.

### Branding

`CONFIG.BRAND` drives the page title, logo, headings, and currency. The colour palette
lives in the `:root` block at the top of `public/index.html`:

| Token | Value | Use |
|-------|-------|-----|
| `--brand` | `#882345` | Daman maroon — primary actions, headings, accents |
| `--brand-dark` / `--brand-darker` | `#6b1b36` / `#4f1428` | Hover and pressed states |
| `--brand-tint` / `-2` / `-3` | `#fdf7f9` / `#f7e9ee` / `#f1dbe2` | Panel and row backgrounds |
| `--navy` | `#003478` | Daman navy — secondary accent |

### UAE / Daman domain settings

| Setting | Description |
|---------|-------------|
| `NON_EDITABLE_FIELDS` | OCR-detected fields shown read-only (Emirates ID, licences, policy number, …) |
| `FIELD_LABELS` | Display names for raw field keys (`emirates_id` → "Emirates ID") |
| `PLANS` | Daman plans: Thiqa, Enhanced, Basic, Abu Dhabi Basic, Care, Premier |
| `CLAIM_TYPE_TO_BENEFIT` | Maps an extracted `claim_type` to a Daman benefit category |

## How it works

1. Reviewer uploads claim documents (claim form, invoice, receipt, prescription, medical report).
2. Files are posted to the n8n webhook, which extracts the fields and returns JSON with a `resumeUrl`.
3. The interface renders the extracted fields — editable ones first, OCR-detected ones read-only —
   each with its source image snippet.
4. **Proceed to Claim Summary** posts the corrected fields back to `resumeUrl`; n8n returns the
   medical coding and the document checklist.
5. **Proceed to Case Summary** posts again; n8n returns coverage, approval status, and the
   financial breakdown (benefit limit, excess, deductible, co-pay, member share) in AED.
6. **Save & Submit** resumes the workflow with the final reviewed data and lands on
   `confirmation.html`.

## Development mode

Set `DEV_MODE = true` in `public/index.html` to work against the built-in UAE mock claims
without calling n8n. Two console helpers are also available: `testCodingData()` and
`testSecondPayload()`.
