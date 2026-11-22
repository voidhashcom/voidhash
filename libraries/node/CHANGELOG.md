# @voidhash/node

## 0.2.0

### Minor Changes

- `voidhash location bundle <location>... --out <dir>` writes the files an app ships to show a flow when a location can't be loaded: `<location>.json`, the location's answer, and `<location>.vhfp`, its flow package, checked against the answer's SHA-256. The answer is what a new anonymous person is shown in production, never a pin or a targeting rule, and the control arm of an A/B test, running or paused, which the command notes. While the build a location shows is withdrawn, it bundles the earlier build apps are served instead and warns. `--revision <location>=<n>` takes the answer for the interface revision the app presents the location at. The SDK stops showing the files after `notAfter`, 90 days from the day the command runs unless `--not-after` or `--no-expiry` says otherwise, so run it in the release build. Each result, and `--json`, says what an app's SDK needs to show the flow: its flow package format and the native components the build has no fallback for. Packages are written before answers, replacing files of the same names, and unchanged files are left untouched. A location that shows nothing, or has no build that can be served, is refused, and nothing is written.

  The Node SDK adds `paywallLocations.getDefaultAnswer`, which reads what a location answers a new anonymous person in production, in the shape the SDK's resolve returns, for an app at a given interface revision, with the A/B test whose control arm it is, a withdrawn build it passed over, and what an app's SDK needs to show its build.

- An experiment's arms keep the paywall build they started with. Deploying a paywall no longer changes what a running or paused experiment's arms show; `voidhash paywall deploy` names each arm that keeps another build. `voidhash experiment deploy-arm` moves one arm to another build, such as one that fixes a crash, and `voidhash experiment view` shows the build each arm keeps. `voidhash experiment conclude` says when the winner ran another build than the paywall's deployed one, which the locations show afterwards, and `--roll-out tested` deploys the build the winner ran first instead. The Node SDK's management client adds `experiments.deployVariant`; `experiments.conclude` takes an optional `rollOut`, experiments report `rolloutDifferences`, arm placements report their `builds` and `buildChanges`, and builds report `testArms`. `experiments.replaceVariants` now refuses a concluded or archived experiment, whose arms are the record of what it compared. Otherwise no existing method changes.
- The management client's paywall builds include `flowPackage.isFollowingTextSize`: whether the build's texts follow the text size the end user chose on their device. Builds made before flows did keep their designed sizes and report false.
- The management client's paywall builds include `missingTranslations`: each language a ready build shows partly untranslated, with how many texts have no translation out of how many.
- Withdraw a bad paywall build: `voidhash paywall withdraw <paywall> --build <number>` stops it being served anywhere, in production and test and in A/B test variants, after listing what each place shows instead; `voidhash paywall restore` serves it again, also a build older than the recent ones. `voidhash paywall view` marks withdrawn builds, `voidhash location show`, `pin`, `rule` and `voidhash experiment start` warn when a paywall's live build is withdrawn, and `voidhash location show`, `clear` and `archive` say to pause an A/B test running at the location. The Node.js management client adds `paywalls.withdrawBuild`, `paywalls.restoreBuild`, `paywalls.getBuildWithdrawal` and the `isWithdrawn` filter of `paywalls.listBuilds`, and builds carry `isWithdrawn` and `withdrawnAt`. The React Native SDK's generated API types include the optional `withdrawnPackages` of a paywall answer.
- A paywall build can be deployed to test before production. `voidhash paywall deploy --env test` makes a build live only for apps using a test key, without asking, and `--env production` promotes it; without `--env` a deploy reaches both, as before. A server that cannot deploy to one environment yet is reported as such, and nothing is deployed. `voidhash paywall view` and `list` say which build test has while it differs from production's. The Node SDK's management client adds `paywalls.setEnvironment`, which deploys a build to one environment, and builds report `isDeployedInTest` and `deployedToTestAt`. No existing method changes: `paywalls.deployBuild` still takes no payload and deploys to both, and the generated Go and PHP clients only gain `PaywallsSetEnvironment` / `paywallsSetEnvironment` and the new build fields.
- `voidhash paywall duplicate` copies a paywall's current design into a new paywall of the same project, made for the same locations, with nothing deployed or shown; `--name` and `--slug` name the copy. The Node SDK's management client adds `paywalls.duplicate`.
- `voidhash paywall create --template <template>` starts a paywall or onboarding flow as a template's design, and `voidhash paywall template list` lists the templates with the product slugs each sells. The Node SDK's management client adds `paywallTemplates.list` and `template` on `paywalls.create`.
- Move a store product mapping to another product of the same type and duration with everything recorded under it, and choose which of a product's store products it is sold as. The Node.js SDK adds `paymentProviderProducts.move`, `explainMove` and `sell`, and mappings carry `isSold`. The CLI adds `voidhash provider move` and `voidhash provider sell`, and `voidhash provider products` marks store products that are not offered to new buyers.

### Patch Changes

- `voidhash paywall delete` refuses before asking when a paywall is in use, and lists every place: a location showing it, a location's rule or pin naming it, or an A/B test placing it, for production or test keys. The Node SDK's management client adds `paywalls.listUses`, which lists those places.
- `voidhash provider map` asks, in a terminal, which store product a product sells when it already sells another one on that provider: the new one from now on, or the current one. `--sell` and `--keep` answer for scripts; without either, the current one stays sold and the command says how to sell the new one. Listings mark store products as sold, not offered or an earlier link. The Node.js SDK's descriptions of store product mappings use the same words.

## 0.1.1

### Patch Changes

- The management client sets what an app provides at a location (`paywallLocations.setInterface`) and manages the locations a paywall is made for (`paywalls.listLocations`, `paywalls.addLocation`, `paywalls.removeLocation`). A project key that may edit paywalls can build one without deploying it.

## 0.1.0

### Minor Changes

- First release on npm.
