import SwiftUI
import SwiftData
import LocalAuthentication

/// Built-in, opt-in "mini apps". Self-contained: no budget types in here, so
/// a module can later move into a Swift package or a standalone app.
enum WooliModule: String, CaseIterable, Identifiable {
    case period, mood
    var id: String { rawValue }

    var title: String {
        switch self {
        case .period: "Period"
        case .mood: "Mood"
        }
    }

    var systemImage: String {
        switch self {
        case .period: "drop.fill"
        case .mood: "face.smiling"
        }
    }

    var tint: Color {
        switch self {
        case .period: Color(hex: "#ef4444")
        case .mood: Color(hex: "#eab308")
        }
    }

    var summary: String {
        switch self {
        case .period: "Track your cycle and see predictions. Stays on this iPhone and your iCloud."
        case .mood: "Log how you feel each day in one tap and spot patterns."
        }
    }

    // Settings keys (all default off except showOnHome once enabled).
    var enabledKey: String { "module.\(rawValue).enabled" }
    var showOnHomeKey: String { "module.\(rawValue).showOnHome" }
    var requireFaceIDKey: String { "module.\(rawValue).requireFaceID" }

    var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    var showsOnHome: Bool { UserDefaults.standard.object(forKey: showOnHomeKey) as? Bool ?? true }
    var requiresFaceID: Bool { UserDefaults.standard.bool(forKey: requireFaceIDKey) }
}

/// Face ID / passcode lock state for modules. Unlocks per module; everything
/// re-locks when the app goes to the background.
@MainActor
@Observable
final class ModuleLock {
    static let shared = ModuleLock()
    private(set) var unlocked: Set<WooliModule> = []
    var lastError: String?

    func isLocked(_ module: WooliModule) -> Bool { module.requiresFaceID && !unlocked.contains(module) }

    func lockAll() { unlocked.removeAll() }

    func unlock(_ module: WooliModule) async {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            lastError = error?.localizedDescription ?? "This iPhone has no passcode or Face ID set up."
            return
        }
        do {
            if try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock \(module.title)") {
                unlocked.insert(module)
                lastError = nil
            }
        } catch {
            lastError = error.localizedDescription
        }
    }
}

/// Wraps a module's full screen: shows a locked placeholder until Face ID succeeds.
struct ModuleGate<Content: View>: View {
    let module: WooliModule
    @ViewBuilder var content: Content
    @State private var lock = ModuleLock.shared

    var body: some View {
        if lock.isLocked(module) {
            VStack(spacing: 16) {
                Image(systemName: "lock.fill").font(.system(size: 44)).foregroundStyle(Theme.textTertiary)
                Text("\(module.title) is locked").font(.title3.weight(.semibold))
                if let error = lock.lastError {
                    Text(error).font(.footnote).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                }
                Button("Unlock with Face ID", systemImage: "faceid") { Task { await lock.unlock(module) } }
                    .buttonStyle(.borderedProminent)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background)
            .navigationTitle(module.title)
            .task { await lock.unlock(module) }
        } else {
            content
        }
    }
}

/// Home cards for enabled modules, in registry order.
struct ModuleHomeCards: View {
    @AppStorage(WooliModule.period.enabledKey) private var periodOn = false
    @AppStorage(WooliModule.period.showOnHomeKey) private var periodHome = true
    @AppStorage(WooliModule.mood.enabledKey) private var moodOn = false
    @AppStorage(WooliModule.mood.showOnHomeKey) private var moodHome = true

    var body: some View {
        if periodOn && periodHome { PeriodHomeCard() }
        if moodOn && moodHome { MoodHomeCard() }
    }
}

/// Card shown instead of details while a module is locked.
struct LockedModuleCard: View {
    let module: WooliModule
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: module.systemImage).foregroundStyle(module.tint).font(.title3)
            Text(module.title).font(.headline).foregroundStyle(Theme.text)
            Spacer()
            Image(systemName: "lock.fill").foregroundStyle(Theme.textTertiary)
        }
        .card(padding: 16)
    }
}

/// The screen a module card opens.
@ViewBuilder
func moduleScreen(_ module: WooliModule) -> some View {
    switch module {
    case .period: ModuleGate(module: .period) { PeriodView() }
    case .mood: ModuleGate(module: .mood) { MoodView() }
    }
}

// MARK: - Settings → Modules

struct ModulesSettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context

    var body: some View {
        Form {
            Section {
                Text("Extra tools built into Wooli. Everything stays on this iPhone and your own iCloud, like your budget. Turning a module off hides it — your data stays until you delete it.")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
            }
            ForEach(WooliModule.allCases) { module in
                ModuleSettingsSection(module: module, isSample: app.mode == .sample)
            }
        }
        .navigationTitle("Modules")
    }
}

private struct ModuleSettingsSection: View {
    let module: WooliModule
    let isSample: Bool
    @Environment(\.modelContext) private var context
    @AppStorage private var enabled: Bool
    @AppStorage private var showOnHome: Bool
    @AppStorage private var requireFaceID: Bool
    @State private var confirmDelete = false

    init(module: WooliModule, isSample: Bool) {
        self.module = module
        self.isSample = isSample
        _enabled = AppStorage(wrappedValue: false, module.enabledKey)
        _showOnHome = AppStorage(wrappedValue: true, module.showOnHomeKey)
        _requireFaceID = AppStorage(wrappedValue: false, module.requireFaceIDKey)
    }

    var body: some View {
        Section {
            Toggle(isOn: $enabled.animation()) {
                HStack(spacing: 12) {
                    ModuleIconTile(symbol: module.systemImage, tint: module.tint, size: 30)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(module.title)
                        Text(module.summary).font(.caption).foregroundStyle(Theme.textTertiary)
                    }
                }
            }
            .onChange(of: enabled) { _, on in
                if on && isSample { ModuleSampleData.seed(module, context: context) }
            }
            if enabled {
                Toggle("Show on Home", isOn: $showOnHome)
                Toggle("Require Face ID", isOn: $requireFaceID)
            }
            Button("Delete all \(module.title) data", role: .destructive) { confirmDelete = true }
        }
        .confirmationDialog("Delete all \(module.title) data?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { ModuleData.deleteAll(module, context: context) }
        } message: {
            Text("This removes every \(module.title.lowercased()) entry from this iPhone and your iCloud. It can't be undone.")
        }
    }
}

enum ModuleData {
    static func deleteAll(_ module: WooliModule, context: ModelContext) {
        switch module {
        case .period: try? context.delete(model: PeriodEntry.self)
        case .mood: try? context.delete(model: MoodEntry.self)
        }
        try? context.save()
    }
}

/// Small square SF Symbol tile (module icon in Settings).
private struct ModuleIconTile: View {
    let symbol: String
    let tint: Color
    var size: CGFloat = 30
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(tint.gradient, in: RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
    }
}
