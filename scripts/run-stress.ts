import fs from "node:fs";
import path from "node:path";

type StressScenario = {
  name: string;
  description?: string;
  durationSeconds: number;
  pollIntervalMs: number;
  tests: string[];
};

type ObserverResponse = {
  ok: boolean;
  state?: unknown;
};

const OBSERVER_URL = "http://localhost:3001/api/observer";
const EVENTS_DIR = path.join(process.cwd(), "stress", "blackbox", "events");

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function timestampParts(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return {
    day: `${yyyy}${mm}${dd}`,
    stamp: `${yyyy}${mm}${dd}-${hh}${mi}${ss}`,
  };
}

async function fetchObserver(): Promise<ObserverResponse> {
  const res = await fetch(OBSERVER_URL);
  if (!res.ok) {
    throw new Error(`Observer API returned ${res.status}`);
  }
  return (await res.json()) as ObserverResponse;
}

async function main() {
  console.log("🚀 Clawbot Stress Runner Starting...");

  const scenarioPath = process.argv[2];
  if (!scenarioPath) {
    console.error("❌ Missing scenario path.");
    console.error(
      "Usage: npx ts-node --project ts/tsconfig.json scripts/run-stress.ts stress/scenarios/stress-basic.json",
    );
    process.exit(1);
  }

  const absoluteScenarioPath = path.resolve(process.cwd(), scenarioPath);
  if (!fs.existsSync(absoluteScenarioPath)) {
    console.error(`❌ Scenario file not found: ${absoluteScenarioPath}`);
    process.exit(1);
  }

  const rawScenario = fs.readFileSync(absoluteScenarioPath, "utf8");
  const scenario = JSON.parse(rawScenario) as StressScenario;

  console.log(`📘 Scenario loaded: ${scenario.name}`);
  console.log(`📝 Description: ${scenario.description ?? "n/a"}`);
  console.log(`⏱ Duration: ${scenario.durationSeconds}s`);
  console.log(`🔁 Poll interval: ${scenario.pollIntervalMs}ms`);
  console.log(`🧪 Tests: ${scenario.tests.join(", ")}`);

  fs.mkdirSync(EVENTS_DIR, { recursive: true });

  const { stamp } = timestampParts();
  const outFile = path.join(EVENTS_DIR, `${stamp}-${scenario.name}.jsonl`);

  console.log(`📦 Writing black box events to: ${outFile}`);

  const startedAt = Date.now();
  const endsAt = startedAt + scenario.durationSeconds * 1000;

  let sampleCount = 0;
  let okCount = 0;
  let errorCount = 0;

  while (Date.now() < endsAt) {
    const now = new Date().toISOString();

    try {
      const observer = await fetchObserver();
      const record = {
        ts: now,
        kind: "observer_snapshot",
        scenario: scenario.name,
        sample: sampleCount + 1,
        observer,
      };

      fs.appendFileSync(outFile, `${JSON.stringify(record)}\n`, "utf8");
      okCount += 1;
    } catch (error) {
      const record = {
        ts: now,
        kind: "observer_error",
        scenario: scenario.name,
        sample: sampleCount + 1,
        error: error instanceof Error ? error.message : String(error),
      };

      fs.appendFileSync(outFile, `${JSON.stringify(record)}\n`, "utf8");
      errorCount += 1;
    }

    sampleCount += 1;
    await sleep(scenario.pollIntervalMs);
  }

  const completedAt = new Date().toISOString();
  const summary = {
    ts: completedAt,
    kind: "stress_summary",
    scenario: scenario.name,
    durationSeconds: scenario.durationSeconds,
    pollIntervalMs: scenario.pollIntervalMs,
    samples: sampleCount,
    okCount,
    errorCount,
    source: OBSERVER_URL,
    outputFile: outFile,
  };

  fs.appendFileSync(outFile, `${JSON.stringify(summary)}\n`, "utf8");

  console.log("✅ Stress run completed.");
  console.log(`📊 Samples: ${sampleCount}`);
  console.log(`🟢 Successful polls: ${okCount}`);
  console.log(`🔴 Failed polls: ${errorCount}`);
  console.log(`🧾 Black box file: ${outFile}`);
}

main().catch((error) => {
  console.error("❌ Stress runner crashed:", error);
  process.exit(1);
});
