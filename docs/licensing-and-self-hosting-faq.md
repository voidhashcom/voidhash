# Licensing and self-hosting FAQ

This FAQ explains the repository's intended license boundaries. It is not
legal advice; organizations with specific compliance questions should consult
their counsel. The authoritative terms are the license texts linked from
[LICENSE.md](../LICENSE.md).

## Which code is MIT licensed?

SDKs and other code embedded in a customer's application are MIT licensed.
That includes the React Native, web, Node, and paywall libraries, the CLI and
Studio, examples, generated clients, API contracts, and the App Store and
Google Play server SDKs. Each package declares `MIT` and resolves to the full
MIT text.

## Which code is AGPL-3.0-only?

The backend, dashboard, Mimic services and tooling, service packages, paywall
build/render pipeline, and self-host runtime are AGPL-3.0-only. Operators may
modify and self-host that code, including commercially, subject to the AGPL's
terms. In particular, the AGPL contains source-availability obligations for
modified versions used to provide network services.

## Does AGPL apply to an application using a Voidhash SDK?

The customer-facing SDK packages are MIT licensed specifically so applications
can link and ship them without importing the AGPL service license. Check the
nearest package license and its `package.json`; do not infer a package's license
from the repository name alone.

## Is Enterprise code included?

No. Closed Enterprise implementation remains in the private cloud repository.
It composes over explicit Community extension points and is not copied into
this repository or the Community image. Any separately distributed Enterprise
Software is governed only by terms that expressly identify it.

## Is self-hosting production supported today?

Not yet. The repository is in private alpha and the latest `main` branch is
the only security-maintained line. The supported path for evaluation is the
documented Docker Compose configuration. A production support matrix and
version table will replace this answer before the first public release.

## Why does Community v1 require WorkOS?

The application already isolates authentication behind a platform port, but
the first Community composition uses operator-supplied WorkOS credentials so
the complete product can ship without weakening authentication during the
open-source migration. Use a WorkOS staging environment for local evaluation
and your own production environment for any network-accessible deployment. A
bundled authentication adapter remains a public roadmap item.

## Is analytics required?

No. ClickHouse is an optional Compose profile. Without it, the platform still
boots, purchase and identity state remains durable in PostgreSQL, and analytics
queries degrade to empty results. Enable the profile for durable event capture
and dashboards.

## Are pricing or trademark terms defined here?

No. Cloud and Enterprise pricing is intentionally undecided. Voidhash does not
currently claim a registered trademark, and this repository does not define a
separate trademark policy.

## Can I contribute a patch?

External pull-request intake is closed during private alpha and beta. Issues
and private security reports are welcome. Before external contributions are
accepted, Voidhash will enable the approved Contributor License Agreement
acceptance process and make its check merge-blocking.

## How do I report a vulnerability?

Email [security@voidhash.com](mailto:security@voidhash.com) and follow
[SECURITY.md](../SECURITY.md). Do not disclose suspected vulnerabilities in a
public issue or pull request.
