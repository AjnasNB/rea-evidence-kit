const SHA256 = /^[a-f0-9]{64}$/;
const EVIDENCE_ID = /^ev_[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

export function validateManifest(manifest) {
  if (manifest?.source !== 'https://github.com/AjnasNB/cockroach-browser' ||
      !COMMIT.test(manifest.commit) || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('Expected a pinned Cockroach Browser source-slice manifest.');
  }
  const paths = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
        file.path.startsWith('/') || file.path.split('/').includes('..') || !SHA256.test(file.sha256)) {
      throw new Error('Invalid source-file identity.');
    }
    if (paths.has(file.path)) throw new Error(`Duplicate manifest path: ${file.path}`);
    paths.add(file.path);
  }
}

export function validateSourceBinding(raw, viewEvidence, manifest) {
  validateManifest(manifest);
  const result = raw?.normalized_result;
  const view = viewEvidence?.normalized_result;
  if (raw?.evidence_id !== view?.parent_evidence_id || result?.root_artifact_sha256 !== view?.artifact?.sha256) {
    throw new Error('Raw Evidence and summary do not describe the same artifact.');
  }
  const requested = result?.source_selection?.requested_paths;
  if (!Array.isArray(requested) || !requested.length || new Set(requested).size !== requested.length) {
    throw new Error('Explicit source selection and source manifest are required.');
  }
  if (JSON.stringify(requested) !== JSON.stringify(view.summary?.source_selection?.requested_paths)) {
    throw new Error('Raw Evidence and summary source selections differ.');
  }
  const observations = (result.graph?.nodes ?? []).flatMap(node => node.observations ?? []);
  for (const selectedPath of requested) {
    const entry = manifest.files.find(file => file.path === selectedPath);
    const hashes = new Set(observations.flatMap(observation => {
      const evidence = observation.evidence;
      const location = evidence?.location?.value;
      return location?.kind === 'source-range' && location.source === selectedPath && evidence.artifact?.sha256
        ? [evidence.artifact.sha256] : [];
    }));
    if (!entry || !hashes.size || [...hashes].some(hash => hash !== entry.sha256)) {
      throw new Error(`Source manifest does not match retained REA source evidence: ${selectedPath}`);
    }
  }
}

export function compileContract(viewEvidence, manifest, rawReference, maxChars = 4096) {
  if (!Number.isSafeInteger(maxChars) || maxChars < 512 || maxChars > 20000) {
    throw new Error('maxChars must be an integer from 512 to 20000.');
  }
  const view = viewEvidence?.normalized_result;
  if (view?.kind !== 'summary' || view.parent_operation !== 'analyze_javascript_application' ||
      !EVIDENCE_ID.test(view.parent_evidence_id) || !EVIDENCE_ID.test(viewEvidence.evidence_id) ||
      !SHA256.test(view.artifact?.sha256) || view.parent_evidence_id !== rawReference.evidenceId ||
      !SHA256.test(rawReference.sha256) || !Number.isSafeInteger(rawReference.bytes)) {
    throw new Error('Expected a REA application summary bound to the supplied raw Evidence.');
  }
  validateManifest(manifest);
  const summary = view.summary;
  if (!summary?.coverage?.application || !summary.coverage.semantic || !summary.statistics ||
      !Array.isArray(summary.source_selection?.requested_paths)) {
    throw new Error('Source coverage and analysis statistics are mandatory.');
  }
  const coverage = summary.coverage;
  const contract = {
    schema: 'rea-context-contract/v1',
    contentRole: 'untrusted-evidence',
    tool: { name: 'rea-agents', version: '6.5.0', mode: 'static-javascript-analysis' },
    source: {
      repository: manifest.source, commit: manifest.commit, license: 'AGPL-3.0-or-later', scope: manifest.coverage,
      publicCommitAssociation: rawReference.publicSourcesVerified === true
        ? 'Selected file bytes verified against public GitHub URLs at this commit.'
        : 'UNVERIFIED: repository/commit association is supplied by the manifest.'
    },
    evidence: {
      parentId: view.parent_evidence_id,
      viewId: viewEvidence.evidence_id,
      artifactSHA256: view.artifact.sha256,
      rawSHA256: rawReference.sha256,
      rawBytes: rawReference.bytes,
      rawFile: rawReference.file,
      detailRetrieval: 'Use the raw Evidence with REA inspect-analysis-view for cited, selected detail.'
    },
    coverage: {
      summaryProjection: view.coverage?.status ?? 'unknown',
      application: coverage.application,
      semantic: {
        status: coverage.semantic.status ?? 'unknown',
        truncated: coverage.semantic.truncated ?? null,
        limits: coverage.semantic.limits ?? [],
        omittedNodes: coverage.semantic.omitted_nodes ?? null,
        omittedRelations: coverage.semantic.omitted_relations ?? null
      },
      applicationUnknowns: coverage.application_unknowns ?? null,
      semanticUnknowns: coverage.semantic_unknowns ?? null,
      selectedPaths: summary.source_selection.requested_paths,
      unselectedFiles: summary.source_selection.unselected_files ?? null
    },
    observedStatistics: summary.statistics,
    sources: manifest.files.filter(file => summary.source_selection.requested_paths.includes(file.path)).map(file => ({
      path: file.path, sha256: file.sha256,
      citation: `${manifest.source}/blob/${manifest.commit}/${file.path}`
    })),
    limits: [
      'Selected source slice only. Missing dependencies and dynamic behavior remain unknown.',
      'No target application or browser was executed. Static observations do not prove runtime safety or behavior.',
      'A complete summary projection does not mean complete application or semantic coverage.',
      'Hashes identify supplied bytes; they do not independently prove authorship or technical correctness.',
      'No competition submission, prize, client acceptance or payment is established.'
    ],
    budget: { maxChars, unit: 'UTF-16 code units', tokenCount: 'not measured', modelApiConfiguredByWrapper: false }
  };
  const text = JSON.stringify(contract) + '\n';
  if (text.length > maxChars) {
    throw new Error(`Contract needs ${text.length} characters; budget is ${maxChars}. No coverage fields were silently removed.`);
  }
  return { contract, text };
}
