# EPG Simplecast Podcast Dashboard

React/Vite app tracking Frank LaRosa's podcast download performance.

- **Local:** `C:\Users\ECP\epg-simplecast-podcast\`
- **GitHub:** acostapabloEC/epg-simplecast-podcast
- **Vercel:** epg-simplecast-podcast.vercel.app ✓ auto-deploy on push
- **Password:** Elite2026

---

## Data sources — two separate feeds

### 1. Live Simplecast API (primary)

The dashboard fetches live episode + download data from Simplecast at runtime.

- **API Key:** `eyJhcGlfa2V5IjoiMzVmMTFkM2I5YTY2MmE1YWMxZDM5YjNjYjE0M2ZhMTcifQ==`
- Key stored in: `epg-marketing-dashboard\scraper\.env` as `SIMPLECAST_API_KEY`
- Set this on Vercel as an environment variable so the live dashboard can call the API

If the dashboard is pulling live, **it usually needs no weekly edit** — just verify it's showing the correct data after deployment.

### 2. Historical CSV (`public/data/downloads.csv`)

The dashboard also reads from this CSV for historical trend charting. If the CSV gets stale:
1. Export updated downloads data from Simplecast
2. Replace `public/data/downloads.csv`
3. Build and push

---

## Hardcoded constants in `App.jsx`

- `YOY_DATA` — year-over-year comparison array (update annually or when reference period changes)
- `DOW_DATA` — day-of-week download distribution (update if listening patterns shift significantly)

These don't need weekly updates.

---

## Weekly workflow

1. Visit the live URL and confirm episode count and recent download numbers look current
2. If stale: update `public/data/downloads.csv` from a Simplecast export
3. If `YOY_DATA` or `DOW_DATA` need refreshing, edit `src/App.jsx`
4. `npm run build` → `git push` (auto-deploys)

---

## Gotchas

- The API key is long and base64-encoded — double-check it when setting as a Vercel env var
- Do not commit `.env` files
- If the live Simplecast API call fails (CORS, key expired), the dashboard may show empty/zeros — check the browser console for API errors
