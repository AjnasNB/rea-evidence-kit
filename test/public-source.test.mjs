import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyPublicSources } from '../src/public-source.mjs';

const bytes = 'export const example = 1;\n';
function fixture() {
  return { source: 'https://github.com/AjnasNB/cockroach-browser', commit: 'a'.repeat(40), files: [
    { path: 'src/example.ts', sha256: createHash('sha256').update(bytes).digest('hex') }
  ] };
}

test('public commit association requires matching bytes at the exact cited URL', async () => {
  const manifest = fixture();
  let observedURL;
  assert.equal(await verifyPublicSources(manifest, ['src/example.ts'], async url => {
    observedURL = url;
    return new Response(bytes);
  }), true);
  assert.equal(observedURL, `https://raw.githubusercontent.com/AjnasNB/cockroach-browser/${manifest.commit}/src/example.ts`);
  await assert.rejects(verifyPublicSources(manifest, ['src/example.ts'], async () => new Response('different bytes')), /mismatch/);
  await assert.rejects(verifyPublicSources(manifest, ['src/example.ts'], async () => new Response('', { status: 404 })), /unavailable/);
});

test('duplicate manifest paths fail before a network request', async () => {
  const manifest = fixture();
  manifest.files.push({ ...manifest.files[0], sha256: 'f'.repeat(64) });
  await assert.rejects(verifyPublicSources(manifest, ['src/example.ts'], async () => {
    assert.fail('No network request should occur for a contradictory manifest.');
  }), /Duplicate/);
});
