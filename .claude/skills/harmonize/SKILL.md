---
name: harmonize
description: Run an iPhone harmonization pass for Wooli. Reads the "iOS harmonization log" in ios/Wooli/BACKLOG.md (Mac-first changes not yet checked on iPhone), builds the iPhone app, checks each entry in the iOS Simulator, fixes iPhone-only problems, and moves checked entries to Done. Use when the user says /harmonize, "harmonize", "build the iPhone version", or "catch iOS up with the Mac".
---

# Harmonize: bring the iPhone build up to date with Mac-first work

Wooli is built and tested on the Mac first. Any change that touches shared code or behaves differently on the iPhone is logged under **"## iOS harmonization log"** in `ios/Wooli/BACKLOG.md`. This skill works through that log on the iPhone.

## 1. Read the log
- Open `ios/Wooli/BACKLOG.md` and find the `## iOS harmonization log` section.
- List each open `- [ ]` entry for the user in one line apiece.
- If the section has no open entries, say so and stop.
- Read `ios/Wooli/DesignSystem/README.md` before changing any view.

## 2. Build for iOS
- Find a booted iPhone simulator: `xcrun simctl list devices booted`. If none is booted, boot an iOS 26 iPhone, preferring `iPhone 17 Pro`.
- Call the iOS Simulator `attach` action first so the user can watch.
- Build:
  ```bash
  cd ios/Wooli && xcodebuild -scheme Wooli -destination 'id=<UDID>' -derivedDataPath /tmp/wooli-dd build -quiet 2>&1 | grep -E "error:" | head
  ```
  The build can take several minutes; run it in the background if needed. If there are compile errors, fix them first. They usually come from Mac-only code missing an `#if os(macOS)` guard, or iOS code depending on a Mac shim in `Shared/Platform/MacShims.swift`.
- Install and launch with the local demo trip:
  ```bash
  xcrun simctl install booted /tmp/wooli-dd/Build/Products/Debug-iphonesimulator/Wooli.app
  ```
  ```bash
  xcrun simctl launch --terminate-running-process booted com.timothyeng.wooli -sampleTrip -noSplash
  ```

## 3. Check each entry
For each open entry:
- Follow its "Not checked" notes in the Simulator using screenshot, tap, swipe and `touch_path`.
  - Screenshots can lag a step; take a second one if nothing seems to have changed.
  - For a long-press drag, hold about 600 ms and then move.
- Look for problems that only show on the iPhone: nav bar and toolbar placement, safe areas and the keyboard, sheets, light and dark mode, and touch targets.
- Fix real iPhone problems in shared code without breaking the Mac. Wrap platform-specific code in `#if os(iOS)` / `#if os(macOS)`.
- If a fix touched shared code, confirm the Mac still builds:
  ```bash
  xcodebuild -scheme Wooli -destination 'platform=macOS' -derivedDataPath /tmp/wooli-mac-dd build -quiet
  ```
- Some things the Simulator can't check: a real device, iCloud sync, HealthKit, or a CloudKit schema deploy. Leave those in the entry's note for the user.

## 4. Update the log
- An entry that passes moves to the top of `## Done` as a dated line: `**YYYY-MM-DD · Claude** — iPhone check: …`. Say what was checked and anything still unchecked. Then delete it from the log.
- An entry that fails, or can't be checked, stays in the log with an updated note.
- Do not commit unless the user asks. If they do, run `npm run check` from the repo root first, and put the BACKLOG update in the same commit.

## 5. Report
Tell the user, briefly:
- what passed
- what you fixed
- what's still open and why
- whether the Mac build still passes
