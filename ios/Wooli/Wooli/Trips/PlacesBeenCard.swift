import SwiftUI

/// "Places you've been" (M4-1): what your finished trips add up to, with a flag for each country.
/// Only shown once at least one trip has ended and has a number worth showing.
struct PlacesBeenCard: View {
    let stats: TravelStats

    var body: some View {
        if stats.trips > 0 {
            VStack(alignment: .leading, spacing: Space.m) {
                Text("Places you've been").font(.headline).foregroundStyle(Theme.text)
                HStack(alignment: .top, spacing: Space.xl) {
                    figure(stats.countries.count, "countr\(stats.countries.count == 1 ? "y" : "ies")")
                    figure(stats.cities, "cit\(stats.cities == 1 ? "y" : "ies")")
                    figure(stats.nights, "night\(stats.nights == 1 ? "" : "s") away")
                    figure(stats.flights, "flight\(stats.flights == 1 ? "" : "s")")
                    Spacer(minLength: 0)
                }
                if !stats.countries.isEmpty {
                    // Flags with the name on hover and for VoiceOver.
                    HStack(spacing: Space.xs) {
                        ForEach(stats.countries, id: \.self) { code in
                            Text(TravelStatsMaker.flag(code)).font(.title2)
                                .help(TravelStatsMaker.countryName(code))
                                .accessibilityLabel(TravelStatsMaker.countryName(code))
                        }
                    }
                }
            }
            .padding(Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
            .accessibilityElement(children: .contain)
        }
    }

    private func figure(_ number: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(number)").font(.title.weight(.bold)).monospacedDigit().foregroundStyle(Theme.text)
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
        }
    }
}
