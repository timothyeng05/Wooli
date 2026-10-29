import SwiftUI

/// A milestone you've collected, like a sticker on a suitcase: tilted, in its group's colour.
/// Show earned stickers only; never locked ones or progress toward them.
struct SuitcaseSticker: View {
    enum Kind { case oval, pill, label }

    let title: String
    var group: Theme.Group
    var shape: Kind = .pill
    /// −6°, +4° and −2° in turn looks natural when several sit together.
    var tilt: Double = -6

    init(_ title: String, group: Theme.Group, shape: Kind = .pill, tilt: Double = -6) {
        self.title = title
        self.group = group
        self.shape = shape
        self.tilt = tilt
    }

    var body: some View {
        Text(title)
            .font(.footnote.weight(.bold))
            .foregroundStyle(group.onColor)
            .padding(.horizontal, Space.m).padding(.vertical, shape == .oval ? Space.m : Space.s)
            .background(group.color, in: background)
            .rotationEffect(.degrees(tilt))
            .shadow(color: .black.opacity(0.2), radius: 0, x: 0, y: 2)
            .accessibilityLabel(title)
    }

    private var background: AnyShape {
        switch shape {
        case .oval: AnyShape(Ellipse())
        case .pill: AnyShape(Capsule())
        case .label: AnyShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        }
    }
}

#Preview {
    LightDark {
        HStack(spacing: Space.m) {
            SuitcaseSticker("12 places", group: .food, shape: .oval, tilt: -6)
            SuitcaseSticker("4 cities", group: .travel, shape: .pill, tilt: 4)
            SuitcaseSticker("On budget", group: .money, shape: .label, tilt: -2)
        }
    }
}
