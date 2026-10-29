import SwiftUI

/// A band washed in its section colour with a glowing badge, a bold title and a one-line summary.
/// Used for trip cities, budget groups, Eats lists and "Needs review". Never inside a card.
struct SectionBand<Trailing: View>: View {
    enum Badge {
        case number(Int)
        case emoji(String)
        case symbol(String)
    }

    let title: String
    var summary: String?
    var badge: Badge
    /// The section's group colour; nil for a section that isn't a group (brand blue).
    var group: Theme.Group?
    var isNow = false
    /// nil hides the chevron; true/false shows it folded/open.
    var isCollapsed: Bool?
    @ViewBuilder var trailing: Trailing

    private var tint: Color { group?.color ?? Theme.brand }
    private var onTint: Color { group?.onColor ?? Theme.onBrand }

    var body: some View {
        HStack(spacing: Space.m) {
            badgeView
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Space.s) {
                    Text(title).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                    if isNow {
                        Text("NOW")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, Space.s).padding(.vertical, 2)
                            .background(Theme.text, in: Capsule())
                            .foregroundStyle(Theme.card)
                    }
                }
                if let summary {
                    Text(summary).font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer(minLength: Space.s)
            trailing
            if let isCollapsed {
                Image(systemName: "chevron.down")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(tint)
                    .rotationEffect(.degrees(isCollapsed ? -90 : 0))
            }
        }
        .padding(Space.l)
        .background {
            ZStack {
                Theme.card
                LinearGradient(colors: [tint.opacity(0.16), tint.opacity(0.05)], startPoint: .leading, endPoint: .trailing)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        }
        .overlay(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).strokeBorder(tint.opacity(0.22)))
        .accessibilityElement(children: .combine)
    }

    private var badgeView: some View {
        Group {
            switch badge {
            case .number(let n): Text("\(n)").font(.system(size: 19, weight: .bold)).foregroundStyle(onTint)
            case .emoji(let e): Text(e).font(.title3)
            case .symbol(let s): Image(systemName: s).font(.headline).foregroundStyle(onTint)
            }
        }
        .frame(width: 44, height: 44)
        .background(LinearGradient(colors: [tint, tint.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
        .shadow(color: tint.opacity(0.35), radius: 6, y: 2)
    }
}

extension SectionBand where Trailing == EmptyView {
    init(title: String, summary: String? = nil, badge: Badge, group: Theme.Group? = nil,
         isNow: Bool = false, isCollapsed: Bool? = nil) {
        self.init(title: title, summary: summary, badge: badge, group: group,
                  isNow: isNow, isCollapsed: isCollapsed, trailing: { EmptyView() })
    }
}

#Preview {
    LightDark {
        VStack(spacing: Space.m) {
            SectionBand(title: "Tokyo", summary: "May 31 – Jun 4 · 12 plans", badge: .number(1), group: .travel, isNow: true, isCollapsed: false)
            SectionBand(title: "Food & Dining", summary: "$612 of $800", badge: .emoji("🍜"), group: .food, isCollapsed: true)
            SectionBand(title: "Needs review", summary: "6 transactions", badge: .symbol("tray.full"))
        }
    }
}
