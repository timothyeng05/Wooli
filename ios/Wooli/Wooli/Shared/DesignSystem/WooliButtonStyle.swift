import SwiftUI

enum WooliButtonLevel {
    /// The one main action on a screen.
    case primary
    /// Supporting actions: Review, Filter, Share.
    case secondary
    /// Low-emphasis actions: Edit, Cancel.
    case tertiary
}

/// Wooli's three button levels. Every action is Wooli blue; accents are never button colours.
struct WooliButtonStyle: ButtonStyle {
    var level: WooliButtonLevel = .primary
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .padding(.vertical, Space.m)
            .padding(.horizontal, Space.xl)
            .foregroundStyle(level == .primary ? Theme.onBrand : Theme.brandDark)
            .background(background, in: Capsule())
            .overlay {
                if level == .tertiary { Capsule().strokeBorder(Theme.brand.opacity(0.35), lineWidth: 1.5) }
            }
            .shadow(color: level == .primary ? Theme.buttonShadow : .clear, radius: 4, y: 2)
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.5)
    }

    private var background: Color {
        switch level {
        case .primary: Theme.brand
        case .secondary: Theme.brandSoft
        case .tertiary: .clear
        }
    }
}

extension ButtonStyle where Self == WooliButtonStyle {
    static var wooliPrimary: WooliButtonStyle { WooliButtonStyle(level: .primary) }
    static var wooliSecondary: WooliButtonStyle { WooliButtonStyle(level: .secondary) }
    static var wooliTertiary: WooliButtonStyle { WooliButtonStyle(level: .tertiary) }
}

#Preview {
    LightDark {
        VStack(spacing: Space.m) {
            Button { } label: { Label("Add plan", systemImage: "plus") }.buttonStyle(.wooliPrimary)
            Button("Review") { }.buttonStyle(.wooliSecondary)
            Button("Edit") { }.buttonStyle(.wooliTertiary)
            Button("Disabled") { }.buttonStyle(.wooliPrimary).disabled(true)
        }
    }
}
