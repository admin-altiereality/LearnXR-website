import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(
  await readFile(new URL('../firebase.json', import.meta.url), 'utf8'),
);

const headersFor = (source) =>
  config.hosting.headers.find((entry) => entry.source === source)?.headers ?? [];

const cacheControlFor = (source) =>
  headersFor(source).find((header) => header.key.toLowerCase() === 'cache-control')?.value;

test('SPA entry routes bypass stale HTML caches', () => {
  const spaSources = [
    '/',
    '/studio{,/**}',
    '/immersive-stem{,/**}',
    '/dashboard{,/**}',
    '/lessons{,/**}',
    '/admin{,/**}',
    '/main',
  ];

  for (const source of spaSources) {
    assert.equal(
      cacheControlFor(source),
      'no-cache, no-store, must-revalidate',
      `${source} must not cache the rewritten index.html`,
    );
  }
});

test('fingerprinted application assets remain immutable', () => {
  assert.equal(
    cacheControlFor('**/*.@(js|css|woff2|woff|ttf)'),
    'public, max-age=31536000, immutable',
  );
});

test('3D models are cached but stay replaceable', () => {
  const value = cacheControlFor('**/*.@(glb|gltf|bin)');

  assert.equal(
    value,
    'public, max-age=86400',
    'models under public/ should be cached for a day',
  );
  // These filenames are stable and are replaced in place, so `immutable` would pin a
  // stale avatar on every returning device until the max-age elapsed.
  assert.ok(
    !value.includes('immutable'),
    'non-fingerprinted models must stay revalidatable',
  );
});
