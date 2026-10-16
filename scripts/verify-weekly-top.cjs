#!/usr/bin/env node
/**
 * Verifies the Weekly Top 10 path: src/lib/weeklyTop.ts (the calendar windows) and
 * listWeeklyTopPosts in src/lib/lemmy.ts (the walks that reconstruct one week from Lemmy's
 * relative top-sorts, then merge several instances into one chart).
 *
 * Run with `npm run verify:weekly-top`. No browser and no network: `fetch` is replaced with
 * scripted pages, one script per fake host, so the paging rules and the merge can be pinned
 * exactly — how many requests a week costs, when a walk is allowed to stop, what happens when an
 * instance dies or rate-limits halfway, and which of two reports of the same post survives.
 *
 * Three groups of cases carry most of the weight.
 *
 * The windows, because Lemmy v3 has no absolute date filter: "the top ten of October 4-10" is
 * really "the top ten of whichever window we chose", and if a boundary drifts by a day or an hour
 * the chart quietly answers a different question. The DST cases are the ones that catch it, since
 * a week containing a transition is 167 or 169 hours, not 168.
 *
 * The early stop, because it is the only reason this feature is affordable: a walk is entitled to
 * stop once the tenth post in hand beats the last page's floor score, *and only then*. Getting
 * that condition wrong in either direction is invisible in a browser — too strict and every week
 * costs sixteen requests, too loose and the chart silently drops posts that belong in it.
 *
 * The merge, because it is what makes the chart the network's rather than one instance's. The same
 * post carries a different numeric id on every instance, so a merge keyed on anything but `ap_id`
 * is wrong in production and looks right in testing — the same trap `lib/readSet.ts` documents.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

// The window and DST cases are stated in US Eastern, so the harness re-executes itself in that
// zone rather than passing or failing on whatever the developer's machine is set to.
const TZ = "America/New_York";
if (process.env.TZ !== TZ) {
  const { spawnSync } = require("child_process");
  const result = spawnSync(process.execPath, [__filename], { stdio: "inherit", env: { ...process.env, TZ } });
  process.exit(result.status ?? 1);
}

const ROOT = path.join(__dirname, "..");
const SOURCES = ["src/lib/format.ts", "src/lib/weeklyTop.ts", "src/lib/lemmy.ts"];
const SIZE = 10;
const PAGE_SIZE = 50;

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-weekly-top-"));
SOURCES.forEach((relative) => {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(ROOT, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  fs.writeFileSync(path.join(outDir, path.basename(relative).replace(/\.ts$/, ".js")), compiled.outputText);
});

const weekly = require(path.join(outDir, "weeklyTop.js"));
const lemmy = require(path.join(outDir, "lemmy.js"));

let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}
function section(name) {
  console.log(`\nweeklyTop: ${name}`);
}

// --- the fake instances ---------------------------------------------------------------------
// Each case names the hosts it uses and gets a script for each of them. Hosts must not be shared
// between cases: the transport caches "does this host paginate by cursor?" per host for the
// session, so a later case would inherit an earlier one's answer.
let hosts = new Map();
let requests = [];

function script(host, pages, options = {}) {
  hosts.set(host, {
    pages,
    calls: 0,
    // `failFrom` models the 503 a real instance returns once a deep scan trips its rate limit.
    failFrom: options.failFrom ?? null,
    unreachable: Boolean(options.unreachable),
  });
}

function reset(pages, host = "one.test", options = {}) {
  hosts = new Map();
  requests = [];
  script(host, pages, options);
}

function addHost(host, pages, options = {}) {
  script(host, pages, options);
}

function fakeResponse(payload) {
  return {
    ok: true,
    status: 200,
    // Without this marker the transport treats the reply as the SPA fallback and retries direct.
    headers: { has: (name) => name === "x-lemmy-proxy" },
    json: async () => payload,
  };
}

global.fetch = async (url, init = {}) => {
  const parsed = new URL(url, "http://harness");
  // Proxied shape: /api/lemmy/<host>/api/v3/post/list?...   Direct: https://<host>/api/v3/...
  const host = parsed.pathname.startsWith("/api/lemmy/") ? parsed.pathname.split("/")[3] : parsed.hostname;
  requests.push({ host, params: parsed.searchParams, headers: init.headers });

  const target = hosts.get(host);
  if (!target || target.unreachable) throw new Error(`harness: ${host} is not answering`);
  target.calls += 1;
  if (target.failFrom !== null && target.calls >= target.failFrom) throw new Error("harness: 503");

  const cursor = parsed.searchParams.get("page_cursor");
  const found = cursor
    ? target.pages.find((candidate) => candidate.cursor === cursor)
    : target.pages[Number(parsed.searchParams.get("page") || 1) - 1];
  return fakeResponse(found ? { posts: found.posts, next_page: found.next_page } : { posts: [], next_page: null });
};

const WEEK = weekly.weekWindow(new Date("2026-10-07T12:00:00-04:00")); // Sunday October 4 to Saturday October 10, 2026

function published(dayOffset, time = "12:00:00") {
  const date = new Date(WEEK.start);
  date.setDate(date.getDate() + dayOffset);
  const [hour, minute, second] = time.split(":").map(Number);
  date.setHours(hour, minute, second, 0);
  return date.toISOString();
}

function post(id, score, when, extra = {}) {
  return {
    // `apId` is settable because the same post carries a different numeric id on every instance —
    // which is the whole reason the merge keys on ap_id rather than on the id.
    post: { id, name: `post ${id}`, published: when, ap_id: extra.apId ?? `https://lemmy.world/post/${id}`, ...(extra.url ? { url: extra.url } : {}) },
    creator: { id: 1, name: "harness" },
    community: { id: 1, name: "test", title: "test" },
    counts: { score, upvotes: extra.upvotes ?? score, downvotes: extra.downvotes ?? 0, comments: 0 },
  };
}

// A page is `{ cursor, posts, next_page }`; the stub serves it by cursor, or by page number when
// the page names no successor (the pre-0.19 shape).
function page(posts, { cursor = null, next = null } = {}) {
  return { cursor, posts, next_page: next };
}

function scoresOf(result) {
  return result.posts.map((item) => item.counts.score);
}
function idsOf(result) {
  return result.posts.map((item) => item.post.id);
}
function apIdsOf(result) {
  return result.posts.map((item) => item.post.ap_id);
}

// Single-instance cases pin the vantage list to the instance under test, so page and request
// counts describe one walk rather than five.
async function run(instance, week, options = {}) {
  return lemmy.listWeeklyTopPosts(instance, week, { vantagePoints: [], ...options });
}

(async () => {
  check("the harness runs in the zone the cases are written in", Intl.DateTimeFormat().resolvedOptions().timeZone, TZ);

  // --- calendar windows --------------------------------------------------------------------
  section("windows");
  const friday = new Date("2026-10-16T12:00:00-04:00");
  const weeks = weekly.completedWeeks(weekly.WEEKLY_TOP_WEEKS_OFFERED, friday);
  check("the picker offers a year of finished weeks", weeks.length, 52);
  check("the newest finished week starts on the Sunday before this one", weekly.formatWeekLabel(weeks[0]), "October 4-10, 2026");
  check("the week in progress is not offered", weeks.some((item) => weekly.formatWeekLabel(item) === "October 11-17, 2026"), false);
  check("newest first", weeks[0].start.getTime() > weeks[1].start.getTime(), true);
  check("the oldest offered week is a year back", Math.round((weeks[0].start.getTime() - weeks[51].start.getTime()) / 86_400_000 / 7), 51);
  check("no gap and no overlap between consecutive weeks", weeks.every((item, i) => i === 0 || item.end.getTime() === weeks[i - 1].start.getTime()), true);
  check("a week straddling a month names both", weekly.formatWeekLabel(weeks[1]), "September 27-October 3, 2026");
  check("a week straddling a year names both", weekly.formatWeekLabel(weekly.weekWindow(new Date("2026-12-30T15:00:00-05:00"))), "December 27, 2026-January 2, 2027");
  check("single-digit days read naturally", weekly.formatWeekLabel(weekly.weekWindow(new Date("2027-01-13T12:00:00-05:00"))), "January 10-16, 2027");

  section("window edges");
  check("starts at Sunday 00:00 local", WEEK.start.getDay() === 0 && WEEK.start.getHours() === 0 && WEEK.start.getMinutes() === 0, true);
  check("ends at the next Sunday 00:00 local", WEEK.end.getDay() === 0 && WEEK.end.getHours() === 0, true);
  check("keys itself by its own Sunday", WEEK.key, "2026-10-04");
  check("Sunday 00:00:00.000 is in", weekly.isWithinWeek(published(0, "00:00:00"), WEEK), true);
  check("Saturday 23:59:59 is in", weekly.isWithinWeek(published(6, "23:59:59"), WEEK), true);
  check("the following Sunday 00:00:00 is out", weekly.isWithinWeek(published(7, "00:00:00"), WEEK), false);
  check("the previous Saturday is out", weekly.isWithinWeek(published(-1, "23:59:59"), WEEK), false);

  section("daylight saving");
  const spring = weekly.weekWindow(new Date("2027-03-14T12:00:00-04:00"));
  const autumn = weekly.weekWindow(new Date("2026-11-01T12:00:00-05:00"));
  check("the spring-forward week is 167 hours", (spring.end.getTime() - spring.start.getTime()) / 3_600_000, 167);
  check("and still ends on a Sunday midnight", spring.end.getDay() === 0 && spring.end.getHours() === 0, true);
  check("the fall-back week is 169 hours", (autumn.end.getTime() - autumn.start.getTime()) / 3_600_000, 169);
  check("and still ends on a Sunday midnight", autumn.end.getDay() === 0 && autumn.end.getHours() === 0, true);

  section("sort window");
  const day = 86_400_000;
  check("a week inside the last month uses TopMonth", weekly.weeklyTopSort(weekly.weekWindow(new Date(Date.now() - 10 * day)), new Date()), "TopMonth");
  check("a week inside the last year uses TopYear", weekly.weeklyTopSort(weekly.weekWindow(new Date(Date.now() - 120 * day)), new Date()), "TopYear");
  check("an older week uses TopAll", weekly.weeklyTopSort(weekly.weekWindow(new Date(Date.now() - 800 * day)), new Date()), "TopAll");

  // --- the walk ----------------------------------------------------------------------------
  section("the common case: one request");
  // Twelve posts from the week, plus older and higher-scoring posts that must not be counted.
  reset([
    page([
      post(901, 9_000, published(-20)),                       // outside the week, top of the ranking
      ...Array.from({ length: 12 }, (_, i) => post(1 + i, 2_000 - i * 50, published(i % 7))),
      post(902, 900, published(-30)),                         // the floor of this page
    ], { cursor: "c1", next: "c2" }),
    page([post(903, 800, published(-40))], { cursor: "c2", next: null }),
  ]);
  let result = await run("one.test", WEEK);
  check("ten posts returned", result.posts.length, SIZE);
  check("ranked by score", scoresOf(result), [2000, 1950, 1900, 1850, 1800, 1750, 1700, 1650, 1600, 1550]);
  check("posts from outside the week are excluded", idsOf(result).includes(901) || idsOf(result).includes(902), false);
  check("the walk stopped at the first page", result.pagesScanned, 1);
  check("one request was made", requests.length, 1);
  check("and it was not capped", result.capped, []);
  check("the source is credited", result.sources, ["one.test"]);
  check("the ranking is asked for instance-wide", requests[0].params.get("type_"), "All");
  check("fifty at a time", requests[0].params.get("limit"), String(PAGE_SIZE));
  check("cursor paging begins with a page number", requests[0].params.get("page"), "1");

  section("a week that needs digging");
  // The tenth post only arrives on the third page, and only then does it beat that page's floor.
  reset([
    page([post(11, 1_600, published(0)), post(12, 1_550, published(1)), post(21, 1_500, published(-10))], { cursor: "d1", next: "d2" }),
    page([post(13, 1_400, published(2)), post(14, 1_300, published(3)), post(15, 1_250, published(4)), post(16, 1_210, published(5)), post(22, 1_200, published(-11))], { cursor: "d2", next: "d3" }),
    page([post(17, 1_100, published(0)), post(18, 1_050, published(1)), post(19, 1_000, published(2)), post(20, 950, published(3)), post(25, 900, published(6)), post(23, 890, published(-12))], { cursor: "d3", next: "d4" }),
    page([post(24, 100, published(-13))], { cursor: "d4", next: null }),
  ], "deep.test");
  result = await run("deep.test", WEEK);
  check("ten posts returned", result.posts.length, SIZE);
  check("three pages were enough", result.pagesScanned, 3);
  check("and the walk stopped there", requests.length, 3);
  check("nothing was capped", result.capped, []);
  check("the tenth post is the tenth best", scoresOf(result)[9], 950);
  check("the eleventh, still inside the week, is left out", idsOf(result).includes(25), false);

  section("a week the ranking cannot settle");
  // Every page's floor stays above the week's tenth post, so the walk may never claim completeness.
  reset([
    page([post(31, 6_000, published(-1)), post(32, 5_900, published(-2)), post(33, 5_800, published(-3))], { cursor: "e1", next: "e2" }),
    page([post(34, 5_700, published(-4)), post(35, 5_600, published(-5))], { cursor: "e2", next: "e3" }),
    page([post(36, 5_500, published(-6)), post(37, 5_400, published(-7))], { cursor: "e3", next: "e4" }),
    page([post(38, 5_300, published(-8))], { cursor: "e4", next: null }),
  ], "capped.test");
  result = await run("capped.test", WEEK, { maxPages: 3 });
  check("it stops at the page cap", result.pagesScanned, 3);
  check("three requests, no more", requests.length, 3);
  check("and it names the source it could not settle", result.capped, ["capped.test"]);
  check("returning only what it found", result.posts.length, 0);

  section("an instance that pages by number");
  reset([
    page([...Array.from({ length: PAGE_SIZE - 1 }, (_, i) => post(100 + i, 5_000 - i, published(-1))), post(41, 1_500, published(0))]),
    page([post(42, 1_400, published(1)), post(43, 1_300, published(2))]),
  ], "numbered.test");
  result = await run("numbered.test", WEEK, { maxPages: 5 });
  check("three in-week posts found across both pages", result.posts.length, 3);
  check("both pages were read", result.pagesScanned, 2);
  check("the second request advanced the page number", requests[1].params.get("page"), "2");
  check("with no cursor sent", requests[1].params.get("page_cursor"), null);
  check("a short page means the ranking ended, not a cap", result.capped, []);
  check("so the view can say how few there were", result.posts.length < SIZE, true);

  section("ranking and tie-breaks");
  reset([
    page([
      post(51, 1_000, published(1), { upvotes: 1_000, downvotes: 0 }),
      post(52, 1_000, published(2), { upvotes: 1_200, downvotes: 200 }), // same score, more upvotes
      post(53, 1_000, published(3), { upvotes: 1_200, downvotes: 200 }), // same again, newer
      post(54, 1_200, published(4)),
      post(55, 800, published(5)),
    ], { cursor: "f1", next: null }),
  ], "tie.test");
  result = await run("tie.test", WEEK);
  check("score first, then upvotes, then recency", idsOf(result), [54, 53, 52, 51, 55]);

  section("boundaries inside the walk");
  reset([
    page([
      post(61, 1_900, published(-1, "23:59:59")), // previous Saturday
      post(62, 1_800, published(0, "00:00:00")),  // the first instant of the week
      post(63, 1_700, published(6, "23:59:59")),  // the last instant of the week
      post(64, 1_600, published(7, "00:00:00")),  // the next Sunday
    ], { cursor: "g1", next: null }),
  ], "edge.test");
  result = await run("edge.test", WEEK);
  check("only the two instants inside the week are kept", idsOf(result), [62, 63]);

  section("cross-posts");
  reset([
    page([
      post(71, 1_500, published(0), { url: "https://example.com/one-story" }),
      post(72, 900, published(1), { url: "https://example.com/one-story" }),
      post(73, 1_400, published(2), { url: "https://example.com/another" }),
    ], { cursor: "h1", next: null }),
  ], "collapse.test");
  result = await run("collapse.test", WEEK, { collapseCrossPosts: true });
  check("one slot per link", idsOf(result), [71, 73]);
  check("the highest scoring copy keeps it", idsOf(result).includes(72), false);
  reset([
    page([
      post(71, 1_500, published(0), { url: "https://example.com/one-story" }),
      post(72, 900, published(1), { url: "https://example.com/one-story" }),
    ], { cursor: "h2", next: null }),
  ], "collapse-off.test");
  result = await run("collapse-off.test", WEEK, { collapseCrossPosts: false });
  check("with the setting off both copies show", idsOf(result), [71, 72]);

  section("credentials");
  reset([page([post(81, 1_000, published(0)), post(82, 900, published(1))], { cursor: "i1", next: null })], "guest.test");
  await run("guest.test", WEEK);
  check("a guest sends no auth", requests[0].params.get("auth"), null);
  check("and no show_read, which older instances reject without a token", requests[0].params.get("show_read"), null);
  check("and no bearer header", requests[0].headers.has("authorization"), false);
  reset([page([post(81, 1_000, published(0)), post(82, 900, published(1))], { cursor: "i2", next: null })], "reader.test");
  await run("reader.test", WEEK, { token: "jwt-token" });
  check("a signed-in reader asks for read posts too, because a chart is a record", requests[0].params.get("show_read"), "true");
  check("with the legacy query auth older instances expect", requests[0].params.get("auth"), "jwt-token");
  check("and the bearer header", requests[0].headers.get("authorization"), "Bearer jwt-token");

  section("sort choice reaches the wire");
  reset([page([post(91, 1_000, published(0))], { cursor: "j1", next: null })], "old-week.test");
  await run("old-week.test", weekly.weekWindow(new Date(Date.now() - 800 * day)));
  check("a two-year-old week asks for TopAll", requests[0].params.get("sort"), "TopAll");

  // --- merging across instances -------------------------------------------------------------
  section("vantage points");
  check("the shipped list is the one that was verified reachable", lemmy.WEEKLY_TOP_VANTAGE_POINTS, ["lemmy.world", "lemmy.ml", "midwest.social", "discuss.tchncs.de"]);
  reset([page([post(101, 1_000, published(0))], { cursor: "v1", next: null })], "lemmy.world");
  ["lemmy.ml", "midwest.social", "discuss.tchncs.de"].forEach((host, index) => {
    addHost(host, [page([post(200 + index, 900 - index, published(0))], { cursor: `v${index + 2}`, next: null })]);
  });
  result = await lemmy.listWeeklyTopPosts("lemmy.world", WEEK, {});
  check("a default chart reads every vantage point", Array.from(new Set(requests.map((entry) => entry.host))).sort(), ["discuss.tchncs.de", "lemmy.ml", "lemmy.world", "midwest.social"]);
  check("and shows what each of them saw", result.posts.length, 4);
  check("crediting all four", result.sources.slice().sort(), ["discuss.tchncs.de", "lemmy.ml", "lemmy.world", "midwest.social"]);

  section("a reader on a small instance");
  reset([page([post(111, 300, published(0))], { cursor: "w1", next: null })], "quiet.example");
  addHost("lemmy.world", [page([post(112, 1_000, published(0))], { cursor: "w2", next: null })]);
  result = await lemmy.listWeeklyTopPosts("quiet.example", WEEK, { vantagePoints: ["lemmy.world"] });
  check("their own instance is read alongside the big ones", Array.from(new Set(requests.map((entry) => entry.host))).sort(), ["lemmy.world", "quiet.example"]);
  check("and its posts reach the chart", apIdsOf(result).includes("https://lemmy.world/post/111"), true);

  section("merging two reports of the same post");
  // The same post carries a different numeric id on each instance; only ap_id identifies it.
  reset([page([post(201, 1_500, published(0), { apId: "https://lemmy.ml/post/77" }), post(202, 1_400, published(1))], { cursor: "m1", next: null })], "alpha.test");
  addHost("beta.test", [page([post(9_999, 1_575, published(0), { apId: "https://lemmy.ml/post/77" }), post(203, 3_000, published(2))], { cursor: "m2", next: null })]);
  result = await run("alpha.test", WEEK, { vantagePoints: ["beta.test"] });
  check("the union of both sources, ranked", idsOf(result), [203, 9_999, 202]);
  check("one row for the post, not one per instance", result.posts.filter((item) => item.post.ap_id === "https://lemmy.ml/post/77").length, 1);
  check("keeping the higher of the two scores", result.posts.find((item) => item.post.ap_id === "https://lemmy.ml/post/77").counts.score, 1_575);
  check("both sources credited", result.sources.slice().sort(), ["alpha.test", "beta.test"]);

  section("the same story cross-posted to two communities");
  reset([page([
    post(301, 1_500, published(0), { apId: "https://a.test/post/1", url: "https://example.com/story" }),
    post(302, 1_200, published(1), { apId: "https://b.test/post/1", url: "https://example.com/story" }),
  ], { cursor: "x1", next: null })], "story.test");
  result = await run("story.test", WEEK, { collapseCrossPosts: true });
  check("collapsed once more across the union", idsOf(result), [301]);
  reset([page([
    post(301, 1_500, published(0), { apId: "https://a.test/post/1", url: "https://example.com/story" }),
    post(302, 1_200, published(1), { apId: "https://b.test/post/1", url: "https://example.com/story" }),
  ], { cursor: "x2", next: null })], "story-off.test");
  result = await run("story-off.test", WEEK, { collapseCrossPosts: false });
  check("with the setting off, both communities keep their copy", idsOf(result), [301, 302]);

  section("a source that never answers");
  reset([page([post(401, 1_000, published(0)), post(402, 900, published(1))], { cursor: "n1", next: null })], "alive.test");
  addHost("dead.test", [], { unreachable: true });
  result = await run("alive.test", WEEK, { vantagePoints: ["dead.test"] });
  check("the chart still draws", result.posts.length, 2);
  check("the silent source is named", result.silent, ["dead.test"]);
  check("the answering one is credited", result.sources, ["alive.test"]);

  section("a source that stops answering partway");
  reset([page([
    post(501, 1_000, published(0)), post(502, 900, published(1)), post(503, 800, published(2)),
    post(504, 700, published(3)), post(505, 600, published(4)), post(506, 500, published(5)),
  ], { cursor: "p1", next: "p2" })], "flaky.test", { failFrom: 2 });
  addHost("steady.test", [page([post(521, 5_000, published(0))], { cursor: "q1", next: null })]);
  result = await run("flaky.test", WEEK, { vantagePoints: ["steady.test"] });
  check("what the flaky source did read is kept", idsOf(result).includes(501), true);
  check("it is named as interrupted", result.interrupted, ["flaky.test"]);
  check("and not counted among the silent", result.silent, []);
  check("the healthy source still contributes", idsOf(result).includes(521), true);
  check("this is not a page cap, it was cut short", result.capped, []);

  section("rate-limited on the second page");
  reset([page([post(601, 1_000, published(0)), post(602, 900, published(1))], { cursor: "r1", next: "r2" })], "limited.test", { failFrom: 2 });
  result = await run("limited.test", WEEK);
  check("a 503 on page two does not throw away page one", result.posts.length, 2);
  check("the source is reported as interrupted", result.interrupted, ["limited.test"]);
  check("and it is still credited", result.sources, ["limited.test"]);

  section("nothing answering at all");
  reset([], "gone.test", { unreachable: true });
  let thrown = null;
  try {
    await run("gone.test", WEEK);
  } catch (error) {
    thrown = error;
  }
  check("the failure surfaces instead of an empty chart", thrown instanceof Error, true);
  check("naming the instance", String(thrown && thrown.message).includes("gone.test"), true);

  section("one source down does not sink the chart");
  reset([], "gone.test", { unreachable: true });
  addHost("alive.test", [page([post(701, 1_000, published(0))], { cursor: "s1", next: null })]);
  result = await run("gone.test", WEEK, { vantagePoints: ["alive.test"] });
  check("the reader's own instance being down still leaves a chart", idsOf(result), [701]);
  check("with the dead one listed", result.silent, ["gone.test"]);

  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
