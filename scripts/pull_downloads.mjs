/**
 * pull_downloads.mjs — append missing daily download rows from the Simplecast
 * Analytics API to public/data/downloads.csv. Self-contained: no laptop paths,
 * config via env vars. Idempotent and self-catching-up (fills from the day after
 * the CSV's last row through yesterday).
 *
 * Usage: SIMPLECAST_API_KEY=... node scripts/pull_downloads.mjs
 * Prints one JSON line. When GITHUB_OUTPUT is set, also writes step outputs.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'public', 'data', 'downloads.csv');
const PODCAST_ID = '2636c469-8b34-4ec7-8457-71f1b27ee304';

const fmtDate = (d) => d.toISOString().slice(0, 10);
const emit = (obj) => {
  console.log(JSON.stringify(obj));
  if (process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    appendFileSync(process.env.GITHUB_OUTPUT, lines);
  }
};

const key = process.env.SIMPLECAST_API_KEY;
if (!key) {
  console.error('Missing SIMPLECAST_API_KEY');
  process.exit(1);
}

const lines = readFileSync(CSV_PATH, 'utf8').trim().split('\n');
const header = lines[0];
const existingRows = lines.slice(1).map((l) => {
  const [pct, total, date] = l.split(',');
  return { pct, total, date };
});
const existingDates = new Set(existingRows.map((r) => r.date));
const lastDate = existingRows[existingRows.length - 1].date;

const start = new Date(lastDate + 'T00:00:00Z');
start.setUTCDate(start.getUTCDate() + 1);
const startDate = fmtDate(start);
const y = new Date();
y.setUTCDate(y.getUTCDate() - 1);
const endDate = fmtDate(y);

if (startDate > endDate) {
  emit({ status: 'up_to_date', rowsAdded: 0, lastDate });
  process.exit(0);
}

const url = `https://api.simplecast.com/analytics/downloads?podcast=${PODCAST_ID}&start_date=${startDate}&end_date=${endDate}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
if (!res.ok) {
  console.error(`Simplecast API error: HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const byInterval = (await res.json()).by_interval || [];
const newRows = byInterval
  .filter((r) => !existingDates.has(r.interval))
  .map((r) => ({ pct: r.downloads_percent, total: r.downloads_total, date: r.interval }))
  .sort((a, b) => (a.date < b.date ? -1 : 1));

if (newRows.length === 0) {
  emit({ status: 'no_new_rows', rowsAdded: 0, lastDate });
  process.exit(0);
}

const all = [...existingRows, ...newRows].map((r) => `${r.pct},${r.total},${r.date}`);
writeFileSync(CSV_PATH, [header, ...all].join('\n') + '\n', 'utf8');

emit({
  status: 'appended',
  rowsAdded: newRows.length,
  firstDate: newRows[0].date,
  lastDate: newRows[newRows.length - 1].date,
  totalDownloads: newRows.reduce((s, r) => s + Number(r.total), 0),
});
