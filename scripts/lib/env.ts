import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Carrega .env.local (sem dependência extra). Variáveis já definidas têm precedência. */
export function loadEnv(file = path.resolve(__dirname, "../../.env.local")) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
