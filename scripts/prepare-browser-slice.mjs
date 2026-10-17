import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const [repo, commit, destination] = process.argv.slice(2);
if (!repo || !/^[a-f0-9]{40}$/.test(commit ?? '') || !destination) {
  throw new Error('Usage: node scripts/prepare-browser-slice.mjs REPO COMMIT_SHA NEW_DESTINATION');
}
const output = path.resolve(destination);
try { await access(output); throw new Error('Destination already exists; choose a new directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const origin = execFileSync('git', ['-C', path.resolve(repo), 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
if (!['https://github.com/AjnasNB/cockroach-browser.git', 'https://github.com/AjnasNB/cockroach-browser', 'git@github.com:AjnasNB/cockroach-browser.git'].includes(origin)) {
  throw new Error('Snapshot source must be the owned Cockroach Browser repository.');
}
const files = ['package.json', 'LICENSE', 'src/index.ts', 'src/integrations/qarinah.ts', 'src/integrations/maqam.ts'];
const entries = files.map(file => {
  const bytes = execFileSync('git', ['-C', path.resolve(repo), 'show', `${commit}:${file}`], { maxBuffer: 4 * 1024 * 1024 });
  return { file, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
});
await mkdir(output, { recursive: true });
for (const entry of entries) {
  await mkdir(path.dirname(path.join(output, entry.file)), { recursive: true });
  await writeFile(path.join(output, entry.file), entry.bytes);
}
const manifest = {
  schemaVersion: 1,
  source: 'https://github.com/AjnasNB/cockroach-browser',
  commit,
  license: 'AGPL-3.0-or-later; original LICENSE retained in the private analysis slice',
  coverage: 'Selected committed source files only. Not the complete application or a runtime audit.',
  files: entries.map(({ file, bytes, sha256 }) => ({ path: file, bytes: bytes.length, sha256 }))
};
await writeFile(path.join(output, 'SOURCE.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, commit, files: manifest.files.length, bytes: entries.reduce((n, e) => n + e.bytes.length, 0) }));
