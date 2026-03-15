import fs from "node:fs";
import path from "node:path";
import type { BlackBoxEvent } from "./types";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function dayStamp(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export class BlackBoxWriter {
  private readonly root: string;
  private readonly filePath: string;

  constructor(sessionName: string) {
    this.root = path.resolve(process.cwd(), "..", "stress", "blackbox", "events");
    ensureDir(this.root);

    const stamp = dayStamp(Date.now());
    this.filePath = path.join(this.root, `${stamp}-${sessionName}.jsonl`);
  }

  write(event: BlackBoxEvent) {
    const line = JSON.stringify(event) + "\n";
    fs.appendFileSync(this.filePath, line, "utf8");
  }

  getPath() {
    return this.filePath;
  }
}
