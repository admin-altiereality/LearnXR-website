#!/usr/bin/env node
/**
 * Reliable hosting build for iCloud Desktop + low disk.
 * Uses vite.config.hosting.js (publicDir: false) — never copies public/.
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(__dirname, '..');
const REQUIRED_MARKERS = ['Approve partner', 'PartnerDashboard', 'classLaunchesRemaining'];

function log(msg) {
  console.log(`[reliable-build] ${msg}`);
}

function fail(msg) {
  console.error(`[reliable-build] ERROR: ${msg}`);
  process.exit(1);
}

function freeGiB(path) {
  const out = execSync(`df -k "${path}" | tail -1`, { encoding: 'utf8' });
  return Number(out.trim().split(/\s+/)[3]) / 1024 / 1024;
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    log(`$ ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, {
      cwd: CLIENT_ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

function bundleContains(distDir, marker) {
  const assets = join(distDir, 'assets');
  if (!existsSync(assets)) return false;
  for (const name of readdirSync(assets)) {
    if (!name.endsWith('.js')) continue;
    if (readFileSync(join(assets, name), 'utf8').includes(marker)) return true;
  }
  return false;
}

async function main() {
  const free = freeGiB(CLIENT_ROOT);
  log(`free space: ${free.toFixed(2)} GiB`);
  if (free < 1.0) fail(`Need ≥1.0 GiB free (have ${free.toFixed(2)} GiB)`);

  if (!existsSync(join(CLIENT_ROOT, 'node_modules', 'vite'))) {
    fail('vite missing — run npm ci in server/client first');
  }
  if (!existsSync(join(CLIENT_ROOT, 'vite.config.hosting.js'))) {
    fail('vite.config.hosting.js missing');
  }

  const dist = join(CLIENT_ROOT, 'dist');
  if (existsSync(join(dist, 'assets'))) {
    rmSync(join(dist, 'assets'), { recursive: true, force: true });
  }

  await run(
    'npx',
    ['vite', 'build', '--config', 'vite.config.hosting.js', '--mode', 'production'],
    {
      VITE_SKIP_MINIFY: '1',
      NODE_OPTIONS: '--max-old-space-size=8192',
      NODE_ENV: 'development',
    }
  );

  if (!existsSync(join(dist, 'index.html'))) fail('dist/index.html missing');
  for (const marker of REQUIRED_MARKERS) {
    if (!bundleContains(dist, marker)) fail(`bundle missing marker: "${marker}"`);
    log(`verified: ${marker}`);
  }

  const size = execSync(`du -sh "${dist}" | awk '{print $1}'`, { encoding: 'utf8' }).trim();
  const js = readdirSync(join(dist, 'assets')).filter((n) => n.endsWith('.js'));
  log(`dist ready (${size}) js=${js.join(', ')}`);
  log('OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
