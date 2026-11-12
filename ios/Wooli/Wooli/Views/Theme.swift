import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Design tokens from `DesignSystem/` (values: `DesignSystem/tokens.json`).
enum Theme {
    // Brand: blue is for actions.
    static let brand = Color(light: 0x2563EB, dark: 0x60A5FA)
    static let brandDark = Color(light: 0x1D4ED8, dark: 0x93C5FD)
    static let brandSoft = Color(light: 0xF0F5FF, dark: 0x1B2F5C)
    static let onBrand = Color(light: 0xFFFFFF, dark: 0x0F1B33)

    /// The platform's plain page colour (white / black on iPhone), for the ☰ drawer.
    #if os(iOS)
    static let systemBackground = Color(UIColor.systemBackground)
    #else
    static let systemBackground = Color(NSColor.windowBackgroundColor)
    #endif

    // Navy-tinted neutrals.
    static let background = Color(light: 0xEEF3FA, dark: 0x070D1C)
    static let card = Color(light: 0xFFFFFF, dark: 0x13213D)
    static let border = Color(light: 0xD8E2F0, dark: 0x22314F)
    static let track = Color(light: 0xE3EAF5, dark: 0x1D2B4A)
    static let text = Color(light: 0x0F1B33, dark: 0xEEF2FA)
    static let textSecondary = Color(light: 0x475877, dark: 0xB3C0D9)
    static let textTertiary = Color(light: 0x5F6F8E, dark: 0x8D9BBA)

    // Money: green and red only ever mean income and spending.
    static let income = Color(light: 0x15803D, dark: 0x4ADE80)
    static let expense = Color(light: 0xB91C1C, dark: 0xF87171)
    static let pending = Color(light: 0xB45309, dark: 0xFBBF24)
    static let pendingSoft = Color(light: 0xFFF4DC, dark: 0x3A2606)
    static let lastMonth = Color(light: 0xC7D2E3, dark: 0x3A4C72)
    static let thisMonth = brand

    // Ticket (Trips hero) — the same in light and dark.
    static let ticketStart = Color(light: 0x1E3A8A, dark: 0x1E3A8A)
    static let ticketEnd = Color(light: 0x2563EB, dark: 0x2563EB)
    static let onTicket = Color(light: 0xFFFFFF, dark: 0xFFFFFF)
    static let ticketPanel = Color(light: 0x0F1B33, dark: 0x0F1B33, alpha: 0.16)
    static let ticketRule = Color(light: 0xFFFFFF, dark: 0xFFFFFF, alpha: 0.4)
    static let ticketHighlight = Color(light: 0xFEF3C7, dark: 0xFEF3C7)

    // Departures board and night surfaces.
    static let night = Color(light: 0x050812, dark: 0x050812)
    static let board = Color(light: 0x0F1B33, dark: 0x0F1B33)
    static let boardCell = Color(light: 0xFFFFFF, dark: 0xFFFFFF, alpha: 0.08)
    static let onBoard = ticketHighlight
    static let boardMuted = Color(light: 0xB3C0D9, dark: 0xB3C0D9)
    static let boardLate = Color(light: 0xF87171, dark: 0xF87171)

    static let stampFine = Color(light: 0x0F766E, dark: 0x2DD4BF)

    // Accents: constant in both modes; group and plan-kind colours alias these.
    static let onAccent = Color(light: 0x0F1B33, dark: 0x0F1B33)
    static let accentBlue = Color(light: 0x2563EB, dark: 0x2563EB)
    static let accentTeal = Color(light: 0x0D9488, dark: 0x0D9488)
    static let accentRose = Color(light: 0xE11D48, dark: 0xE11D48)
    static let accentViolet = Color(light: 0x7C3AED, dark: 0x7C3AED)
    static let accentAmber = Color(light: 0xD97706, dark: 0xD97706)
    static let accentPink = Color(light: 0xEC4899, dark: 0xEC4899)
    static let accentYellow = Color(light: 0xFACC15, dark: 0xFACC15)
    static let accentSlate = Color(light: 0x64748B, dark: 0x64748B)

    // Launch screen and logo.
    static let launchBackground = Color(light: 0x3B82F6, dark: 0x3B82F6)
    static let logoOutline = Color(light: 0x1D4ED8, dark: 0x1D4ED8)
    static let logoInner = Color(light: 0x2563EB, dark: 0x2563EB)
    static let logoWool = Color(light: 0xFFFFFF, dark: 0xFFFFFF)

    static let gradient = LinearGradient(colors: [launchBackground, Color(hex: "#60a5fa")],
                                         startPoint: .topLeading, endPoint: .bottomTrailing)

    // Shadows
    static let cardShadow = Color(light: 0x0F1B33, dark: 0x000000, alpha: 0.06, darkAlpha: 0.3)
    static let ticketShadow = brand.opacity(0.3)
    static let buttonShadow = brand.opacity(0.3)

    /// What kind of thing something is, the same colour in every module.
    enum Group: String, CaseIterable {
        case travel, food, home, health, fun, shopping, money

        var color: Color {
            switch self {
            case .travel: Theme.accentBlue
            case .food: Theme.accentYellow
            case .home: Theme.accentViolet
            case .health: Theme.accentTeal
            case .fun: Theme.accentRose
            case .shopping: Theme.accentPink
            case .money: Theme.accentSlate
            }
        }

        /// Text and icons placed on `color`.
        var onColor: Color {
            switch self {
            case .travel, .home, .fun, .money: .white
            case .food, .health, .shopping: Theme.onAccent
            }
        }
    }
}

enum Space {
    static let xs: CGFloat = 4, s: CGFloat = 8, m: CGFloat = 12, l: CGFloat = 16, xl: CGFloat = 20, xxl: CGFloat = 24
}

/// "Full" is `Capsule()` or `Circle()`.
enum Radius {
    static let small: CGFloat = 10, card: CGFloat = 14, hero: CGFloat = 22
}

/// The four styles Dynamic Type doesn't cover.
enum WooliFont {
    case amount, display, code, eyebrow
}

private struct WooliFontModifier: ViewModifier {
    let style: WooliFont
    @ScaledMetric(relativeTo: .largeTitle) private var amount: CGFloat = 32
    @ScaledMetric(relativeTo: .largeTitle) private var display: CGFloat = 34
    @ScaledMetric(relativeTo: .title) private var code: CGFloat = 28
    @ScaledMetric(relativeTo: .caption2) private var eyebrow: CGFloat = 11

    func body(content: Content) -> some View {
        switch style {
        case .amount: content.font(.system(size: amount, weight: .bold)).monospacedDigit()
        case .display: content.font(.system(size: display, weight: .heavy, design: .serif))
        case .code: content.font(.system(size: code, weight: .black, design: .rounded))
        case .eyebrow: content.font(.system(size: eyebrow, weight: .bold)).tracking(1.1).textCase(.uppercase)
        }
    }
}

extension View {
    func wooliFont(_ style: WooliFont) -> some View { modifier(WooliFontModifier(style: style)) }
}

extension Color {
    init(light: UInt32, dark: UInt32, alpha: CGFloat = 1, darkAlpha: CGFloat? = nil) {
        #if os(iOS)
        self.init(uiColor: UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            let v = isDark ? dark : light
            return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                           blue: CGFloat(v & 0xff) / 255, alpha: isDark ? (darkAlpha ?? alpha) : alpha)
        })
        #else
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            let v = isDark ? dark : light
            return NSColor(srgbRed: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                           blue: CGFloat(v & 0xff) / 255, alpha: isDark ? (darkAlpha ?? alpha) : alpha)
        })
        #endif
    }

    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(s, radix: 16) ?? 0x64748b
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

// MARK: - Cards & labels

/// White rounded card with a hairline border — the web app's
/// `bg-white rounded-xl border border-gray-200 shadow-sm`.
struct CardModifier: ViewModifier {
    var padding: CGFloat = Space.xl
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
            .shadow(color: Theme.cardShadow, radius: 2, y: 1)
    }
}

extension View {
    func card(padding: CGFloat = Space.xl) -> some View { modifier(CardModifier(padding: padding)) }

    /// Gray page background used behind cards.
    func pageBackground() -> some View {
        scrollContentBackground(.hidden).background(Theme.background)
    }
}

/// The widest a page's content gets in a big Mac window. The scroll view
/// itself stays full width; only its content is centred.
enum ReadableWidth {
    static let max: CGFloat = 920
    /// Budget's dashboard-style pages, which lay cards out in two columns.
    static let dashboard: CGFloat = 1320
}

extension View {
    /// Centres a scroll view's content at `ReadableWidth.max` on the Mac. Does nothing on iPhone.
    func readableContentWidth(_ maxWidth: CGFloat = ReadableWidth.max) -> some View {
        #if os(macOS)
        modifier(ReadableContentWidth(maxWidth: maxWidth))
        #else
        self
        #endif
    }
}

#if os(macOS)
private struct ReadableContentWidth: ViewModifier {
    let maxWidth: CGFloat
    @State private var margin: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .contentMargins(.horizontal, margin, for: .scrollContent)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width in
                margin = Swift.max(0, (width - maxWidth) / 2)
            }
    }
}
#endif

/// "NET WORTH"-style uppercase label.
struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased())
            .wooliFont(.eyebrow)
            .foregroundStyle(Theme.textTertiary)
    }
}

struct CardHeader<Trailing: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(Theme.text)
                if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(Theme.textSecondary) }
            }
            Spacer()
            trailing
        }
    }
}

extension CardHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle) { EmptyView() }
    }
}

struct PendingBadge: View {
    var body: some View {
        Text("Pending")
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Theme.pendingSoft, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.pending.opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
            .foregroundStyle(Theme.pending)
    }
}

/// Thin rounded progress bar like the web's `h-2 rounded-full` bars.
struct BarGauge: View {
    let value: Double
    let total: Double
    var tint: Color = Theme.brand
    var height: CGFloat = 8

    var body: some View {
        GeometryReader { geo in
            let fraction = total > 0 ? min(max(value / total, 0), 1) : 0
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.track)
                Capsule().fill(tint).frame(width: geo.size.width * fraction)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue(total > 0 ? "\(Int(value / total * 100)) percent" : "")
    }
}

/// Emoji on a tinted rounded square — the web's category icon tile.
struct CategoryTile: View {
    let category: BudgetCategory?
    var size: CGFloat = 40
    /// A group colour to use instead of the category's own.
    var groupTint: Color?

    var body: some View {
        let tint = groupTint ?? category.map { Color(hex: $0.colorHex) } ?? Theme.textTertiary
        ZStack {
            RoundedRectangle(cornerRadius: min(Radius.small, size * 0.25), style: .continuous).fill(tint.opacity(0.14))
            if let category {
                Text(category.icon).font(.system(size: size * 0.48))
            } else {
                Image(systemName: "questionmark").font(.system(size: size * 0.38, weight: .semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Institution logo (bundled for common banks) or a colored initial.
struct InstitutionLogo: View {
    let name: String
    var size: CGFloat = 40

    private static let known: [(String, String)] = [
        ("chase", "logo-chase"), ("fidelity", "logo-fidelity"), ("schwab", "logo-schwab"),
        ("american express", "logo-amex"), ("amex", "logo-amex"), ("citi", "logo-citi"),
        ("health equity", "logo-healthequity"), ("healthequity", "logo-healthequity"),
        ("capital one", "logo-capital-one"), ("capitalone", "logo-capital-one"),
        ("bank of america", "logo-bank-of-america"), ("bofa", "logo-bank-of-america"),
    ]

    @AppStorage("institutionLogos") private var customLogosData: Data = Data()

    /// Decoded once per change of the stored map, not for every logo drawn.
    @MainActor private static var decoded: (data: Data, logos: [String: String]) = (Data(), [:])

    @MainActor private static func customLogos(from data: Data) -> [String: String] {
        if data != decoded.data {
            decoded = (data, (try? JSONDecoder().decode([String: String].self, from: data)) ?? [:])
        }
        return decoded.logos
    }

    var body: some View {
        let lower = name.lowercased()
        let custom = Self.customLogos(from: customLogosData)[name]

        Group {
            if let custom, let first = custom.first, first.unicodeScalars.contains(where: { $0.properties.isEmojiPresentation || $0.properties.isEmoji && $0.value > 0xFF }) {
                ZStack {
                    Circle().fill(Color.gray.opacity(0.15))
                    Text(custom).font(.system(size: size * 0.55))
                }
            } else if let asset = Self.known.first(where: { lower.contains($0.0) })?.1 {
                Image(asset).resizable().scaledToFill()
            } else {
                let palette: [Color] = [.blue, .teal, .indigo, .green, .orange, .pink, .purple]
                let tint = palette[name.unicodeScalars.reduce(0) { $0 + Int($1.value) } % palette.count]
                ZStack {
                    Circle().fill(tint.opacity(0.15))
                    Text(String(name.prefix(1)).uppercased())
                        .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                        .foregroundStyle(tint)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Theme.border))
        .accessibilityHidden(true)
    }
}

/// Segmented range chips ("1M 3M 6M YTD 1Y All") styled like the web.
struct RangePicker: View {
    @Binding var selection: ChartRange

    var body: some View {
        HStack(spacing: 4) {
            ForEach(ChartRange.allCases) { range in
                Button {
                    withAnimation(.snappy) { selection = range }
                } label: {
                    Text(range.label)
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(selection == range ? Theme.text : .clear, in: Capsule())
                        .foregroundStyle(selection == range ? Theme.card : Theme.textSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == range ? .isSelected : [])
            }
        }
    }
}

/// Change line: "↗ $1,200.00 (4.2%)  1 month".
struct ChangeLabel: View {
    let change: Double
    var base: Double?
    var period: String?
    /// For debts, going down is good.
    var invert = false

    var body: some View {
        let good = invert ? change <= 0 : change >= 0
        HStack(spacing: 6) {
            HStack(spacing: 2) {
                Image(systemName: change >= 0 ? "arrow.up.right" : "arrow.down.right")
                    .font(.caption.weight(.bold))
                Text(abs(change).currency())
                if let base, base != 0 {
                    Text("(\((change / abs(base)).formatted(.percent.precision(.fractionLength(1)))))")
                }
            }
            .foregroundStyle(good ? Theme.income : Theme.expense)
            if let period { Text(period).foregroundStyle(Theme.textSecondary) }
        }
        .font(.subheadline.weight(.medium))
        .monospacedDigit()
    }
}

// MARK: - Sheep logo

/// SwiftUI port of the web app's `WooliLogo` SVG (viewBox 100×108).
struct WooliLogo: View {
    var size: CGFloat = 36

    var body: some View {
        Canvas { ctx, canvasSize in
            let s = canvasSize.width / 100
            let outline = Theme.logoOutline, inner = Theme.logoInner
            func circle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, _ color: Color) {
                ctx.fill(Path(ellipseIn: CGRect(x: (cx - r) * s, y: (cy - r) * s, width: 2 * r * s, height: 2 * r * s)), with: .color(color))
            }
            func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat, _ color: Color) {
                ctx.fill(Path(ellipseIn: CGRect(x: (cx - rx) * s, y: (cy - ry) * s, width: 2 * rx * s, height: 2 * ry * s)), with: .color(color))
            }
            func leg(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat, _ color: Color) {
                ctx.fill(Path(roundedRect: CGRect(x: x * s, y: y * s, width: w * s, height: h * s), cornerRadius: r * s), with: .color(color))
            }
            let bumps: [(CGFloat, CGFloat, CGFloat)] = [(50, 60, 28), (50, 27, 17), (33, 32, 15), (67, 32, 15),
                                                        (17, 54, 13), (83, 54, 13), (28, 78, 14), (72, 78, 14)]
            for b in bumps { circle(b.0, b.1, b.2 + 4, outline) }
            circle(50, 52, 26, outline)
            for x in [26, 40, 54, 68] as [CGFloat] { leg(x, 88, 12, 17, 6, outline) }
            for b in bumps { circle(b.0, b.1, b.2, .white) }
            ellipse(22, 36, 9, 13, outline); ellipse(78, 36, 9, 13, outline)
            ellipse(22, 36, 6, 9, inner); ellipse(78, 36, 6, 9, inner)
            circle(50, 52, 22, outline)
            circle(41, 47, 6, .white); circle(59, 47, 6, .white)
            circle(41, 47, 2.8, outline); circle(59, 47, 2.8, outline)
            circle(39.5, 45, 1.2, .white); circle(57.5, 45, 1.2, .white)
            for x in [28, 42, 56, 70] as [CGFloat] { leg(x, 89, 10, 15, 5, outline) }
        }
        .frame(width: size, height: size * 1.08)
        .accessibilityLabel("Wooli")
    }
}

/// A main column with a narrower column beside it on a wide Mac window (like
/// Monarch's dashboard), stacked main-then-side everywhere else.
struct WideColumns<Main: View, Side: View>: View {
    var sideWidth: CGFloat = 380
    /// Stacked (phone or narrow window), show the side column first.
    var sideFirst = false
    @ViewBuilder var main: Main
    @ViewBuilder var side: Side
    #if os(macOS)
    @State private var isWide = false
    #endif

    var body: some View {
        #if os(macOS)
        Group {
            if isWide {
                HStack(alignment: .top, spacing: 16) {
                    VStack(spacing: 16) { main }.frame(maxWidth: .infinity)
                    VStack(spacing: 16) { side }.frame(width: sideWidth)
                }
            } else {
                VStack(spacing: 16) { if sideFirst { side; main } else { main; side } }
            }
        }
        .onGeometryChange(for: Bool.self) { $0.size.width >= 860 } action: { isWide = $0 }
        #else
        VStack(spacing: 16) { if sideFirst { side; main } else { main; side } }
        #endif
    }
}
