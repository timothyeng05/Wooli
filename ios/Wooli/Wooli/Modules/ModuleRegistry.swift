import SwiftUI
import SwiftData
import LocalAuthentication

/// Built-in, opt-in "mini apps". Self-contained: no budget types in here, so
/// a module can later move into a Swift package or a standalone app.
enum WooliModule: String, CaseIterable, Identifiable {
    case period
    var id: String { rawValue }

    var title: String {
        switch self {
        case .period: "Period"
        }
    }

    var systemImage: String {
        switch self {
        case .period: "drop.fill"
        }
    }

    var tint: Color {
        switch self {
        case .period: Color(hex: "#ef4444")
        }
    }

    var summary: String {
        switch self {
        case .period: "Track your cycle and see predictions. Reads and saves through Apple Health."
        }
    }

    // Settings keys (all default off).
    var enabledKey: String { "module.\(rawValue).enabled" }
    /// Old "Also show on Budget dashboard" switch; only read to carry the
    /// choice over to Today (`AppLineup.hiddenCards`).
    var showOnHomeKey: String { "module.\(rawValue).showOnHome" }
    var requireFaceIDKey: String { "module.\(rawValue).requireFaceID" }

    var isEnabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
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

/// A module's full screen, behind its Face ID gate.
@ViewBuilder
func moduleScreen(_ module: WooliModule) -> some View {
    switch module {
    case .period: ModuleGate(module: .period) { PeriodView().appGuide(.period) }
    }
}

// MARK: - Settings → Modules

struct ModulesSettingsView: View {
    @State private var lineup = AppLineup.shared
    @State private var tipsReset = false

    var body: some View {
        List {
            AppLineupRows()
            Section {
            } footer: {
                Text("Drag to rank them within each group — the order sets Today and the ☰ app switcher. Turning an app off hides it; your data stays until you delete it. Everything stays on this iPhone and your own iCloud.")
            }
            ForEach(AppSpace.allCases.filter { $0.module != nil }) { space in
                ModuleSettingsSection(space: space, module: space.module!, isEnabled: lineup.isEnabled(space))
            }
            Section {
                Button("Show app tips again") {
                    AppGuide.resetAll()
                    tipsReset = true
                }
                .disabled(tipsReset)
            } footer: {
                Text(tipsReset ? "Each app shows its tips the next time you open it."
                               : "The quick pointers each app shows the first time you open it.")
            }
        }
        .alwaysEditing()
        .navigationTitle("Apps")
    }
}

/// Privacy options and delete for one optional app.
private struct ModuleSettingsSection: View {
    let space: AppSpace
    let module: WooliModule
    let isEnabled: Bool
    @Environment(\.modelContext) private var context
    @State private var lineup = AppLineup.shared
    @AppStorage private var requireFaceID: Bool
    @State private var confirmDelete = false

    init(space: AppSpace, module: WooliModule, isEnabled: Bool) {
        self.space = space
        self.module = module
        self.isEnabled = isEnabled
        _requireFaceID = AppStorage(wrappedValue: false, module.requireFaceIDKey)
    }

    var body: some View {
        Section(module.title) {
            if isEnabled {
                Toggle("Show card on Today", isOn: Binding(get: { lineup.showsCard(space) },
                                                            set: { lineup.setShowsCard(space, $0) }))
                Toggle("Require Face ID", isOn: $requireFaceID)
            }
            Button("Delete all \(module.title) data", role: .destructive) { confirmDelete = true }
        }
        .confirmationDialog("Delete all \(module.title) data?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { ModuleData.deleteAll(module, context: context) }
        } message: {
            Text("This removes what Wooli logged in Apple Health. Anything you logged in the Health app or other apps stays there. It can't be undone.")
        }
    }
}

enum ModuleData {
    @MainActor static func deleteAll(_ module: WooliModule, context: ModelContext) {
        switch module {
        case .period:
            try? context.delete(model: PeriodEntry.self)
            Task { await PeriodStore.shared.deleteEverythingWooliWrote() }
        }
        try? context.save()
    }
}
