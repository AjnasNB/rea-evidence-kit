import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContract, validateSourceBinding } from '../src/contract.mjs';

function fixture() {
  const sha = 'a'.repeat(64);
  const parent = `ev_${'b'.repeat(64)}`;
  const manifest = { source: 'https://github.com/AjnasNB/cockroach-browser', commit: 'c'.repeat(40),
    coverage: 'Test fixture, selected file only.', files: [{ path: 'src/example.ts', sha256: sha }] };
  const selection = { requested_paths: ['src/example.ts'], unselected_files: 1 };
  const raw = { evidence_id: parent, normalized_result: {
    root_artifact_sha256: sha, source_selection: selection,
    graph: { nodes: [{ observations: [{ evidence: { artifact: { sha256: sha },
      location: { value: { kind: 'source-range', source: 'src/example.ts' } } } }] }] }
  } };
  const view = { evidence_id: `ev_${'d'.repeat(64)}`, normalized_result: {
    kind: 'summary', parent_operation: 'analyze_javascript_application', parent_evidence_id: parent,
    artifact: { sha256: sha }, coverage: { status: 'complete-within-view' }, summary: {
      source_selection: selection, statistics: { parsed_javascript_files: 1, parse_failures: 0 },
      coverage: { application: { status: 'partial', truncated: false },
        semantic: { status: 'partial', truncated: true, limits: [{ name: 'node_ceiling', value: 10, unit: 'items' }] },
        application_unknowns: 2, semantic_unknowns: 7 }
    }
  } };
  const reference = { evidenceId: parent, sha256: sha, bytes: 100, file: '.evidence/test.json' };
  return { raw, view, manifest, reference };
}

test('complete projection preserves partial source coverage, truncation and unknowns', () => {
  const f = fixture();
  validateSourceBinding(f.raw, f.view, f.manifest);
  const { contract, text } = compileContract(f.view, f.manifest, f.reference);
  assert.equal(contract.coverage.summaryProjection, 'complete-within-view');
  assert.equal(contract.coverage.application.status, 'partial');
  assert.equal(contract.coverage.semantic.truncated, true);
  assert.equal(contract.coverage.semanticUnknowns, 7);
  assert.ok(text.length <= 4096);
});

test('tampered source identity and unrelated raw evidence are rejected', () => {
  const f = fixture();
  f.manifest.files[0].sha256 = 'e'.repeat(64);
  assert.throws(() => validateSourceBinding(f.raw, f.view, f.manifest), /does not match/);
  f.raw.evidence_id = `ev_${'f'.repeat(64)}`;
  assert.throws(() => validateSourceBinding(f.raw, f.view, f.manifest), /same artifact/);
});

test('hard budget fails instead of silently truncating source coverage', () => {
  const f = fixture();
  assert.throws(() => compileContract(f.view, f.manifest, f.reference, 512), /No coverage fields/);
  for (const limit of [NaN, 4096.5, 0, 20001]) {
    assert.throws(() => compileContract(f.view, f.manifest, f.reference, limit), /maxChars/);
  }
});

test('unavailable counts remain unknown; absent coverage fails closed', () => {
  const f = fixture();
  delete f.view.normalized_result.summary.coverage.semantic_unknowns;
  assert.equal(compileContract(f.view, f.manifest, f.reference).contract.coverage.semanticUnknowns, null);
  delete f.view.normalized_result.summary.coverage.application;
  assert.throws(() => compileContract(f.view, f.manifest, f.reference), /mandatory/);
});

test('a source path cannot inject a different citation or escape its repository', () => {
  const f = fixture();
  f.manifest.files[0].path = '../secret';
  assert.throws(() => compileContract(f.view, f.manifest, f.reference), /source-file identity/);
});
