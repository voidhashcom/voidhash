# Document migrations

Mimic document migrations are ordinary deployed TypeScript modules. A host
injects a `MigrationRegistry` when it composes the control and document
engines; no migration source is uploaded, bundled, or evaluated at runtime.

Each registry-owned collection defines a version-0 baseline primitive and an
ordered list of immutable migration steps. Versions start at 1 and are
contiguous. Registry construction rejects duplicate collection addresses,
gaps, and adjacent schema mismatches.

Opening a document always rebuilds its current value before migration. The
engine first reconciles any source-free legacy schema history to the baseline,
then directly invokes each pending code migration and validates the value
against its target primitive. A single atomic store operation persists the
resulting snapshot and version metadata. Failed migrations leave persisted
state unchanged.

Reads, lists, submissions, and WebSocket session promotion all depend on this
load path. A document cannot be observed or joined until its migration commit
succeeds. Documents with a migration version newer than the deployed registry
are refused.

Registry bootstrap creates missing databases and collections, records the
code-managed migration version, and publishes the latest schema for new
documents. Registry-owned schemas are read-only through public APIs.

Legacy schema history remains compatibility data only. Stored executable
migration source is never evaluated; a document that still requires it fails
explicitly.
