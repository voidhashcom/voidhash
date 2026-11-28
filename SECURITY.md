# Security Policy

## Supported Versions

The SDKs and the CLI are released as 0.x versions. Security fixes are released
in a new version of the latest release line of each SDK and of the CLI; upgrade
to it to receive them. Older versions, pre-release builds and code that was not
published as a release are not supported.

| Package                                         | Supported               |
| ----------------------------------------------- | ----------------------- |
| SDKs (iOS, Android, React Native, web, servers) | Latest 0.x release only |
| CLI                                             | Latest release only     |
| Examples                                        | Latest `main` only      |

## Scope

This policy covers the code in this repository: the SDKs, the CLI and the
examples. Vulnerabilities in the hosted Voidhash service, such as its API and
Studio, can be reported the same way. Security testing of the hosted service
beyond your own account requires our prior written consent.

Reports about third-party dependencies are welcome when Voidhash's use of them
is affected. Missing best-practice headers, findings from automated scanners
without a demonstrated impact, and social engineering are out of scope.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to
[security@voidhash.com](mailto:security@voidhash.com). Do not open a public
issue, discussion, or pull request for a vulnerability.

Include the affected package and version, reproduction steps, expected impact,
and any suggested mitigation. We will acknowledge the report, investigate it,
and coordinate remediation and disclosure with the reporter. Please avoid
accessing data that is not yours, disrupting services, or exploiting a finding
beyond what is necessary to demonstrate it. We do not run a paid bug bounty
program.
