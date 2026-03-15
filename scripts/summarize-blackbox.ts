import fs from "node:fs";
import path from "node:path";
import {
  readBlackBoxFile,
  summarizeBlackBox,
  writeSummaryReport,
} from "../ts/core/blackbox/summary";

function latestJsonl(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return files[0] ?? null;
}

function main() {
  const repoRoot = process.cwd();
  const eventsDir = path.resolve(repoRoot, "stress", "blackbox", "events");
  const reportsDir = path.resolve(repoRoot, "stress", "reports");

  const inputArg = process.argv[2];
  const inputFile = inputArg
    ? path.resolve(repoRoot, inputArg)
    : latestJsonl(eventsDir);

  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error("❌ No black box event file found.");
    process.exit(1);
  }

  const events = readBlackBoxFile(inputFile);
  const summary = summarizeBlackBox(events, inputFile);

  const base = path.basename(inputFile, ".jsonl");
  const outFile = path.join(reportsDir, `${base}.summary.json`);

  writeSummaryReport(summary, outFile);

  console.log(`✅ Summary written: ${outFile}`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
