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
build/render pipeline, and deployment adapters are AGPL-3.0-only. Operators may
modify and self-host that code, including commercially, subject to the AGPL's
terms. In particular, the AGPL contains source-availability obligations for
modified versions used to provide network services.

## Does AGPL apply to an application using a Voidhash SDK?

The customer-facing SDK packages are MIT licensed specifically so applications
can link and ship them without importing the AGPL service license. Check the
nearest package license and its `package.json`; do not infer a package's license
from the repository name alone.

## Is Enterprise code included?

No. Commercial implementation is not included in this repository. Any
separately distributed Enterprise Software is governed only by terms that
expressly identify it.

## Is self-hosting production supported today?

Not yet. The repository is in private alpha and the latest `main` branch is
the only security-maintained line. The supported evaluation path deploys the
Community Alchemy composition to the operator's Cloudflare account and connects
it to operator-managed PostgreSQL. A production support matrix and version
table will replace this answer before the first public release.

## How does authentication work, and why only one user?

Community ships a built-in authentication provider and needs no external
identity service. It is single-player: one root account, whose username and
password come from `VOIDHASH_ROOT_USERNAME` and `VOIDHASH_ROOT_PASSWORD`. There
is no sign-up and no code path that can create a second user, which is what
keeps the model easy to reason about while the project is young. Multi-user
self-host — most likely as a generic OIDC adapter behind the same identity
port the hosted cloud uses — is a public roadmap item.

## How does Community analytics work?

Community stores built-in lifecycle and revenue events in PostgreSQL. The
capture endpoints remain SDK-compatible, while custom events and advanced query
features are outside the Community analytics surface.

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
