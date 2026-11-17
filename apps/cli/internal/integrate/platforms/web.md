Read first: [[codeList .Platform.Reference]] (the API of the installed SDK), the app's entry ([[if eq .Platform.ID "nextjs"]]`app/layout.tsx` and any existing providers component, or `pages/_app.tsx` with the Pages Router[[else if eq .Platform.ID "react"]]`src/main.tsx` or whichever file calls `createRoot`[[else]]the script your HTML entry loads[[end]]), and wherever the app learns who the visitor is (sign-in, sign-up, sign-out, session restore).

The publishable key is in the environment variable `[[index .EnvNames 0]]`[[if .CustomAPI]] and the API server in `[[index .EnvNames 1]]`[[end]] (already written to `[[.EnvFile]]`). Reference the variable[[if .CustomAPI]]s[[end]]; do not write the key into source.
[[if eq .Platform.ID "nextjs"]]

1. **Mount the provider once, at the root.** With the App Router, render it from a client component of the app's own, and wrap the root layout's children in it. If the app already has such a providers component, add `VoidhashProvider` there instead of making a second one.

   ```tsx
   // app/providers.tsx
   "use client";

   import { VoidhashProvider } from "@voidhash/web/react";

   export function Providers({ children }: { children: React.ReactNode }) {
     return (
       <VoidhashProvider config={{ publishableKey: process.env.[[index .EnvNames 0]][[if .CustomAPI]], baseUrl: process.env.[[index .EnvNames 1]][[end]] }}>
         {children}
       </VoidhashProvider>
     );
   }
   ```

   With the Pages Router, render the provider in `pages/_app.tsx`. Never call `initialize()` at the top level of a module: client components also run on the server. An unset key makes the client inert rather than failing, so pass the variable as it is.
   [[else if eq .Platform.ID "react"]]

1. **Mount the provider once, at the root.** Wrap the tree passed to `createRoot(...).render` in the provider, next to the app's other providers:

   ```tsx
   import { VoidhashProvider } from "@voidhash/web/react";

   <VoidhashProvider config={{ publishableKey: import.meta.env.[[index .EnvNames 0]][[if .CustomAPI]], baseUrl: import.meta.env.[[index .EnvNames 1]][[end]] }}>
     <App />
   </VoidhashProvider>
   ```

   [[if .TypeScript]]If the project declares its environment variables (an `ImportMetaEnv` interface in `src/vite-env.d.ts` or similar), add `[[index .EnvNames 0]]`[[if .CustomAPI]] and `[[index .EnvNames 1]]`[[end]] there as `string`. [[end]]The provider creates the client and initializes it when it mounts.
   [[else]]

1. **Create the client once.** Add a module the page's entry script imports, in the project's source directory and language, and import it from the entry:

   ```ts
   import { createVoidhashClient } from "@voidhash/web";

   export const voidhash = createVoidhashClient({
     publishableKey: import.meta.env.[[index .EnvNames 0]],[[if .CustomAPI]]
     baseUrl: import.meta.env.[[index .EnvNames 1]],[[end]]
   });

   void voidhash.initialize();
   ```

   If the project uses a UI framework with its own provider or plugin convention, keep this one module and import the client from it where needed.
   [[end]]
   Page views, including client-side route changes, and campaign attribution are recorded from then on. Add no page view tracking of your own.

1. **Identify signed-in visitors.** Where the app has a signed-in user (after sign-in or sign-up, and when a stored session is restored), call `identify(userId, { email })` on the client with the app's own stable user id; pass only the traits the app already has. Where the app finds no session or signs the user out, call `signOut()`. [[if or (eq .Platform.ID "nextjs") (eq .Platform.ID "react")]]Inside React, get the client's functions from the hooks of `@voidhash/web/react` (`useVoidhash()`, `useAnalytics()`); check their exact return shape in the README before using them. [[end]]Neither call waits for the network or throws because of it. If the app has no accounts, skip this step and say so in the report.

1. **Track the one or two events that matter.** Find the action that means a visitor got value or started to pay (for example a completed sign-up, a started checkout, a created item) and record it with `track("snake_case_name", { ... })`[[if or (eq .Platform.ID "nextjs") (eq .Platform.ID "react")]], from `useAnalytics()` in React[[end]]. Add at most two events, with properties that are not personal data, and list their names in the report. If nothing in the app clearly qualifies, add none and say so.

The web SDK does not check perks, present paywalls or take payments; add no code for those. If the app has a checkout, do not change it: name it in the report, with a pointer to https://voidhash.com/docs/sdks/web/checkouts.

If the site asks for cookie or analytics consent, do not bypass it: say so in the report with a pointer to https://voidhash.com/docs/sdks/web/privacy, and leave consent wiring to the person.
