import SwiftUI
import SwiftData

/// The apps inside Wooli. Today is the hub; each other space is a full app
/// with its own navigation (Budget keeps its five tabs). Switch between them
/// from the ☰ drawer or Today.
///
/// Adding an app: a case here, a Today card in `TodayView`, and its root
/// screen in `SpaceRoot`. Optional apps reuse `WooliModule` for on/off and Face ID.
enum AppSpace: String, CaseIterable, Identifiable {
    case today, budget, trips, eats, period
    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "Today"
        case .budget: "Budget"
        case .trips: "Trips"
        case .eats: "Eats"
        case .period: "Period"
        }
    }

    var systemImage: String {
        switch self {
        case .today: "sun.max.fill"
        case .budget: "dollarsign"
        case .trips: "airplane"
        case .eats: "fork.knife"
        case .period: WooliModule.period.systemImage
        }
    }

    var tint: Color {
        switch self {
        case .today: Color(hex: "#f59e0b")
        case .budget: Theme.brand
        case .trips: Color(hex: "#0ea5e9")
        case .eats: Color(hex: "#f97316")
        case .period: WooliModule.period.tint
        }
    }

    /// One line for onboarding and Settings → Apps.
    var pitch: String {
        switch self {
        case .today: "Everything at a glance."
        case .budget: "Connect your bank, plan each month, and see where your money goes."
        case .trips: "Plan trips day by day on Apple Maps — together, if you like."
        case .eats: "Rank every place you've eaten, Beli-style. Trip meals show up to rank."
        case .period: "Track your cycle with private predictions."
        }
    }

    /// The opt-in module behind an optional app (Face ID, sample data); nil = core app.
    var module: WooliModule? {
        switch self {
        case .period: .period
        default: nil
        }
    }

    /// Optional apps reuse their module's key so existing settings carry over.
    var enabledKey: String { module?.enabledKey ?? "app.\(rawValue).enabled" }

    /// Core apps default on, optional ones off.
    fileprivate var storedEnabled: Bool {
        UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? (module == nil)
    }
}

/// Which apps the user turned on and how they ranked them — chosen in
/// onboarding, editable in Settings → Apps. The order drives Today's cards,
/// the app grid, and the ☰ switcher. An app can also keep its spot in the
/// grid but hide its card from Today (Edit Today).
@MainActor
@Observable
final class AppLineup {
    static let shared = AppLineup()
    private static let orderKey = "apps.order"
    private static let hiddenCardsKey = "today.hiddenCards"

    private(set) var order: [AppSpace]
    private(set) var enabled: Set<AppSpace>
    private(set) var hiddenCards: Set<AppSpace>

    private init() {
        let apps = AppSpace.allCases.filter { $0 != .today }
        let stored = (UserDefaults.standard.string(forKey: Self.orderKey) ?? "")
            .split(separator: ",").compactMap { AppSpace(rawValue: String($0)) }.filter(apps.contains)
        // Apps added in a later update go at the end.
        order = stored + apps.filter { !stored.contains($0) }
        enabled = Set(apps.filter(\.storedEnabled))
        if let stored = UserDefaults.standard.string(forKey: Self.hiddenCardsKey) {
            hiddenCards = Set(stored.split(separator: ",").compactMap { AppSpace(rawValue: String($0)) })
        } else {
            // Carry over the old "Also show on Budget dashboard" switch.
            hiddenCards = Set(apps.filter { space in
                space.module.map { UserDefaults.standard.object(forKey: $0.showOnHomeKey) as? Bool == false } ?? false
            })
        }
    }

    /// Enabled apps, most important first.
    var installed: [AppSpace] { order.filter(enabled.contains) }

    /// Enabled apps that show a card on Today, in rank order.
    var todayCards: [AppSpace] { installed.filter { !hiddenCards.contains($0) } }

    func showsCard(_ space: AppSpace) -> Bool { !hiddenCards.contains(space) }

    func setShowsCard(_ space: AppSpace, _ on: Bool) {
        if on { hiddenCards.remove(space) } else { hiddenCards.insert(space) }
        UserDefaults.standard.set(hiddenCards.map(\.rawValue).sorted().joined(separator: ","), forKey: Self.hiddenCardsKey)
    }

    func isEnabled(_ space: AppSpace) -> Bool { space == .today || enabled.contains(space) }

    func setEnabled(_ space: AppSpace, _ on: Bool) {
        guard space != .today else { return }
        if on { enabled.insert(space) } else { enabled.remove(space) }
        UserDefaults.standard.set(on, forKey: space.enabledKey)
    }

    func move(fromOffsets source: IndexSet, toOffset destination: Int) {
        order.move(fromOffsets: source, toOffset: destination)
        saveOrder()
    }

    /// Reorder within the enabled apps only (Edit Today lists just those);
    /// apps that are off keep their slots in the full ranking.
    func moveInstalled(fromOffsets source: IndexSet, toOffset destination: Int) {
        var ranked = installed
        ranked.move(fromOffsets: source, toOffset: destination)
        var next = ranked.makeIterator()
        order = order.map { enabled.contains($0) ? next.next()! : $0 }
        saveOrder()
    }

    private func saveOrder() {
        UserDefaults.standard.set(order.map(\.rawValue).joined(separator: ","), forKey: Self.orderKey)
    }
}

/// Rank + toggle list for apps. Used in onboarding and Settings → Apps; the
/// containing List must be in edit mode for the drag handles.
struct AppLineupRows: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var lineup = AppLineup.shared

    var body: some View {
        ForEach(lineup.order) { space in
            Toggle(isOn: Binding(get: { lineup.isEnabled(space) }, set: { on in
                withAnimation { lineup.setEnabled(space, on) }
                if on, app.mode == .sample, let module = space.module { ModuleSampleData.seed(module, context: context) }
            })) {
                HStack(spacing: 12) {
                    AppIconTile(space, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(space.title).font(.body.weight(.semibold))
                        Text(space.pitch).font(.caption).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.trailing, 8)
            .opacity(lineup.isEnabled(space) ? 1 : 0.6)
        }
        .onMove { lineup.move(fromOffsets: $0, toOffset: $1) }
    }
}

/// Rounded app-icon tile, used in the drawer, Today cards, and the app grid.
struct AppIconTile: View {
    let systemImage: String
    let tint: Color
    var size: CGFloat = 40

    init(_ space: AppSpace, size: CGFloat = 40) {
        self.init(systemImage: space.systemImage, tint: space.tint, size: size)
    }

    init(systemImage: String, tint: Color, size: CGFloat = 40) {
        self.systemImage = systemImage
        self.tint = tint
        self.size = size
    }

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: size * 0.46, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(tint.gradient, in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
            .accessibilityHidden(true)
    }
}
