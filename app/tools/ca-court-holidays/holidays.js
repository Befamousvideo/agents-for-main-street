// Pure helpers for the CA court-holiday checker. CJS so Next and scripts/check.mjs can both load this file.

const DISCLAIMER = "Information only, not legal advice. This page shows the statewide California judicial holidays published by the Judicial Branch for 2026 and 2027. It does not calculate filing deadlines or count court days. Federal courts follow a different holiday schedule. A court can also close for emergencies or local reasons, so check with that court's clerk before relying on a date. This site is not affiliated with the California courts.";

const NOT_COVERED_TEXT = "This checker only has the published California court holiday lists for 2026 and 2027, so it cannot say whether courts are open on this date. Saturdays and Sundays are always court holidays.";

const CONFIRM_AMBIGUOUS = "Confirm with the court before relying on this date.";

const FARMWORKERS_NOTE = "Farmworkers Day moves from March 31 to April 10 starting in 2027 (SB 1394). April 10, 2027 is a Saturday, so the statewide court list shows Friday, April 9. March 31, 2027 is not on the statewide court holiday list.";

const NEXT_OUTSIDE_LABEL = "Next weekday that is not a weekend, a listed 2026–2027 holiday, or a date marked likely closed (2028 court holidays are not in this checker yet)";

const LIKELY_CLOSED_LIST_SUFFIX = " (likely closed; not yet on the statewide list)";

const COUNTY_LOCATOR_URL = "https://courts.ca.gov/find-your-court";

const SOURCE_LINKS = [
  { href: "https://courts.ca.gov/about/court-holidays", label: "Judicial Branch Court Holidays list (courts.ca.gov/about/court-holidays)" },
  { href: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=135.", label: "Code of Civil Procedure section 135" },
  { href: "https://courts.ca.gov/cms/rules/index/one/rule1_11", label: "California Rules of Court, rule 1.11" }
];

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
  /AI lawyer/i,
  /last day to file/i,
  /deadline is/i,
  /you should/i
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

function ambiguousMap(dataset) {
  const map = new Map();
  for (const a of dataset.ambiguous || []) map.set(a.date, a);
  return map;
}

function yearCovered(iso, dataset) {
  const dt = parseIsoDate(iso);
  if (!dt) return false;
  const years = dataset.coverageYears || [];
  return years.length === 0 || years.indexOf(dt.getUTCFullYear()) >= 0;
}

function nearbyListText(item) {
  if (item.likelyClosed) return item.dateLabel + " — " + item.name + LIKELY_CLOSED_LIST_SUFFIX;
  return item.dateLabel + " — " + item.name;
}

function holidaysInWindow(iso, dataset, days) {
  const span = days == null ? 14 : days;
  const dt = parseIsoDate(iso);
  if (!dt) return [];
  const start = toIsoDate(addDays(dt, -span));
  const end = toIsoDate(addDays(dt, span));
  const rows = [];
  for (const h of dataset.holidays || []) {
    if (h.date < start || h.date > end) continue;
    const item = { date: h.date, name: h.name, year: h.year, dateLabel: formatLongDate(h.date), likelyClosed: false };
    item.listText = nearbyListText(item);
    rows.push(item);
  }
  for (const a of dataset.ambiguous || []) {
    if (a.date < start || a.date > end) continue;
    const item = { date: a.date, name: a.name, dateLabel: formatLongDate(a.date), likelyClosed: true };
    item.listText = nearbyListText(item);
    rows.push(item);
  }
  rows.sort((x, y) => x.date.localeCompare(y.date));
  return rows;
}

function nextBusinessDay(iso, dataset) {
  const start = parseIsoDate(iso);
  if (!start) return null;
  const named = holidayMap(dataset);
  const amb = ambiguousMap(dataset);
  let cur = addDays(start, 1);
  for (let i = 0; i < 366; i++) {
    const id = toIsoDate(cur);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6 && !named.has(id) && !amb.has(id)) return id;
    cur = addDays(cur, 1);
  }
  return null;
}

function checkCourtDay(iso, dataset, county) {
  const dt = parseIsoDate(iso);
  if (!dt) return { ok: false, error: "Enter a valid date as YYYY-MM-DD." };
  const date = toIsoDate(dt);
  const dateLabel = formatLongDate(date);
  const dow = dt.getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const named = holidayMap(dataset);
  const ambMap = ambiguousMap(dataset);
  const holiday = named.get(date) || null;
  const ambiguous = ambMap.get(date) || null;
  const covered = yearCovered(date, dataset);
  const countyName = COUNTIES.indexOf(county) >= 0 ? county : null;

  let closed = false;
  let likelyClosed = false;
  let notCovered = false;
  let status = "";
  let statusKind = "not-holiday";
  let reason = "";
  let confirmCaveat = null;
  let farmworkersNote = null;

  if (weekend) {
    closed = true;
    statusKind = "closed";
    status = "Closed on " + dateLabel;
    reason = WEEKDAYS[dow] + ".";
  } else if (holiday) {
    closed = true;
    statusKind = "closed";
    status = "Closed on " + dateLabel;
    reason = holiday.name + " (scheduled judicial holiday).";
  } else if (ambiguous) {
    likelyClosed = true;
    statusKind = "likely";
    status = "Likely closed: " + ambiguous.name;
    reason = ambiguous.detail;
    confirmCaveat = CONFIRM_AMBIGUOUS;
  } else if (!covered) {
    notCovered = true;
    statusKind = "uncovered";
    status = "Not covered";
    reason = NOT_COVERED_TEXT;
  } else {
    statusKind = "not-holiday";
    status = "Not a court holiday: " + dateLabel;
    reason = "Not a weekend or a published statewide court holiday.";
  }

  if (date === "2027-03-31" || date === "2027-04-09") farmworkersNote = FARMWORKERS_NOTE;

  const next = covered ? nextBusinessDay(date, dataset) : null;
  const nextOutsideCoverage = !!(next && !yearCovered(next, dataset));

  return {
    ok: true,
    date,
    dateLabel,
    closed,
    likelyClosed,
    notCovered,
    status,
    statusKind,
    reason,
    confirmCaveat,
    farmworkersNote,
    holidayName: holiday ? holiday.name : null,
    weekend,
    nextBusinessDay: next,
    nextBusinessDayLabel: next ? formatLongDate(next) : "",
    nextOutsideCoverage,
    nextOutsideLabel: NEXT_OUTSIDE_LABEL,
    nearby: holidaysInWindow(date, dataset, 14),
    county: countyName,
    countyLocatorUrl: COUNTY_LOCATOR_URL,
    sourceUrl: dataset.primarySource.url,
    sourceTitle: dataset.primarySource.title,
    lastChecked: dataset.lastChecked,
    lastCheckedLabel: formatLongDate(dataset.lastChecked),
    disclaimer: DISCLAIMER
  };
}

function outputHasForbidden(text) {
  return FORBIDDEN_OUTPUT.some(re => re.test(String(text || "")));
}

module.exports = {
  DISCLAIMER,
  NOT_COVERED_TEXT,
  CONFIRM_AMBIGUOUS,
  FARMWORKERS_NOTE,
  NEXT_OUTSIDE_LABEL,
  LIKELY_CLOSED_LIST_SUFFIX,
  COUNTY_LOCATOR_URL,
  SOURCE_LINKS,
  COUNTIES,
  FORBIDDEN_OUTPUT,
  parseIsoDate,
  toIsoDate,
  formatLongDate,
  holidaysInWindow,
  nearbyListText,
  nextBusinessDay,
  checkCourtDay,
  outputHasForbidden
};
