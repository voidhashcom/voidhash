# Integrate Voidhash into this [[.Platform.Name]] project

This directory is the root of a project of the kind [[.Platform.Name]]. Voidhash gives it [[.Capabilities]]. The setup that needs no knowledge of this codebase is already done. Your job is the part that does: wiring the SDK into this project's own code, in this project's own style, with the smallest change that works.

Work in this order: read, then edit, then check, then report. Do not ask questions; nobody can answer during this run. When something is unclear or cannot be done here, make the safe choice, leave the code working, and say so in the report.

## The Voidhash project

- Project: [[.ProjectName]] ([[.Team]]/[[.Project]])
  [[- if .TestKey]]
- Test publishable key: `[[.TestKey]]` (debug and staging builds; simulated or sandbox purchases)
  [[- end]]
  [[- if .ProductionKey]]
- Production publishable key: `[[.ProductionKey]]` (release builds)
  [[- end]]
  [[- if .CustomAPI]]
- API server: `[[.APIURL]]` (not the default https://api.voidhash.com, so the SDK needs its base URL option)
  [[- end]]
- Perks (what the app checks access for): [[list .Perks]]
- Products (what people buy): [[list .Products]]
- Paywall locations: [[list .Locations]]

Use only these slugs. Do not invent a perk, product or location: if the app needs one that is not listed, say so in the report.

## Already done, do not redo

[[range .Done]]- [[.]]
[[end]]
Do not install or upgrade packages, do not edit `voidhash.json`, generated type files or environment files, and do not run a package manager's install command. If a package is missing, say so in the report.

## What to do

[[.Guide]]

## Rules

- Stay inside this directory. Never read or write a file outside it.
- Never read, print, search or edit `.env` files of any name. The variable names you need are listed above; reference them, do not look at their values.
- Never put a secret key (`vh_sk_...`) or any other secret in source code, comments, logs or your report. Publishable keys (`vh_pk_...`) are public and may appear in app code where this document says so.
- Change only what the integration needs. Do not reformat, rename, refactor or "improve" unrelated code, do not change dependencies, lint or build configuration, and do not delete anything you did not add.
- Follow the conventions you find: file layout, naming, import style, quotes and semicolons, state management, navigation, the way existing providers are mounted.
- If Voidhash is already partly integrated, keep what is correct and complete it. Never add a second client or a second provider.
- The app must keep working when Voidhash cannot be reached or is not configured: no call you add may crash a screen or block startup. Handle the error and loading states the SDK reports.
- Do not send personal data as event properties, and do not add events beyond the ones asked for here.
- Do not commit, stash, reset or otherwise change git state. Leave your edits in the working tree for review.
- Use only APIs you have verified[[if .Platform.Reference]] in [[codeList .Platform.Reference]] or the package's type declarations[[end]]. The SDK's documentation is at [[.Platform.Docs]]. If the code and this document disagree, trust the installed package and say so in the report.

## Check your work

[[if .Checks]]Run [[if gt (len .Checks) 1]]each of these[[else]]this[[end]] from the project root and fix what your changes broke:

[[range .Checks]]- `[[.]]`
[[end]]
[[if .BaselineFailed]]These already failed before you started: [[codeList .BaselineFailed]]. Do not fix failures that were there before; only make sure you add none.
[[end]][[else]]No check command is known for this project. Re-read every file you changed and make sure it is syntactically complete and its imports resolve.
[[end]]You may not be able to run anything else (starting the app, installing, network access). That is expected.

## Report

End your final message with exactly one fenced block tagged `voidhash-report` holding JSON of this shape, and nothing after it:

```voidhash-report
{
  "status": "done | partial | blocked",
  "summary": "Two or three sentences: what the app now does with Voidhash.",
  "changes": [{ "file": "relative/path", "what": "one line" }],
  "left_for_you": ["Each thing a person still has to do, as an instruction."],
  "notes": ["Anything surprising: an existing integration, a conflict with this document, a check you could not run."]
}
```

The person is told these separately, so leave them out of `left_for_you`:

[[range .ToldSeparately]]- [[.]]
[[end]]
`done` means every numbered step above is in the code, or was skipped for a reason that step itself names, and the checks pass. `partial` means some steps are in and the code still builds; list the rest under `left_for_you`. `blocked` means you changed nothing useful; say why in `notes`. Report only what you did: a person will compare it with `git diff`.
