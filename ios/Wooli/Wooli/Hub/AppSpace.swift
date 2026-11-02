import SwiftUI
import SwiftData

/// The apps inside Wooli. Today is the hub; each other space is a full app
/// with its own navigation (Budget keeps its five tabs). Switch between them
/// from the ☰ drawer or Today.
///
/// Adding an app: a case here, a Today card in `TodayView`, and its root
/// screen in `SpaceRoot`. Optional apps reuse `WooliModule` for on/off and Face ID.
enum AppSpace: String, CaseIterable, Identifiable {
    // `period` is the Health app (Period is its first section); the raw value
    // stays so saved order and on/off settings carry over.
    case today, budget, trips, eats, sights, movies, recipes, period
    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "Today"
        case .budget: "Budget"
        case .trips: "Trips"
        case .eats: "Eats"
        case .sights: "Sights"
        case .movies: "Movies"
        case .recipes: "Recipes"
        case .period: "Health"
        }
    }

    var systemImage: String {
        switch self {
        case .today: "sun.max.fill"
        case .budget: "dollarsign"
        case .trips: "airplane"
        case .eats: "fork.knife"
        case .sights: "mappin.and.ellipse"
        case .movies: "film"
        case .recipes: "frying.pan"
        case .period: "heart.fill"
        }
    }

    var tint: Color {
        switch self {
        case .today: Color(hex: "#f59e0b")
        case .budget: Theme.brand
        case .trips: Color(hex: "#0ea5e9")
        case .eats: Color(hex: "#f97316")
        case .sights: Theme.accentViolet
        case .movies: Color(hex: "#e11d48")
        case .recipes: Color(hex: "#16a34a")
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
        case .sights: "Save landmarks, museums and parks you want to see, then add them to a trip."
        case .movies: "Rank every movie you've seen, Beli-style — a few taps each."
        case .recipes: "Share a recipe reel from Instagram; its caption becomes ingredients and steps."
        case .period: "Your health, kept private — starting with your cycle and its predictions."
        }
    }

    /// Its group in the ☰ switcher and Settings → Apps; nil for Today.
    var theme: AppTheme? {
        switch self {
        case .today: nil
        case .budget, .period: .personal
        case .trips, .eats, .sights, .movies, .recipes: .explore
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

/// App groups, in the order they're listed.
enum AppTheme: String, CaseIterable, Identifiable {
    case personal, explore
    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    var group: Theme.Group {
        switch self {
        case .personal: .money
        case .explore: .travel
        }
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

    /// Reorder within the enabled apps only (Edit Today lists just those);
    /// apps that are off keep their slots in the full ranking.
    func moveInstalled(fromOffsets source: IndexSet, toOffset destination: Int) {
        move(within: installed, fromOffsets: source, toOffset: destination)
    }

    /// Reorder a subset of apps (e.g. one theme); the rest keep their slots.
    func move(within subset: [AppSpace], fromOffsets source: IndexSet, toOffset destination: Int) {
        var ranked = subset
        ranked.move(fromOffsets: source, toOffset: destination)
        var next = ranked.makeIterator()
        order = order.map { subset.contains($0) ? next.next()! : $0 }
        saveOrder()
    }

    private func saveOrder() {
        UserDefaults.standard.set(order.map(\.rawValue).joined(separator: ","), forKey: Self.orderKey)
    }
}

/// Rank + toggle list for apps, one section per theme (drag to rank within
/// it). Used in onboarding and Settings → Apps; the containing List must be
/// in edit mode for the drag handles.
struct AppLineupRows: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var lineup = AppLineup.shared

    var body: some View {
        ForEach(AppTheme.allCases) { theme in
            let apps = lineup.order.filter { $0.theme == theme }
            Section(theme.title) {
                ForEach(apps) { row($0) }
                    .onMove { lineup.move(within: apps, fromOffsets: $0, toOffset: $1) }
            }
        }
    }

    private func row(_ space: AppSpace) -> some View {
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
