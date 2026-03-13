/**
 * Watches assets/covers/ and runs generate-covers.js when files are added/removed,
 * so new images (e.g. graduation_6.png) appear in the cover picker without restarting.
 * Run in a separate terminal: node scripts/watch-covers.js
 * Or run once: npm run generate-covers
 */
const fs = require("fs");
const path = require("path");

const COVERS_DIR = path.join(__dirname, "..", "assets", "covers");

function runGenerator() {
  try {
    require("./generate-covers.js");
  } catch (e) {
    console.error("generate-covers error:", e.message);
  }
}

if (!fs.existsSync(COVERS_DIR)) {
  console.warn("watch-covers: assets/covers not found, exiting");
  process.exit(1);
}

runGenerator();
console.log("watch-covers: watching", COVERS_DIR, "(add/remove images to auto-update covers)");

fs.watch(COVERS_DIR, { recursive: false }, (eventType, filename) => {
  if (!filename) return;
  if (!/\.(png|jpg|jpeg|webp)$/i.test(filename)) return;
  console.log("watch-covers:", filename, eventType);
  runGenerator();
});
