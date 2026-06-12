# Paywalls MVP

## Context
Voidhash is a Google Play and App Store subscription management platform. It includes analytics, revenue tracking, server side recipe validation and much more.

## Objective
In this task, we want to add highly requested feature - Paywalls. Similar to Superwall, we want to enable our customers to quickly change and test their paywalls without re-deploying their app. In the future, we will have a GUI paywall builder but for now, we will have fully code driven paywall building experience. For this task, I have scaffolded an MVP version of the code, that will define both paywalls and re-usable components in ./examples/react-native-example (in a .voidhash folder)

## Paywalls
Paywalls are screens in a mobile app where the app user can purchase something - this could be subscription, one time items etc. Each app needs it's own distinct look and have a different use-case for it. In our MVP, paywalls are code driven and they are defined via a createPaywall. Both paywalls and components will live in .voidhash folder, that will be scaffolded by the CLI. There will be 2 folders - components for re-usable component definitions and paywalls for individual paywall designs.

## Components
As mentioned previously, components are re-usable primitives across paywalls. They are mostly designed to add dynamic, interactive logic (carousels, sheets etc.).


## How will they work, custom react, renderers
Paywalls will be powered by react. Instead of using react-dom, we will impement our own renderer (that will use HTML DOM under the hood). We want to build a scoped, abstract way for building paywalls to allow as to build native renderers in the future as well. The API will be similar to react-native with View, Text, Pressable, ScrollView etc.

## Studio
Studio is vite js application, that is ran via our CLI. It previews the paywalls and refreshes in real-time as the paywall changes. There will be a sidepanel on the right with list of all paywalls. We can switch between them. In the middle, there will be 9:16 aspect ratio (phone) preview. It will use tailwind for styling and shadcn for UI primitives.

## CLI
We need to extend our CLI with few commands
```voidhash-cli studio``` will launch the paywall preview studio
```voidhash-cli deploy``` will build and deploy everything to Voidhash

# Bundling and deployment
As part of this task, we need to define the entire flow and specify, what will be sent to our server and in what format. Modifying the backend service will be the next task. We need to create final html / js, that will be server and rendered in a mobile webview as the paywall itself. We also want to send the raw source code files to the server (both, components and paywalls) and we need to deploy assets. Create PAYWALLS-MVP-SERVER-SPEC.md that will map all the requirements and protocols the server should implement for it to integrate together well.