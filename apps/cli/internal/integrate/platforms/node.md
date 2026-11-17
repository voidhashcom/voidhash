Read first: [[codeList .Platform.Reference]] (the API of the installed SDK), the server's entry and how it reads configuration, and where it decides what a user may do.

The secret key comes from the environment variable `VOIDHASH_SECRET_KEY`. A person creates it in the dashboard; you never see it, and it never goes into source.

1. **Create the client once.** Add one module, where the project keeps its service clients and in its language and module system, that reads the key from the environment the way the project reads its other configuration:

   ```ts
   import { createVoidhashSdk } from "@voidhash/node";

   export const voidhash = createVoidhashSdk({
     secretKey: process.env.VOIDHASH_SECRET_KEY!,[[if .CustomAPI]]
     baseUrl: process.env.VOIDHASH_BASE_URL,
     ingestUrl: process.env.VOIDHASH_INGEST_URL,[[end]]
   });
   ```

   If the project validates its environment at startup (a schema or a config module), add `VOIDHASH_SECRET_KEY` there. Creating the client sends no request.
   [[if .Perk]]

2. **Check the perk `[[.Perk]]` where the server grants paid access.** Find the route, middleware or service that decides whether a user has the paid tier, and ask Voidhash, with the same user id the apps identify with:

   ```ts
   const hasAccess = await voidhash.entitlements.hasActivePerk({
     distinctId: user.id,
     perkSlug: "[[.Perk]]",
   });
   ```

   Check the call's exact name and result in the README. Decide deliberately what happens when the call fails, following how the project treats its other dependencies, and say which you chose in the report. If the server has no such decision, add none and say so.
   [[else]]

3. **Access checks.** The project has no perk yet, so add no access check. Say in the report where the server decides who has paid access.
   [[end]]
4. **Do not add events or webhooks unless the code already calls for them.** If the server already handles a billing webhook or records analytics events, name the place in the report; a person decides whether Voidhash replaces it.
