import SwiftUI

/// A cinema ticket for Movies, the one module besides Trips where a ticket is the real object.
/// The rank sits on the tear-off stub. Movie rows in lists use `RankStamp`; the stub is the hero.
struct CinemaStub: View {
    let title: String
    var meta: String?
    /// nil prints a dash for a film that isn't ranked yet.
    var rank: Int?

    private var color: Color { Theme.Group.fun.color }

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Space.xs) {
                Text("Admit one").wooliFont(.eyebrow)
                Text(title).font(.title2.weight(.bold))
                if let meta { Text(meta).font(.footnote) }
            }
            .padding(Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)

            Line().stroke(Theme.Group.fun.onColor.opacity(0.7), style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
                .frame(width: 2)
                .padding(.vertical, Space.s)

            VStack(spacing: Space.xs) {
                Text("Rank").wooliFont(.eyebrow)
                Text(rank.map(String.init) ?? "–").wooliFont(.code)
            }
            .frame(width: 84)
        }
        .foregroundStyle(Theme.Group.fun.onColor)
        .background(color, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .shadow(color: color.opacity(0.3), radius: 8, y: 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title)\(meta.map { ", \($0)" } ?? ""), \(rank.map { "rank \($0)" } ?? "not ranked yet")")
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: rect.midX, y: rect.minY))
            p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
            return p
        }
    }
}

#Preview {
    LightDark {
        VStack(spacing: Space.m) {
            CinemaStub(title: "Perfect Days", meta: "Wim Wenders · 2023 · Drama", rank: 4)
            CinemaStub(title: "Your list · 0 movies")
        }
    }
}
