// Pure helpers for the CA court-holiday checker. CJS so Next and scripts/check.mjs can both load this file.

const DISCLAIMER = "Information only, not legal advice. This tool does not calculate filing deadlines. Courts can close for emergencies or local reasons; always confirm with the court clerk.";

const COUNTY_LOCATOR_URL = "https://courts.ca.gov/find-your-court";

const COUNTIES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa",
  "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo",
  "Kern", "Kings", "Lake", "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa",
  "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada", "Orange",
  "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino",
  "San Diego", "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo",
  "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra", "Siskiyou",
  "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity", "Tulare",
  "Tuolumne", "Ventura", "Yolo", "Yuba"
];

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FORBIDDEN_OUTPUT = [
  /you must file by/i,
  /statute of limitations/i,
  /AI lawyer/i
];

function parseIsoDate(iso) {
  const m = ISO_RE.exec(String(iso || "").trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function toIsoDate(dt) {
  return dt.toISOString().slice(0, 10);
}

function formatLongDate(iso) {
  const dt = parseIsoDate(iso);
  if (!dt) return "";
  return dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function addDays(dt, n) {
  const x = new Date(dt.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function holidayMap(dataset) {
  const map = new Map();
  for (const h of dataset.holidays || []) map.set(h.date, h);
  return map;
}

function holidaysInWindow(iso, dataset, days) {
  const span = days == null ? 14 : days;
  const dt = parseIsoDate(iso);
  if (!dt) return [];
  const start = toIsoDate(addDays(dt, -span));
  const end = toIsoDate(addDays(dt, span));
  return (dataset.holidays || []).filter(h => h.date >= start && h.date <= end)
    .map(h => ({ date: h.date, name: h.name, year: h.year, dateLabel: formatLongDate(h.date) }));
}

function nextBusinessDay(iso, dataset) {
  const start = parseIsoDate(iso);
  if (!start) return null;
  const named = holidayMap(dataset);
  let cur = addDays(start, 1);
  for (let i = 0; i < 366; i++) {
    const id = toIsoDate(cur);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6 && !named.has(id)) return id;
    cur = addDays(cur, 1);
  }
  return null;
}

function checkCourtDay(iso, dataset, county) {
  const dt = parseIsoDate(iso);
  if (!dt) return { ok: false, error: "Enter a valid date as YYYY-MM-DD." };
  const date = toIsoDate(dt);
  const dow = dt.getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const named = holidayMap(dataset);
  const holiday = named.get(date) || null;
  const closed = weekend || !!holiday;
  let reason;
  if (holiday && weekend) reason = `${holiday.name} (scheduled judicial holiday) and ${WEEKDAYS[dow]}`;
  else if (holiday) reason = `${holiday.name} (scheduled judicial holiday)`;
  else if (weekend) reason = `${WEEKDAYS[dow]}`;
  else reason = "Scheduled court business day";
  const next = nextBusinessDay(date, dataset);
  const years = dataset.coverageYears || [];
  const year = dt.getUTCFullYear();
  const coverageNote = years.length && !years.includes(year)
    ? `Named judicial holidays in this dataset cover ${years.join(" and ")}. Saturday and Sunday are still treated as closed.`
    : null;
  const countyName = COUNTIES.indexOf(county) >= 0 ? county : null;
  return {
    ok: true,
    date,
    dateLabel: formatLongDate(date),
    closed,
    reason,
    holidayName: holiday ? holiday.name : null,
    weekend,
    nextBusinessDay: next,
    nextBusinessDayLabel: next ? formatLongDate(next) : "",
    nearby: holidaysInWindow(date, dataset, 14),
    county: countyName,
    countyLocatorUrl: COUNTY_LOCATOR_URL,
    sourceUrl: dataset.primarySource.url,
    sourceTitle: dataset.primarySource.title,
    lastChecked: dataset.lastChecked,
    lastCheckedLabel: formatLongDate(dataset.lastChecked),
    coverageNote,
    disclaimer: DISCLAIMER
  };
}

function outputHasForbidden(text) {
  return FORBIDDEN_OUTPUT.some(re => re.test(String(text || "")));
}

module.exports = {
  DISCLAIMER,
  COUNTY_LOCATOR_URL,
  COUNTIES,
  FORBIDDEN_OUTPUT,
  parseIsoDate,
  toIsoDate,
  formatLongDate,
  holidaysInWindow,
  nextBusinessDay,
  checkCourtDay,
  outputHasForbidden
};
