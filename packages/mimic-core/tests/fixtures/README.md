# Fixture Suites

These fixtures are the shared JSON conformance corpus for Mimic DB.

Rules for runners:

- Load each suite file as JSON.
- Apply `commands` to `initial` using atomic batch semantics.
- If the case defines `expect`, assert semantic equality with the resulting state.
- If the case defines `error`, assert that evaluation fails with the expected error code.
- Do not assert on implementation-specific error messages.

Current usage:

- `index.json` lists the core apply suites consumed by `core/fixtures_test.go`.
- `fractional.json` is consumed by the fractional-index test suite.

The fixture corpus assumes the canonical spec in `../core.md`. The current
verified runner is the Go implementation in `apps/mimic-db`.
