import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { StateStore } from "../../core/types";

export class FileStateStore implements StateStore {
  constructor(private readonly path: string) {}

  async get(key: string): Promise<string | null> {
    const state = await this.readState();
    return state[key] ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    const state = await this.readState();
    state[key] = value;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private async readState(): Promise<Record<string, string>> {
    try {
      const data = JSON.parse(await readFile(this.path, "utf8")) as unknown;
      return isStringRecord(data) ? data : {};
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}
