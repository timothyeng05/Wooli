import SwiftUI

/// The one dark-blue block at the top of an overview that isn't about a journey.
/// Same gradient and type as the ticket, but no notches, so it never pretends to be one.
struct HeroCard<Content: View>: View {
    let eyebrow: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text(eyebrow).wooliFont(.eyebrow).foregroundStyle(Theme.ticketHighlight)
            content
        }
        .foregroundStyle(Theme.onTicket)
        .padding(Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [Theme.ticketStart, Theme.ticketEnd], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
        )
        .shadow(color: Theme.ticketShadow, radius: 10, y: 5)
    }
}

/// A month, cycle or countdown as a road: dashed ahead, solid travelled, a start stop and a you-are-here pin.
struct RouteProgress: View {
    /// 0...1 along the road.
    let progress: Double
    let startLabel: String
    var middleLabel: String?
    let endLabel: String

    var body: some View {
        VStack(spacing: Space.s) {
            GeometryReader { geo in
                let clamped = min(max(progress, 0), 1)
                let x = geo.size.width * clamped
                let y = geo.size.height / 2
                ZStack(alignment: .leading) {
                    Path { p in p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: geo.size.width, y: y)) }
                        .stroke(Theme.ticketRule, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [2, 5]))
                    Path { p in p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: x, y: y)) }
                        .stroke(Theme.onTicket, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    Circle().fill(Theme.onTicket).frame(width: 8, height: 8).position(x: 4, y: y)
                    Circle().fill(Theme.ticketHighlight).frame(width: 14, height: 14)
                        .overlay(Circle().strokeBorder(Theme.ticketStart, lineWidth: 2))
                        .position(x: min(max(x, 7), geo.size.width - 7), y: y)
                }
            }
            .frame(height: 20)
            HStack {
                Text(startLabel)
                Spacer()
                if let middleLabel { Text(middleLabel).fontWeight(.semibold) }
                Spacer()
                Text(endLabel)
            }
            .font(.caption)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([startLabel, middleLabel, endLabel].compactMap { $0 }.joined(separator: ", "))
        .accessibilityValue("\(Int(min(max(progress, 0), 1) * 100)) percent")
    }
}

#Preview {
    LightDark {
        HeroCard(eyebrow: "Left to spend") {
            Text("$1,284").wooliFont(.amount)
            RouteProgress(progress: 0.68, startLabel: "Oct 1", middleLabel: "Day 21 · $214 under your usual pace", endLabel: "Oct 31")
        }
    }
}
