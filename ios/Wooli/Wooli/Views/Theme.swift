import SwiftUI
import UIKit

/// Design tokens mirroring the web app (Tailwind gray scale + primary blue).
enum Theme {
    static let brand = Color(light: 0x2563EB, dark: 0x3B82F6)      // primary-600 / 500
    static let brandDark = Color(light: 0x1D4ED8, dark: 0x60A5FA)  // primary-700
    static let brandSoft = Color(light: 0xEFF6FF, dark: 0x172554)  // primary-50
    static let background = Color(light: 0xF9FAFB, dark: 0x0A0A0A) // gray-50
    static let card = Color(light: 0xFFFFFF, dark: 0x171717)
    static let border = Color(light: 0xE5E7EB, dark: 0x262626)     // gray-200
    static let track = Color(light: 0xF3F4F6, dark: 0x262626)      // gray-100
    static let text = Color(light: 0x111827, dark: 0xEDEDED)       // gray-900
    static let textSecondary = Color(light: 0x6B7280, dark: 0xA3A3A3) // gray-500
    static let textTertiary = Color(light: 0x9CA3AF, dark: 0x737373)  // gray-400
    static let income = Color(light: 0x16A34A, dark: 0x22C55E)     // green-600
    static let expense = Color(light: 0xEF4444, dark: 0xF87171)    // red-500
    static let pending = Color(light: 0xD97706, dark: 0xFBBF24)    // amber-600
    static let pendingSoft = Color(light: 0xFFFBEB, dark: 0x451A03) // amber-50
    static let lastMonth = Color(light: 0xD1D5DB, dark: 0x525252)  // gray-300
    static let thisMonth = Color(light: 0xF97316, dark: 0xFB923C)  // orange-500

    static let gradient = LinearGradient(colors: [Color(hex: "#3b82f6"), Color(hex: "#60a5fa")],
                                         startPoint: .topLeading, endPoint: .bottomTrailing)
}

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            let v = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                           blue: CGFloat(v & 0xff) / 255, alpha: 1)
        })
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
    var padding: CGFloat = 20
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.border))
            .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
    }
}

extension View {
    func card(padding: CGFloat = 20) -> some View { modifier(CardModifier(padding: padding)) }

    /// Gray page background used behind cards.
    func pageBackground() -> some View {
        scrollContentBackground(.hidden).background(Theme.background)
    }
}

/// "NET WORTH"-style uppercase label.
struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
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

    var body: some View {
        let tint = category.map { Color(hex: $0.colorHex) } ?? Theme.textTertiary
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous).fill(tint.opacity(0.14))
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
            let outline = Color(hex: "#1d4ed8"), inner = Color(hex: "#2563eb")
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
