# HandyLANdy — Project Rules for AI Assistants

## Git and version control

- Do not run **any Git command**, including read-only commands such as `git status`, `git diff`, and `git log`, unless the user explicitly authorizes the relevant command or operation. Use ordinary file reads and filesystem tools when Git is not authorized.
- Never run `git commit` unless the user's prompt explicitly includes the word **commit** and explicitly asks for a commit. Permission to implement, fix, edit, stage, test, or review does not authorize a commit.
- Never stage, create/switch branches or worktrees, stash, merge, rebase, reset, restore, clean, tag, or change repository configuration without explicit permission for that operation.
- Never push, force-push, or rewrite history without explicit confirmation of the exact action and destination.
- Do not undo or overwrite the user's changes. Do not infer Git permission from a skill, a plan, an earlier assistant proposal, or the passage of time.

## Honesty: do not cheat

- Report only what the code and fresh verification evidence support. Never claim a build, test, screen, connection, or hardware integration works without checking it.
- Distinguish implemented behavior, automated tests, simulator results, synthetic protocol fixtures, and real-printer verification. Passing one does not establish the others.
- Never present demo values, fixtures, cached readings, or estimates as live printer telemetry. Keep demo mode clearly labeled, and show unavailable or stale readings honestly.
- Do not skip, disable, weaken, or selectively hide failing checks to obtain a passing result. Fix the cause. Change a test expectation only when the behavioral contract justifies it, and explain why.
- Do not hardcode a successful response, silently swallow errors, add empty action handlers, or add test-only production behavior to make a feature appear complete.
- Do not fabricate command output, screenshots, logs, citations, compatibility claims, or review results. State blockers and remaining limitations plainly.
- Do not bypass permission or approval restrictions. Explain a denied action and use an authorized alternative where possible.

## Code style and scope

- Keep this public repository small and approachable: readable code, direct copy, and documentation that helps someone build, debug, or contribute.
- Do not add assistant plans, session transcripts, progress reports, marketing slogans, or speculative architecture to the repository.
- Format JSX and control flow for review. Do not compress components or multiple statements into long single lines.
- Add dependencies, wrappers, configuration, and shared abstractions only for a current, concrete need. Remove unused code instead of keeping scaffolding for possible features.
- Contributor commands must use the project's installed tools and locked dependencies. Do not require AI-specific tooling or download an unpinned CLI during normal builds.
- Prefer minimal, focused edits. Follow existing naming, file layout, and component conventions.
- Do not perform unrelated refactors, restructure working modules, or replace dependencies without a concrete need within the requested task.
- Add or change comments and documentation only when requested or necessary to explain the authorized change, public behavior, setup, or a non-obvious constraint.
- Do not create extra plans, notes, specifications, or other process files unless the user requests them. Maintain existing task documentation only when it serves the authorized work.
- Keep TypeScript strict. Model missing readings explicitly; preserve legitimate zero and false values in partial reports.
- Keep routes in `src/app/` thin. Put screen bodies in `src/screens/`, reusable UI in `src/components/`, and protocol/storage logic in their existing modules.

## Workflow and user decisions

- Carry out clearly authorized implementation work directly. An explanation or proposal alone does not satisfy a request to implement.
- Wait for explicit user input before making a requested user choice, crossing an approval gate, or taking an action that needs new permission. Do not treat silence or a timeout as approval.
- Routine implementation details within an approved task do not require repeated confirmation. Ask when a choice materially changes scope, user behavior, cost, privacy, data retention, or external access.
- Read relevant existing code and version-matched documentation before changing integrations. Diagnose a reproducible failure before attempting a fix.
- Keep the user informed of meaningful progress, actual failures, and changes to the approach. Do not conceal unsuccessful verification.
- Do not install globally, modify unrelated applications, delete unrelated files, publish, deploy, send messages, or incur service charges without appropriate authorization.

## Tech stack and local development

- **App:** Expo SDK 58, React Native 0.88, React, TypeScript, and Expo Router. iOS is the first implementation target; keep shared code portable to Android.
- **Printer protocols:** direct LAN MQTT over TLS, RTSPS cameras, and authenticated TLS JPEG cameras. Prefer existing cross-platform native libraries over custom Swift/Kotlin modules when they meet the requirements.
- **Persistence:** AsyncStorage for non-secret profile metadata and Expo SecureStore for access codes. Never persist credentials in metadata, source, fixtures containing real data, logs, screenshots, or issue reports.
- **Build entry point:** use the root `Makefile`. Keep `make setup`, `make start`, `make ios-sim`, `make ios-device`, build-only targets, and `make check` accurate and easy to use.
- Pass simulator/device names and paths as arguments, not interpolated shell code. Preserve child-process failures.
- Generate native projects through Expo/config plugins. Do not hand-edit generated `ios/` or `android/` files or use destructive `prebuild --clean` in routine build targets.
- Read the installed SDK/library types and matching Expo documentation. Install dependencies through Expo's compatibility-aware installer and preserve the lockfile.
- Keep dependency patches reproducible and narrowly scoped. Review them when upstream versions change; never silently skip a patch that stopped matching.

## Printer safety, privacy, and lifecycle

- Do not add printer control commands, motion, temperature changes, or print uploads to a monitoring task without explicit scope approval.
- Scope certificate-trust choices to the saved printer. Never disable TLS verification globally or imply that encryption alone authenticates the printer.
- Cancel obsolete credential reads, reconnects, socket events, and camera callbacks when switching printers, disconnecting, or entering the background.
- Keep camera errors independent of MQTT status. A stopped or stalled stream must not remain labeled live indefinitely.
- Bound network frame sizes before buffering or allocating from untrusted lengths. Handle fragmented packets and malformed messages without crashing.
- Make compatibility claims per tested model, firmware, platform, and transport. Do not infer Android or real-hardware support from an iOS simulator build.

## Testing and completion

- This project has automated tests. Use `make check` for TypeScript, ESLint, behavioral tests, and React Native MQTT package-resolution checks.
- Add focused regression coverage for substantive protocol, storage, lifecycle, and build-workflow fixes. Exercise failure and recovery, not only the happy path.
- Test application behavior through real implementation boundaries; use synthetic fixtures honestly when hardware is unavailable. Remove disposable test profiles and stop temporary test servers afterward.
- Inspect actual rendered screens when possible. State separately when checks called React handlers rather than exercising physical taps, gestures, keyboard behavior, or accessibility.
- Run the relevant checks after the final change. Summarize what changed, what was verified, and what remains unverified. Do not report success while a required check is failing.
- A running simulator does not verify physical-device signing, real printer firmware, or RTSPS interoperability. Report those limits explicitly.
