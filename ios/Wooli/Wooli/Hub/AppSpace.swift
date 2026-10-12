import SwiftUI

/// The apps inside Wooli. Today is the hub; each other space is a full app
/// with its own navigation (Budget keeps its five tabs). Switch between them
/// from the ☰ drawer or Today.
///
/// Adding an app: a case here, a Today card in `TodayView`, and its root
/// screen in `SpaceRoot`. Optional apps reuse `WooliModule` for on/off and Face ID.
enum AppSpace: String, CaseIterable, Identifiable {
    case today, budget, trips, period
    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "Today"
        case .budget: "Budget"
        case .trips: "Trips"
        case .period: "Period"
        }
    }

    var systemImage: String {
        switch self {
        case .today: "sun.max.fill"
        case .budget: "dollarsign"
        case .trips: "airplane"
        case .period: WooliModule.period.systemImage
        }
    }

    var tint: Color {
        switch self {
        case .today: Color(hex: "#f59e0b")
        case .budget: Theme.brand
        case .trips: Color(hex: "#0ea5e9")
        case .period: WooliModule.period.tint
        }
    }

    /// The opt-in module behind an optional app; nil = always available.
    var module: WooliModule? {
        switch self {
        case .period: .period
        default: nil
        }
    }

    var isAvailable: Bool { module?.isEnabled ?? true }

    /// Apps listed in the switcher and Today's grid, in order (Today itself excluded).
    static var installed: [AppSpace] { allCases.filter { $0 != .today && $0.isAvailable } }
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
