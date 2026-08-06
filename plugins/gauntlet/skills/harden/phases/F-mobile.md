# Phase F — Store presubmission

**N/A for web-only projects.** Record it as N/A and move to G.

> Written once and never run end to end. No build in the evidence base has been
> submitted to a store. The platform constraints and compliance rules below are
> verified; the workflow is a reviewed plan. Correct it from your first real
> submission.

## Decide the track before anything else

This determines whether the phase is even possible today.

| Track | Buildable on Windows? | Why |
|---|---|---|
| **Android** | **Yes — end to end** | Android Studio runs on Windows, Gradle produces the AAB there, you test on your own device over USB, and Play Console submission is entirely web-based. |
| **iOS** | **No — needs macOS** | Xcode, code signing, and App Store Connect upload are macOS-only. Borrow a Mac, rent a cloud Mac (Codemagic, Bitrise, GitHub Actions `macos` runners, MacStadium), or defer. |

**Ship Android first if you are on Windows.** It is the whole loop with no Mac.
Treat iOS as a separate milestone.

Confirm the wrapper too: **Capacitor and Expo differ substantially** in build and
submission steps, and a checklist written for one does not transfer.

## Accounts and fees, before you start

Nothing below can proceed without these, and provisioning takes real time:

- Google Play Developer account — $25 one-time
- Apple Developer Program — $99/year (iOS only)
- Push provider project (Firebase for FCM; APNs key for iOS)
- IAP provider linked to Play Billing / StoreKit, if you sell anything

## Static review — do this from the code first

Cheaper than a rejected submission, and every item is checkable without a device.

- **Build output path** (`webDir` or equivalent) correct. A wrong one produces a
  blank app shell that passes CI and fails review.
- **Bundle ID / application ID** matches the store listing exactly.
- **Version and build number** increment correctly; know the process for the next
  update before you need it.
- **Permissions** each have a purpose string that matches actual use. A permission
  you request and never use is a rejection.
- **Push entitlement** present if you send notifications, absent if you don't.
- **Privacy manifest** (`PrivacyInfo.xcprivacy` on iOS) exists and matches what
  the app actually collects.
- **Deep links / URL scheme** registered.
- **Notification content** reviewed for anything sensitive appearing on a lock
  screen — this is a Phase B finding class (see `phases/B-security.md`).

## On-device verification

The step nobody can skip and everybody wants to:

- **Built and run on a physical device.** Not a simulator. A web build that has
  never been wrapped is not ready, whatever the config says.
- **Offline behaviour tested on-device.** Service-worker behaviour in a native
  webview differs from a browser.
- **Deep links opened from outside the app** — a message, an email, a browser.
- **Purchase flow completed** in the store's sandbox, including restore.

## Store compliance

- **Minimum functionality.** A wrapped website with no native value is rejected
  under Apple's 4.2. Offline capability and native integrations are the usual
  answers — document which one applies to you before submitting.
- **In-app purchase.** Digital goods consumed in-app must use the platform's IAP.
  Honouring a web-purchased subscription inside the app is allowed; putting a web
  *checkout link* in the app is not.
- **Account deletion reachable in-app.** Both stores require it. A link to a web
  page does not satisfy it.
- **Privacy nutrition labels** matching actual collection, not intended
  collection.
- **Reviewer demo account** with credentials that work, seeded with enough data
  that the reviewer can see the app do something. Include it in the review notes.
  A reviewer who cannot get past your empty state rejects the build.
- Age rating and export compliance answered.

## Gate

Judgment — Phase F does not pass until:

- [ ] Track decided; Mac access confirmed if iOS is in scope
- [ ] Wrapper confirmed (Capacitor vs Expo) and the build steps match it
- [ ] Accounts provisioned and IAP products created
- [ ] Static review complete — build path, bundle ID, permissions, entitlements
- [ ] Built and run on a **physical device**
- [ ] Purchase and restore completed in sandbox
- [ ] Minimum-functionality position documented
- [ ] Account deletion reachable in-app
- [ ] Privacy labels match actual collection
- [ ] Reviewer demo account created, seeded, and verified working

**The owner runs the build and submission.** This phase produces the readiness
document and the blocker list.
