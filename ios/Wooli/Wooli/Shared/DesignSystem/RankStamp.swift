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

        var ink: Color {
            switch self {
            case .loved: Theme.brand
            case .fine: Theme.stampFine
            case .skip: Theme.textTertiary
            }
        }
    }

    enum Size {
        /// 92pt, once at the top of a place's detail screen.
        case detail
        /// 40pt in an `ItemRow`: only the number shows.
        case row

        var points: CGFloat { self == .detail ? 92 : 40 }
    }

    let rank: Int
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
            if size == .detail {
                VStack(spacing: 0) {
                    Text(tier.word).font(.system(size: 10, weight: .bold)).tracking(1.1).textCase(.uppercase)
                    Text("\(rank)").font(.system(size: 32, weight: .black, design: .rounded)).monospacedDigit()
                    if let place {
                        Text(place).font(.system(size: 8, weight: .semibold)).textCase(.uppercase).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                .padding(.horizontal, 14)
            } else {
                Text("\(rank)").font(.system(size: 16, weight: .black, design: .rounded)).monospacedDigit()
            }
        }
        .foregroundStyle(tier.ink)
        .frame(width: size.points, height: size.points)
        .rotationEffect(.degrees(-8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(tier.word), number \(rank)\(total.map { " of \($0)" } ?? "")")
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
