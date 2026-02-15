import { execSync } from "node:child_process";

const ports = [5173, 3001];

function killPortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { stdio: "pipe" }).toString();
    const pids = [...new Set(out.split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split(/\s+/).pop()))];
    for (const pid of pids) {
      if (!pid) continue;
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`✅ Killed PID ${pid} on port ${port}`);
    }
    if (pids.length === 0) console.log(`ℹ️ No process found on port ${port}`);
  } catch {
    console.log(`ℹ️ No process found on port ${port}`);
  }
}

for (const port of ports) killPortWindows(port);
