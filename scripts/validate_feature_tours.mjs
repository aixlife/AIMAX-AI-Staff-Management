import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appHtmlPath = path.join(root, "oracle/aimax-reports-api/static/app.html");
const html = fs.readFileSync(appHtmlPath, "utf8");

function fail(title, items = []) {
  console.error(`[feature-tour] ${title}`);
  for (const item of items) console.error(`  - ${item}`);
  process.exit(1);
}

function objectBlock(name) {
  const match = html.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`));
  return match?.[1] || "";
}

function stringValuesFromObject(name) {
  const block = objectBlock(name);
  if (!block) fail(`missing object: ${name}`);
  return [...block.matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function stringEntriesFromObject(name) {
  const block = objectBlock(name);
  if (!block) fail(`missing object: ${name}`);
  return [...block.matchAll(/\b([A-Za-z0-9_]+):\s*"([^"]+)"/g)].map((match) => ({
    key: match[1],
    value: match[2],
  }));
}

const dataGuideIds = new Set([...html.matchAll(/\bdata-guide-id=(["'])([^"']+)\1/g)].map((match) => match[2]));
const guideIds = [...html.matchAll(/\bguideId:\s*"([^"]+)"/g)].map((match) => match[1]);
const uniqueGuideIds = [...new Set(guideIds)];

if (!uniqueGuideIds.length) {
  fail("no guideId entries found in app.html");
}

const missingAnchors = uniqueGuideIds.filter((guideId) => !dataGuideIds.has(guideId));
if (missingAnchors.length) {
  fail("missing data-guide-id anchors", missingAnchors);
}

const featureTourBlock = objectBlock("featureTours");
if (!featureTourBlock) fail("missing object: featureTours");

const featureTourKeys = new Set(
  [...featureTourBlock.matchAll(/^      ([A-Za-z0-9_]+):\s*\{/gm)].map((match) => match[1])
);
if (!featureTourKeys.size) fail("no featureTours entries found");

const pageTourEntries = stringEntriesFromObject("pageFeatureTourMap");
const pageTourRefs = pageTourEntries.map((entry) => entry.value);
const missingPageTourRefs = pageTourRefs.filter((key) => !featureTourKeys.has(key));
if (missingPageTourRefs.length) {
  fail("pageFeatureTourMap references missing tour keys", missingPageTourRefs);
}

const requiredPageTourTabs = ["staff", "jobs", "settings", "updates", "feedback"];
const pageTourTabs = new Set(pageTourEntries.map((entry) => entry.key));
const missingPageTourTabs = requiredPageTourTabs.filter((tab) => !pageTourTabs.has(tab));
if (missingPageTourTabs.length) {
  fail("pageFeatureTourMap is missing required page guide tabs", missingPageTourTabs);
}

const helpTourRefs = stringValuesFromObject("helpMenuFeatureTourKeys");
const missingHelpTourRefs = helpTourRefs.filter((key) => !featureTourKeys.has(key));
if (missingHelpTourRefs.length) {
  fail("help menu references missing tour keys", missingHelpTourRefs);
}

const dashboardTourRefs = stringValuesFromObject("dashboardFeatureTourKeys");
const missingDashboardTourRefs = dashboardTourRefs.filter((key) => !featureTourKeys.has(key));
if (missingDashboardTourRefs.length) {
  fail("dashboard guide card references missing tour keys", missingDashboardTourRefs);
}

const requiredLaunchers = [
  "helpMenuBtn",
  "helpSiteTourBtn",
  "helpCurrentPageGuideBtn",
  "helpReportBtn",
  "dashboardSiteTourBtn",
  "dashboardSettingsGuideBtn",
  "yeriFirstJobGuideBtn",
];
const missingLaunchers = requiredLaunchers.filter((id) => !html.includes(`id="${id}"`));
if (missingLaunchers.length) {
  fail("missing guide launcher controls", missingLaunchers);
}

const removedDirectButtons = ["siteTourGuideBtn", "pageGuideBtn"].filter((id) => html.includes(id));
if (removedDirectButtons.length) {
  fail("legacy direct topbar guide buttons are still present", removedDirectButtons);
}

console.log(
  `[feature-tour] OK: ${uniqueGuideIds.length} guide anchors, ${featureTourKeys.size} tours, ${pageTourRefs.length} page map entries verified`
);
