# Draft: Voidhash Community is open source

> Publication draft. Do not publish or describe the platform as publicly
> launched until the alpha/beta security gate and repository-visibility
> checkpoint are complete.

Today we are publishing the complete Voidhash Community platform: the mobile
and web SDKs, paywall designer and renderer, backend, purchase integrations,
analytics pipeline, Mimic collaboration engine, and a self-hosted Docker
composition.

The SDK and integration surface is MIT licensed. The service platform and
self-host runtime are AGPL-3.0-only, which allows commercial self-hosting while
requiring operators of modified network services to follow the AGPL's source
availability terms. Closed Enterprise features and our internal operations and
deployment systems are not part of the Community repository.

The self-host composition runs the same application services as Voidhash Cloud
through provider-neutral platform contracts. It uses Node, PostgreSQL, MinIO,
an isolated component compiler, Chromium, SMTP, and optional ClickHouse.
Community signs in with a root account you configure in the environment and
uses your own provider credentials. Cloud remains the zero-operations path;
pricing is not being announced with this release.

We assembled and tested the complete repository privately before publication,
including tenant-boundary tests, provider-signature and replay tests, secret
and dependency scanning, clean Compose builds, release-level self-host smokes,
and a real cloud deployment. The security policy and threat model are included
in the repository, and vulnerabilities can be reported privately to
security@voidhash.com.

External patch intake will remain closed initially while we finish the CLA
acceptance workflow. Issues and responsible security reports are welcome.

Suggested launch links:

- Repository: https://github.com/voidhashcom/voidhash
- Self-hosting guide: `selfhost/README.md`
- Architecture: `docs/architecture.md`
- Licensing FAQ: `docs/licensing-and-self-hosting-faq.md`
- Security policy: `SECURITY.md`
