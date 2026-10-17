# Independent critique and disposition

An independent reviewer identified two provenance defects:

1. A valid-looking commit string could change source citations without binding
   that commit to analyzed bytes. Fixed: the CLI now retrieves each selected
   source from the exact public GitHub commit URL and checks its SHA-256.
2. Duplicate manifest paths could validate the first identity but emit a second,
   contradictory identity. Fixed: duplicate paths are rejected before network
   verification or output generation.

Focused tests cover those defects, changed source bytes, unavailable public
sources, source/raw identity mismatch, omitted coverage, path injection and hard
budget rejection. Seven tests passed on October 17, 2026, followed by a successful
live run with public source verification.

The strongest remaining criticism is about usefulness: bounded packaging alone
does not show that an agent can answer meaningful engineering questions more
accurately or cheaply. A genuine future evaluation should compare cited answers,
unsupported claims, omissions and measured context usage. No such benchmark,
token-saving percentage, runtime guarantee or prize claim is made here.

The current 741 semantic unknowns and partial coverage remain visible. A smaller
context contract is not evidence that the omitted graph is unnecessary for a
particular question. Retrieve source detail when a decision requires it.
