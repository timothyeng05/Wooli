import SwiftUI

/// A label you attach to your stuff: a category, a #tag, or who a split is with.
/// Free #tags use the group of the place or trip they belong to, or `.money` for splits and people.
struct LuggageTag: View {
    let title: String
    var group: Theme.Group = .money

    init(_ title: String, group: Theme.Group = .money) {
        self.title = title
        self.group = group
    }

    private var shape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 3,
                               bottomTrailingRadius: Radius.small, topTrailingRadius: Radius.small, style: .continuous)
    }

    var body: some View {
        HStack(spacing: Space.s) {
            // The punched hole.
            Circle().fill(Theme.background).frame(width: 6, height: 6)
                .overlay(Circle().strokeBorder(group.color, lineWidth: 1.5))
            Text(title).font(.footnote.weight(.semibold)).foregroundStyle(Theme.text)
        }
        .padding(.leading, Space.s).padding(.trailing, Space.m).padding(.vertical, Space.xs)
        .background {
            ZStack { Theme.card; group.color.opacity(0.16) }.clipShape(shape)
        }
        .overlay(shape.strokeBorder(group.color, lineWidth: 1.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
    }
}

#Preview {
    LightDark {
        HStack {
            LuggageTag("Dining", group: .food)
            LuggageTag("#tokyo", group: .travel)
            LuggageTag("Split with Maya")
        }
    }
}
