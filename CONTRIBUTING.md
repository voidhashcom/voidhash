# Contributing to the Voidhash SDKs

Thanks for taking the time to improve Voidhash!

Bug fixes, documentation improvements and well-scoped SDK changes are welcome.
For a larger change, open an issue first so we can agree on the approach.

## How a contribution lands

This repository is a synchronized distribution of the Voidhash SDKs, the CLI
and the examples. Open a pull request against `main` as you would in any
other project. Once it is approved, a maintainer imports it into the project's
validation workflow, which builds and tests it with every SDK. The accepted
change then lands on `main` with you preserved as its Git author, and your
pull request closes automatically. Do not push directly to `main`; it is
maintained by the synchronization bot.

The packages are built, tested and released from that validation workflow, so
this repository has no workspace to install or test suites to run. Describe how
you checked your change in the pull request, for example in one of the
[examples](examples).

Every external contributor must accept the
[Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md) before a
contribution can be merged.

## Guidelines

- Prefer opinionated, best-practice defaults to extensive configuration.
- Keep APIs consistent and predictable across the SDKs; a change to one SDK's
  behavior usually belongs in the others too.
- Preserve end-to-end type safety.
- Add JSDoc (or the language's equivalent) to public functions and keep the
  READMEs current.
- Keep pull requests focused. Titles follow
  [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for
  example `fix: retry a purchase restore after a timeout`.

## Security issues

Report suspected vulnerabilities privately to
[security@voidhash.com](mailto:security@voidhash.com). Do not open a public
issue or pull request for a vulnerability. See the [security policy](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE.md). The Contributor License Agreement is an additional
requirement for external contributions.
