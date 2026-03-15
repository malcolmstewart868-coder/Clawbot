import { BlackBoxWriter } from "./writer";
import type { BlackBoxEvent } from "./types";

export class BlackBoxRecorder {
  private readonly writer: BlackBoxWriter;

  constructor(sessionName: string) {
    this.writer = new BlackBoxWriter(sessionName);
  }

  record(event: BlackBoxEvent) {
    this.writer.write(event);
  }

  path() {
    return this.writer.getPath();
  }
}
