import SwiftUI

/// The one list row in Wooli: a 40pt leading slot, a title and subtitle, and a trailing slot.
/// Pass a `CategoryTile`, institution logo, poster, small `RankStamp` or kind dot as `leading`;
/// a money amount, small `RankStamp`, chip or chevron as `trailing`.
struct ItemRow<Leading: View, Trailing: View, Below: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var below: Below

    var body: some View {
        HStack(spacing: Space.m) {
            leading.frame(width: ItemRowMetrics.leadingWidth)
            VStack(alignment: .leading, spacing: Space.xs) {
                Text(title).font(.body.weight(.medium)).foregroundStyle(Theme.text)
                if let subtitle {
                    Text(subtitle).font(.footnote).foregroundStyle(Theme.textTertiary)
                }
                below
            }
            Spacer(minLength: Space.s)
            trailing
        }
        .padding(.vertical, Space.m)
        .accessibilityElement(children: .combine)
    }
}

extension ItemRow where Below == EmptyView {
    init(title: String, subtitle: String? = nil,
         @ViewBuilder leading: () -> Leading, @ViewBuilder trailing: () -> Trailing) {
        self.init(title: title, subtitle: subtitle, leading: leading, trailing: trailing, below: { EmptyView() })
    }
}

enum ItemRowMetrics {
    static let leadingWidth: CGFloat = 40
}

/// Hairline between rows inside a card; it starts at the text, not the card edge.
struct ItemRowDivider: View {
    var body: some View {
        Rectangle().fill(Theme.border).frame(height: 1)
            .padding(.leading, ItemRowMetrics.leadingWidth + Space.m)
            .accessibilityHidden(true)
    }
}

/// A row's trailing money amount: `text` when spent, `income` with a + when received, `pending` when pending.
struct ItemRowAmount: View {
    enum Tone { case spent, income, pending }
    let text: String
    var tone: Tone = .spent

    var body: some View {
        Text(text)
            .font(.body.weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(color)
    }

    private var color: Color {
        switch tone {
        case .spent: Theme.text
        case .income: Theme.income
        case .pending: Theme.pending
        }
    }
}

#Preview {
    LightDark {
        VStack(spacing: 0) {
            ItemRow(title: "Blue Bottle Coffee", subtitle: "Dining · Oct 28") {
                Text("☕️").frame(width: 40, height: 40)
                    .background(Theme.Group.food.color.opacity(0.14), in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
            } trailing: {
                ItemRowAmount(text: "-$6.50")
            }
            ItemRowDivider()
            ItemRow(title: "Paycheck", subtitle: "Income · Oct 27") {
                Text("💼").frame(width: 40, height: 40)
            } trailing: {
                ItemRowAmount(text: "+$2,400.00", tone: .income)
            }
            ItemRowDivider()
            ItemRow(title: "Groceries", subtitle: "$212 of $400", leading: {
                Text("🛒").frame(width: 40, height: 40)
            }, trailing: {
                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
            }, below: {
                BarGauge(value: 212, total: 400, tint: Theme.Group.food.color)
            })
        }
        .card()
    }
}
