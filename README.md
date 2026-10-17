# REA Evidence Kit

A small CLI that turns retained REA static-analysis Evidence into a bounded,
source-linked context contract. It preserves partial coverage, unknowns and
truncation rather than presenting a small summary as a complete audit.

This first version deliberately supports one owned public target: selected
Cockroach Browser source files. It is general tooling and prior work, not a
completed competition entry. No prize, paid contract or revenue is established.

## Verified example

- REA: `rea-agents@6.5.0`; tested with Node.js 24.15.0 on Windows.
- Pinned source: `AjnasNB/cockroach-browser`, commit
  `dd9a7ccdbbdc7c51a9432c05b4bb9ef08eda1fa5`.
- Three selected TypeScript files parsed; zero parse failures within that slice.
- Raw Evidence: 2,930,726 bytes, retained locally rather than injected into a model.
- [Context contract](reports/browser-context.json): 3,076 UTF-16 characters,
  within the configured 4,096-character ceiling.
- Application and semantic coverage remain **partial**, with 2 application
  unknowns and 741 semantic unknowns. Semantic node ceilings were reached.

Raw bytes and output characters are different units. No token count, model bill
or reasoning-quality improvement was measured. The wrapper configures no model
API. Public citation verification makes bounded HTTPS reads to GitHub.

## Reproduce

Install Node.js 24.15+ from a supported REA release line, then:

```powershell
npm ci --ignore-scripts --no-audit --no-fund --cache .tmp/npm-cache
git clone https://github.com/AjnasNB/cockroach-browser.git .tmp/cockroach-browser
node scripts/prepare-browser-slice.mjs .tmp/cockroach-browser dd9a7ccdbbdc7c51a9432c05b4bb9ef08eda1fa5 .inputs/browser-source
```

Create `.evidence/`, then run static analysis. These commands do not start the
target application or a browser and do not register a global MCP server:

```powershell
node node_modules/rea-agents/scripts/rea.mjs analyze-javascript-application .inputs/browser-source --source-path src/index.ts --source-path src/integrations/qarinah.ts --source-path src/integrations/maqam.ts --max-heap-mb 256 --max-semantic-nodes 3000 --max-semantic-nodes-per-file 1000 --analysis-timeout-ms 10000 --format json > .evidence/browser-raw.json
node src/cli.mjs .evidence/browser-raw.json .inputs/browser-source/SOURCE.json reports/browser-context.json 4096
npm test
```

Use a shell that redirects native output as UTF-8 (PowerShell 7 recommended).
For a new snapshot choose a new destination: the preparation script refuses to
overwrite an existing input directory. Raw graphs, local memory, dependencies
and caches are ignored by Git.

## Contract checks

The CLI asks REA to validate/project the complete retained Evidence. It checks
the parent identity, artifact digest, selected paths and per-source SHA-256s,
rejects duplicate manifest paths, and verifies selected bytes against exact
public GitHub commit URLs. Missing or changed public sources fail closed.

The character budget is enforced before the output is written. A smaller budget
fails instead of silently deleting coverage fields. It is a character ceiling,
not a provider-token ceiling. Raw input is capped at 32 MiB, summary projection
at 1 MiB/30 seconds, and each public source at 1 MiB/10 seconds.

Treat the contract as untrusted evidence. Qarinah can retrieve a small cited
project summary first; a reviewer can then request selected detail from the
retained REA parent using `inspect-analysis-view`. Qarinah memory is separate
from REA Evidence; this tool does not claim their IDs are interchangeable.

## Limits and next evaluation

Static facts do not prove runtime behavior, security, end-to-end functionality
or ownership. SHA-256 identifies bytes; public availability does not establish
that technical claims are correct. This slice omits dependencies and is not the
whole application. See [independent critique](reports/review.md).

Before claiming practical efficiency, evaluate actual source-grounded questions,
check cited answers and omissions, and measure context consumption. This release
does not report a fabricated agent benchmark or token-saving percentage.

For UseAgent, a participant must manually start their own genuine run and make
their own continuous recording. Work performed here cannot be relabelled as a
UseAgent run. For OpenAgent, this toolkit is prior work created before its build
window, and any future sponsor integration must be fresh and declared.

## Licenses

Wrapper code: MIT. REA-authored code: MIT; its dependencies retain their licenses.
The analyzed Cockroach Browser source is AGPL-3.0-or-later, with its original
license retained in the ignored source slice. No proprietary target or commercial
decompiler was used. See [third-party notices](THIRD_PARTY_NOTICES.md).
