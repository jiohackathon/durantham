import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

// Node does not read .env files on its own. Load this private local file before
// the application starts, while allowing PowerShell/hosting-provider variables
// to take precedence.
const envFile = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '../.env');

if (fs.existsSync(envFile)) {
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && process.env[key] === undefined) process.env[key] = value;
  }
}
