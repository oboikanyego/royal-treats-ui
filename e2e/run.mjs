// Runs every browser suite against the mock API and a local-config build of the site.
//   node run.mjs                 build the site, start the mock and the site, run all suites
//   node run.mjs 04 admin        only suites whose file name contains one of the words
//   E2E_SKIP_BUILD=1 node run.mjs  reuse the build in .dist (after a build of your own)
//   API_SRC=../../royal-treats-api/src node run.mjs  use a live API checkout instead of the snapshot
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dist = path.join(here, '.dist');
const out = path.join(here, 'test-output');
const UI_PORT = Number(process.env.UI_PORT || 4307);
const API_PORT = Number(process.env.MOCK_PORT || 3000);
const env = {
  ...process.env,
  UI_URL: `http://localhost:${UI_PORT}`,
  API_URL: `http://localhost:${API_PORT}`,
  MOCK_PORT: String(API_PORT),
  E2E_OUT: out,
};
fs.mkdirSync(out, { recursive: true });

if (!process.env.E2E_SKIP_BUILD) {
  console.log('Building the site (local API configuration)…');
  const build = spawnSync('npx', ['ng', 'build', '--configuration', 'local', '--output-path', dist], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const site = path.join(dist, 'browser');
if (!fs.existsSync(path.join(site, 'index.html'))) {
  console.error(`No build found in ${site}. Run without E2E_SKIP_BUILD.`);
  process.exit(2);
}

const children = [];
const start = (args, label) => {
  const child = spawn(process.execPath, args, { cwd: here, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', () => undefined);
  child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
  children.push(child);
  return child;
};
const stopAll = () => children.forEach((c) => c.kill());
process.on('exit', stopAll);
process.on('SIGINT', () => process.exit(130));

start(['--import', 'tsx', 'mock-api.mjs'], 'mock');
start(['serve.cjs', site, String(UI_PORT)], 'site');
const waitFor = async (url) => {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} did not start`);
};
await waitFor(`${env.API_URL}/api/v1/settings`);
await waitFor(env.UI_URL);

const words = process.argv.slice(2);
const suites = fs
  .readdirSync(path.join(here, 'suites'))
  .filter((f) => f.endsWith('.js'))
  .filter((f) => !words.length || words.some((w) => f.includes(w)))
  .sort();
let failed = 0;
for (const file of suites) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(here, 'suites', file)], {
    cwd: here,
    env,
    encoding: 'utf8',
    timeout: 8 * 60_000,
  });
  const lines = `${run.stdout}${run.stderr}`.split('\n');
  const passes = lines.filter((l) => l.startsWith('PASS')).length;
  const bad = lines.filter((l) => /^(FAIL|CRASH)/.test(l));
  const ok = run.status === 0 && !bad.length && passes > 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file.padEnd(44)} ${String(passes).padStart(3)} checks  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  if (!ok) {
    for (const l of bad) console.log(`     ${l.slice(0, 300)}`);
    if (!bad.length) console.log(`     exit ${run.status}; ${lines.filter(Boolean).slice(-4).join(' | ').slice(0, 300)}`);
    fs.writeFileSync(path.join(out, `${file}.log`), lines.join('\n'));
  }
}
console.log(failed ? `\n${failed} of ${suites.length} suites failed` : `\nAll ${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
