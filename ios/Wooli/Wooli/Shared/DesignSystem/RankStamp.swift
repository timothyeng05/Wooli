import SwiftUI

/// Eats' ranking mark: a tilted passport stamp showing where a place sits on your list.
/// The number is the place's position on the whole list; the tier word is always printed.
struct RankStamp: View {
    enum Tier {
        case loved, fine, skip

        var word: String {
            switch self {
            case .loved: "Loved"
            case .fine: "Fine"
            case .skip: "Skip"
            }
        }

        /// Eats' bands: 7–10 loved, 4–6.9 fine, below 4 skip.
        init(score: Double) {
            self = score >= 7 ? .loved : score >= 4 ? .fine : .skip
        }

        var ink: Color {
            switch self {
            case .loved: Theme.brand
            case .fine: Theme.stampFine
            case .skip: Theme.textTertiary
            }
        }
    }

    enum Size: Equatable {
        /// 92pt, once at the top of a place's detail screen.
        case detail
        /// 40pt in an `ItemRow`: only the number shows.
        case row
        /// Any other size; 80pt and up shows the full stamp, smaller shows the number.
        case custom(CGFloat)

        var points: CGFloat {
            switch self {
            case .detail: 92
            case .row: 40
            case .custom(let points): points
            }
        }

        var isFull: Bool { points >= 80 }
    }

    /// Position on the list; nil (a friend's place, say) prints the tier word instead.
    let rank: Int?
    let tier: Tier
    /// Neighbourhood or city (movies: the release year). Detail size only.
    var place: String?
    var total: Int?
    var size: Size = .detail

    var body: some View {
        let s = size.points / 92
        ZStack {
            Circle().fill(Theme.card)
            Circle().strokeBorder(tier.ink, lineWidth: 3 * s)
            Circle().strokeBorder(tier.ink, lineWidth: max(1 * s, 0.75)).padding(6 * s)
            if size.isFull {
                VStack(spacing: 0) {
                    Text(tier.word).font(.system(size: 10, weight: .bold)).tracking(1.1).textCase(.uppercase)
                    Text(rank.map(String.init) ?? "–").font(.system(size: 32, weight: .black, design: .rounded)).monospacedDigit()
                    if let place {
                        Text(place).font(.system(size: 8, weight: .semibold)).textCase(.uppercase).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                .padding(.horizontal, 14)
            } else {
                if let rank {
                    Text("\(rank)").font(.system(size: 16 * max(size.points / 40, 0.6), weight: .black, design: .rounded)).monospacedDigit()
                } else {
                    Text(tier.word).font(.system(size: 9 * max(size.points / 40, 0.8), weight: .bold)).textCase(.uppercase)
                        .minimumScaleFactor(0.6).lineLimit(1).padding(.horizontal, 4)
                }
            }
        }
        .foregroundStyle(tier.ink)
        .frame(width: size.points, height: size.points)
        .rotationEffect(.degrees(-8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rank.map { "\(tier.word), number \($0)\(total.map { " of \($0)" } ?? "")" } ?? tier.word)
    }
}

#Preview {
    LightDark {
        VStack(spacing: Space.l) {
            HStack(spacing: Space.l) {
                RankStamp(rank: 3, tier: .loved, place: "Shibuya", total: 42)
                RankStamp(rank: 18, tier: .fine, place: "Lisbon")
                RankStamp(rank: 41, tier: .skip, place: "Soho")
            }
            HStack(spacing: Space.l) {
                RankStamp(rank: 3, tier: .loved, size: .row)
                RankStamp(rank: 18, tier: .fine, size: .row)
                RankStamp(rank: 41, tier: .skip, size: .row)
            }
        }
    }
}
