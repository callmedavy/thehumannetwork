#!/usr/bin/env node
/**
 * Verifies the device-local read set in src/lib/readSet.ts.
 *
 * Run with `npm run verify:read-set`. The module touches `localStorage` at import time, so this
 * harness stubs it, transpiles the real source with the repo's own TypeScript, and exercises the
 * behaviour the feed depends on: ap_id keying, the instance-scoped fallback, persistence across a
 * reload, the FIFO cap, and the quota-failure path.
 *
 * The ap_id cases matter most. Keying on the numeric `post.id` looks equivalent in testing and is
 * wrong in production, because Lemmy assigns ids per instance: the same integer is a different
 * post on a different instance, so an id-keyed set hides the wrong things.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "src", "lib", "readSet.ts");
const STORAGE_KEY = "swimmey:read-posts";
const CAP = 20000;

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-read-set-"));
const outFile = path.join(outDir, "readSet.js");
const compiled = ts.transpileModule(fs.readFileSync(SOURCE, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
fs.writeFileSync(outFile, compiled.outputText);

const store = new Map();
global.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}
const reload = () => {
  delete require.cache[require.resolve(outFile)];
  return require(outFile);
};
const seed = (keys) => store.set(STORAGE_KEY, JSON.stringify(keys));

console.log("readSet: keying");
let readSet = reload();
check("ap_id is preferred over the numeric id", readSet.readKey("lemmy.world", { id: 42, ap_id: "https://lemmy.ml/post/7" }), "https://lemmy.ml/post/7");
check("falls back to an instance-scoped key", readSet.readKey("lemmy.world", { id: 42 }), "lemmy.world#42");
check("unkeyable before an instance is known", readSet.readKey("", { id: 42 }), null);

console.log("readSet: marking");
check("nothing is read to begin with", readSet.isPostRead("lemmy.world", { id: 42, ap_id: "https://lemmy.ml/post/7" }), false);
readSet.markPostRead("lemmy.world", { id: 42, ap_id: "https://lemmy.ml/post/7" });
check("a marked post reads back as read", readSet.isPostRead("lemmy.world", { id: 42, ap_id: "https://lemmy.ml/post/7" }), true);
check("the same ap_id on another instance is still the same post", readSet.isPostRead("lemmy.ml", { id: 9999, ap_id: "https://lemmy.ml/post/7" }), true);
check("a coincidental numeric id is NOT swept up", readSet.isPostRead("lemmy.ml", { id: 42 }), false);
readSet.markPostRead("lemmy.world", { id: 42, ap_id: "https://lemmy.ml/post/7" });
check("re-marking does not duplicate", readSet.readPostCount(), 1);

console.log("readSet: persistence");
readSet = reload();
check("survives a reload", readSet.isPostRead("lemmy.world", { id: 42, ap_id: "https://lemmy.ml/post/7" }), true);
check("persists under the swimmey: namespace", store.has(STORAGE_KEY), true);
store.set(STORAGE_KEY, "{not json");
readSet = reload();
check("a corrupt store degrades to empty", readSet.readPostCount(), 0);
store.delete(STORAGE_KEY);

console.log("readSet: cap");
seed(Array.from({ length: CAP }, (_, i) => `https://seed.example/post/${i}`));
readSet = reload();
check("loads at the cap", readSet.readPostCount(), CAP);
readSet.markPostRead("lemmy.world", { id: 1, ap_id: "https://newest.example/post/1" });
check("holds at the cap after an overflow write", readSet.readPostCount(), CAP);
check("keeps the newest key", readSet.isPostRead("lemmy.world", { id: 1, ap_id: "https://newest.example/post/1" }), true);
check("drops the oldest key", readSet.isPostRead("lemmy.world", { id: 0, ap_id: "https://seed.example/post/0" }), false);

console.log("readSet: clear");
readSet.clearReadPosts();
check("empties the in-memory set", readSet.readPostCount(), 0);
check("removes the storage key", store.has(STORAGE_KEY), false);
readSet = reload();
check("stays cleared across a reload", readSet.readPostCount(), 0);

console.log("readSet: quota exhaustion");
seed(Array.from({ length: CAP }, (_, i) => `https://seed.example/post/${i}`));
readSet = reload();
const QUOTA = 400000;
const realSetItem = global.localStorage.setItem;
global.localStorage.setItem = (key, value) => {
  if (value.length > QUOTA) throw new Error("QuotaExceededError");
  realSetItem(key, value);
};
readSet.markPostRead("lemmy.world", { id: 1, ap_id: "https://newest.example/post/1" });
global.localStorage.setItem = realSetItem;
check("keeps the newest key in memory", readSet.isPostRead("lemmy.world", { id: 1, ap_id: "https://newest.example/post/1" }), true);
check("halves the persisted set instead of losing it", JSON.parse(store.get(STORAGE_KEY)).length, CAP / 2);

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);