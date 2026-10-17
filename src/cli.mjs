import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareView } from './prepare-view.mjs';
import { compileContract, validateSourceBinding } from './contract.mjs';
import { verifyPublicSources } from './public-source.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const [rawArg, manifestArg, outputArg, maxCharsArg = '4096'] = process.argv.slice(2);

try {
  if (!rawArg || !manifestArg || !outputArg) {
    throw new Error('Usage: node src/cli.mjs RAW_EVIDENCE SOURCE_MANIFEST OUTPUT [MAX_CHARS]');
  }
  const rawPath = path.resolve(rawArg);
  const rawStat = await stat(rawPath);
  if (rawStat.size > 32 * 1024 * 1024) throw new Error('Raw Evidence exceeds the 32 MiB input ceiling.');
  const rawBytes = await readFile(rawPath);
  const raw = JSON.parse(rawBytes.toString('utf8'));
  const manifest = JSON.parse(await readFile(path.resolve(manifestArg), 'utf8'));
  const evidenceDir = path.join(root, '.evidence');
  await mkdir(evidenceDir, { recursive: true });
  const requestPath = path.join(evidenceDir, `summary-request-${randomUUID()}.json`);
  await prepareView(rawPath, requestPath);
  const reaCli = path.join(root, 'node_modules/rea-agents/scripts/rea.mjs');
  const { stdout } = await exec(process.execPath, [reaCli, 'inspect-analysis-view', requestPath, '--format', 'json'], {
    cwd: root, timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true
  });
  const view = JSON.parse(stdout);
  validateSourceBinding(raw, view, manifest);
  const publicSourcesVerified = await verifyPublicSources(manifest, raw.normalized_result.source_selection.requested_paths);
  const viewPath = path.join(evidenceDir, `summary-${createHash('sha256').update(stdout).digest('hex')}.json`);
  await writeFile(viewPath, stdout);
  const { text } = compileContract(view, manifest, {
    evidenceId: raw.evidence_id,
    sha256: createHash('sha256').update(rawBytes).digest('hex'),
    bytes: rawBytes.length,
    publicSourcesVerified,
    file: path.relative(root, rawPath).split(path.sep).join('/')
  }, Number(maxCharsArg));
  const outputPath = path.resolve(outputArg);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, text);
  console.log(JSON.stringify({ output: outputPath, chars: text.length, maxChars: Number(maxCharsArg), rawBytes: rawBytes.length, targetExecuted: false, modelApiConfigured: false }));
} catch (error) {
  console.error(`rea-evidence-kit: ${error.message}`);
  process.exitCode = 1;
}
