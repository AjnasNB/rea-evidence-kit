import { createHash } from 'node:crypto';
import { validateManifest } from './contract.mjs';

export async function verifyPublicSources(manifest, selectedPaths, fetchImpl = fetch) {
  validateManifest(manifest);
  if (!Array.isArray(selectedPaths) || !selectedPaths.length || selectedPaths.length > 16) {
    throw new Error('Public verification requires 1-16 selected source paths.');
  }
  for (const selectedPath of selectedPaths) {
    const file = manifest.files.find(entry => entry.path === selectedPath);
    if (!file) throw new Error('Selected source is absent from the manifest.');
    const url = `https://raw.githubusercontent.com/AjnasNB/cockroach-browser/${manifest.commit}/${file.path}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error(`Public source unavailable: ${file.path} (HTTP ${response.status}).`);
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) throw new Error('Public source exceeds the 1 MiB verification ceiling.');
      hash.update(chunk);
    }
    if (hash.digest('hex') !== file.sha256) throw new Error(`Public commit source mismatch: ${file.path}`);
  }
  return true;
}
