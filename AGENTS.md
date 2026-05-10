# axios-rate-limit

## Goal
- Keep changes small, reviewable, and aligned with existing project patterns.
- Prefer focused fixes with explicit validation over broad refactors.

## Working agreement
- Do not change behavior outside the requested scope.
- Reuse existing naming, structure, and API conventions from nearby code.
- Avoid opportunistic edits in unrelated files.
- Preserve backward compatibility unless the task explicitly requests a breaking change.

## Issue fix workflow
### 1) Reproduce
- Identify the failing behavior and the smallest reproducible scenario.
- If possible, add a regression test that captures the bug before implementation.
- Run the regression test first to confirm it fails before the fix.

### 2) Implement
- Apply the minimum code change that resolves the reproduced failure.
- Keep runtime behavior and public API consistent with existing expectations.
- Follow existing codebase patterns rather than introducing new styles.

### 3) Validate
- Run `npm test` to execute the test suite.
- Run `npm run lint` to execute lint checks.
- Fix any test or lint errors until the suite is fully green.

## Change quality checklist
- The fix is covered by tests (or a clear reason is provided when coverage is not feasible).
- Documentation/examples are updated when behavior or usage changes.
- The diff is readable and limited to the task scope.
