# Wooli 🐑

> **Private, on-device life tracker for iPhone and Mac.**  
> Keep track of your budget, trips, favorite places to eat, movies, recipes, and health — completely private, with no central servers, no accounts, and no tracking.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-iOS%2018%2B%20%7C%20macOS%2015%2B-black.svg)]()
[![Swift](https://img.shields.io/badge/Swift-6.0-orange.svg)]()
[![SwiftUI](https://img.shields.io/badge/SwiftUI-SwiftData-purple.svg)]()

---

## ✨ Features

- **💰 Budget & Net Worth:**  
  Plan income and expenses by category, track monthly spending pace, and review new transactions one tap at a time. Connect your bank accounts directly through [SimpleFIN Bridge](https://beta-bridge.simplefin.org) (credentials stay in your iCloud Keychain), or enter amounts manually.
- **🗺️ Trips & Itineraries:**  
  Plan day-by-day trips with stays, flights, trains, and dining ideas on Apple Maps. Collaborate with friends via private iCloud sharing.
- **🍽️ Eats & Rankings:**  
  Rank restaurants with pairwise comparisons (*"Which was better?"*). Save spots to your *Want to Try* wishlist directly from Apple Maps shares or Instagram reels.
- **🎬 Movies & Recipes:**  
  Rank films the same way you rank restaurants. Share recipe reels from Instagram to automatically extract ingredients and steps on-device.
- **🌸 Health (Apple Health):**  
  Privately track your cycle and symptoms directly from Apple Health with on-device predictions and optional Face ID lock.

---

## 🔒 Private by Design

- **No Central Wooli Servers:** No account sign-up, no analytics, no third-party telemetry, and no ads.
- **On-Device Storage:** All data lives in local **SwiftData** on your iPhone and Mac.
- **Private iCloud Sync:** Syncs between your Apple devices using your personal, encrypted **CloudKit** private database. Only you (and people you explicitly invite) can access it.
- **Direct Banking:** Bank credentials and access keys live strictly in your encrypted **iCloud Keychain**. Financial data travels directly from SimpleFIN to your device.

---

## 📂 Repository Structure

```
Wooli/
├── ios/Wooli/        # Native SwiftUI app for iPhone and Mac (Xcode project)
│   ├── Wooli/        # Main application source (Budget, Trips, Eats, Health, Models)
│   ├── WooliShare/   # iOS Share Sheet Extension (Apple Maps & Instagram import)
│   └── AppStore/     # App Store listing copy and display screenshots
├── app/              # Next.js static intro & compliance site (wooli-rho.vercel.app)
├── docs/             # Technical specifications, feature specs, and architecture
├── admin/            # Project context & Muse assistant operating guide
├── LICENSE           # Apache License 2.0
└── AGENTS.md         # Developer guide and conventions for AI collaborators
```

---

## 🚀 Building & Running

### Requirements
- **macOS Sonoma** or later
- **Xcode 16.0+**
- iOS 18.0+ / macOS 15.0+

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/timothyeng05/Wooli.git
   cd Wooli
   ```
2. Open the Xcode project:
   ```bash
   open ios/Wooli/Wooli.xcodeproj
   ```
3. In Xcode, select the **Wooli** target → **Signing & Capabilities**:
   - Choose your personal **Team**.
   - If running on your own physical device, change the Bundle Identifier to your own prefix (e.g., `com.<your-name>.wooli`).
4. Select an iPhone Simulator (e.g. **iPhone 16 Pro**) or your connected device, and press **Cmd + R** to run!

---

## 📄 License

Wooli is licensed under the **[Apache License 2.0](LICENSE)**.
Copyright © 2026 Timothy Eng.
