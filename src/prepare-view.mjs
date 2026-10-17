import { readFile, writeFile } from 'node:fs/promises';

export async function prepareView(evidencePath, requestPath) {
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  if (typeof evidence.evidence_id !== 'string' || !evidence.normalized_result) {
    throw new Error('Expected a complete REA Evidence object, not a filtered fragment.');
  }
  await writeFile(requestPath, JSON.stringify({ source: { kind: 'inline', evidence }, view: { kind: 'summary' } }));
}

if (process.argv[1]?.endsWith('prepare-view.mjs')) {
  await prepareView(process.argv[2], process.argv[3]);
}
