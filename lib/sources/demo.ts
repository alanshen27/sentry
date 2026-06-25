import { promises as fs } from "fs";
import path from "path";

const DEMO_DIR = path.join(process.cwd(), "data", "demo");

const cache = new Map<string, any>();

export async function loadDemo<T>(name: string): Promise<T> {
  if (cache.has(name)) return cache.get(name) as T;
  const raw = await fs.readFile(path.join(DEMO_DIR, name), "utf-8");
  const data = JSON.parse(raw) as T;
  cache.set(name, data);
  return data;
}

export function demoPath(name: string): string {
  return path.join(DEMO_DIR, name);
}
