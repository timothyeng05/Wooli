import SwiftUI

/// A note from one place or memory: a postcard with a stamp in the corner and a wavy postmark.
/// A keepsake, once per detail screen. Not for lists or anything editable inline.
struct Postcard: View {
    let from: String
    var date: String?
    let title: String
    let message: String
    var stamp: String
    var group: Theme.Group = .travel

    var body: some View {
        HStack(alignment: .top, spacing: Space.m) {
            VStack(alignment: .leading, spacing: Space.s) {
                Text([("From " + from), date].compactMap { $0 }.joined(separator: " · "))
                    .wooliFont(.eyebrow).foregroundStyle(Theme.textTertiary)
                Text(title).font(.system(size: 22, weight: .heavy, design: .serif)).foregroundStyle(Theme.text)
                Text(message).font(.body).foregroundStyle(Theme.text)
            }
            Spacer(minLength: 0)
            stampBox
        }
        .padding(Space.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
        .shadow(color: Theme.cardShadow, radius: 2, y: 1)
        .accessibilityElement(children: .combine)
    }

    private var stampBox: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 3, style: .continuous).fill(group.color.opacity(0.14))
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .strokeBorder(group.color, style: StrokeStyle(lineWidth: 2, dash: [2, 3]))
            Text(stamp).font(.title2)
            VStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { _ in
                    WavyLine().stroke(Theme.textTertiary, lineWidth: 1).frame(height: 4)
                }
            }
            .padding(.horizontal, -Space.s)
        }
        .frame(width: 44, height: 52)
        .accessibilityHidden(true)
    }
}

private struct WavyLine: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let step = rect.width / 6
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        for i in 0..<6 {
            let x = rect.minX + step * CGFloat(i)
            p.addQuadCurve(to: CGPoint(x: x + step, y: rect.midY),
                           control: CGPoint(x: x + step / 2, y: i.isMultiple(of: 2) ? rect.minY : rect.maxY))
        }
        return p
    }
}

#Preview {
    LightDark {
        Postcard(from: "Lisbon", date: "Jun 2", title: "Pastéis at 7am",
                 message: "Queue was short, custard still warm. Order two, you will want the second.",
                 stamp: "🥐", group: .food)
    }
}
