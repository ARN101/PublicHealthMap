# PublicHealthMap

Bangladesh national critical-disease registry — Oracle Database Lab project (React + Express + local Oracle / PL/SQL).

## Run

```bash
npm run install-all
npm run dev
```

- App: http://localhost:3000  
- API: http://127.0.0.1:5000  

Configure `backend/.env` from `backend/.env.template` (Oracle + JWT / admin credentials).

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin (MoHFW) | `admin@health.gov.bd` | `admin123` |
| Hospital (DMCH Dhaka) | `hosp-1001-dhk@health.gov.bd` | `hospital123` |
| Researcher (IEDCR) | `iedcr@research.org.bd` | `research123` |

**Bulk seed credentials (same passwords):**
- **64 district hospitals** — email pattern `{license}@health.gov.bd` (e.g. `hosp-dhk-02@health.gov.bd`), password `hospital123`
- **12 research orgs** — universities (DU, BUET, CU, RU), medical (IEDCR, BSMMU, icddr,b), doctor networks, pharma (Square, Beximco, Incepta); password `research123`

## Patient identity rules

| Type | Format |
|------|--------|
| National ID (NID) | Digits only · **11** characters |
| Birth Certificate Number | Digits only · **17** characters |
| Mobile (BD) | `01[3-9]` + 8 digits |

Demo seed NID example: `10000000001`.

## Website structure

1. **Home** — landing  
2. **Public Surveillance** — category / disease / division filters, choropleth map, charts, top-10 index  
3. **Sign In** — Admin / Hospital / Researcher  
4. **Hospital Registration** — facility signup (Pending → Admin approval)  
5. **Researcher Registration** — org signup (Pending → Admin approval)  
6. **Hospital Portal** — patient lookup + disease-specific case forms  
7. **Research Portal** — anonymized JSON export (multi disease + division filters)  
8. **Admin Desk** — approvals, disease registry, form builder  

## Database scripts (run once on a fresh Oracle schema)

```bash
node backend/scripts/create-tables.js
node backend/scripts/create-triggers.js
node backend/scripts/create-indexes.js
node backend/scripts/create-compound-trigger.js
node backend/scripts/setup-packages.js
node backend/scripts/setup-case-pkg.js
node backend/scripts/setup-stats-proc.js
node backend/scripts/setup-research-pkg.js
node backend/scripts/setup-disease-taxonomy.js
node backend/scripts/setup-disease-forms.js
node backend/scripts/setup-body-images.js
node backend/scripts/migrate-images-to-blob.js
node backend/scripts/migrate-hospital-approval.js
node backend/scripts/setup-auth-credentials.js
node backend/scripts/seed-demo-data.js
```

`seed-demo-data.js` loads **64 district hospitals**, ~100 patients, epidemiologically skewed cases, and **12 research organizations**, then refreshes stats.

## Automated tests

Backend must be running (`npm run dev` or `node backend/server.js`). Frontend required for Playwright.

```bash
# API smoke + seed minima
node backend/scripts/e2e-verify.js

# Full API lifecycle (register/approve/case/export/admin)
node backend/scripts/e2e-full.js

# Browser journeys (Playwright)
cd frontend
npm run test:e2e
```
