import fs from 'node:fs';
import path from 'node:path';

/** Load key=value pairs from .env.local (if present) without overriding existing process.env vars. */
export function loadLocalEnv(cwd: string = process.cwd()): void {
  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}
