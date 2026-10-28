// Refreshes e2e/api-snapshot from a checkout of royal-treats-api: the files the mock imports, plus what
// they import in turn. Run it when the API's contract changes: node scripts/sync-api-snapshot.mjs ../../royal-treats-api
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const api = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(path.join(api, 'src'))) {
  console.error('Usage: node scripts/sync-api-snapshot.mjs <path to a royal-treats-api checkout>');
  process.exit(2);
}
const entry = ['catalogue', 'validation', 'images', 'order-rules', 'security', 'live', 'receipt'];
const seen = new Set();
const todo = [...entry];
while (todo.length) {
  const name = todo.pop();
  if (seen.has(name)) continue;
  seen.add(name);
  const text = fs.readFileSync(path.join(api, 'src', `${name}.ts`), 'utf8');
  for (const m of text.matchAll(/from '\.\/([\w-]+)\.js'/g)) todo.push(m[1]);
}
const out = path.join(here, '..', 'api-snapshot');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'src'), { recursive: true });
for (const name of [...seen].sort())
  fs.copyFileSync(path.join(api, 'src', `${name}.ts`), path.join(out, 'src', `${name}.ts`));
const sha = execFileSync('git', ['-C', api, 'rev-parse', 'HEAD']).toString().trim();
fs.writeFileSync(
  path.join(out, 'README.md'),
  `# API snapshot\n\nVerbatim copies of ${[...seen].length} files from royal-treats-api (\`src/\`) at commit \`${sha}\`.\nThe mock API in \`../mock-api.mjs\` runs the API's own validation, pricing and order rules from here.\nRefresh with \`npm run sync-api -- <path to a royal-treats-api checkout>\`. Do not edit these files.\n`,
);
console.log(`Copied ${seen.size} files from ${api} at ${sha}`);
