import SwiftUI
import MapKit

// MARK: - Route header

/// Top of the flight / train editor: the route on a map (a great-circle arc
/// for flights) and a boarding-pass strip with both ends, times and how long
/// the trip takes.
struct TransportHero: View {
    let transport: TripTransport
    let departDay: String?
    let departTime: Int?

    private struct End {
        let title: String
        let subtitle: String
        let coordinate: CLLocationCoordinate2D?
    }

    var body: some View {
        let ends = self.ends
        VStack(spacing: 0) {
            map(ends.from.coordinate, ends.to.coordinate)
                .frame(height: 190)
            pass(ends)
                .padding(16)
        }
        .accessibilityElement(children: .combine)
    }

    private var ends: (from: End, to: End) {
        switch transport.mode {
        case .flight:
            let a = transport.from, b = transport.to
            return (End(title: a?.code ?? "From", subtitle: a?.place ?? "Choose airport", coordinate: a?.coordinate),
                    End(title: b?.code ?? "To", subtitle: b?.place ?? "Choose airport", coordinate: b?.coordinate))
        case .train:
            let a = transport.fromStation, b = transport.toStation
            return (End(title: a?.name ?? "From", subtitle: a?.address ?? "Choose station", coordinate: a?.coordinate),
                    End(title: b?.name ?? "To", subtitle: b?.address ?? "Choose station", coordinate: b?.coordinate))
        }
    }

    @ViewBuilder
    private func map(_ a: CLLocationCoordinate2D?, _ b: CLLocationCoordinate2D?) -> some View {
        if a != nil || b != nil {
            Map(initialPosition: .automatic, interactionModes: []) {
                if let a, let b {
                    MapPolyline(coordinates: [a, b], contourStyle: transport.mode == .flight ? .geodesic : .straight)
                        .stroke(Theme.brand, style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [2, 7]))
                }
                if let a { Annotation("", coordinate: a) { pin(ends.from.title, filled: false) } }
                if let b { Annotation("", coordinate: b) { pin(ends.to.title, filled: true) } }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
            // Re-frame when an end changes; `initialPosition` only applies once.
            .id("\(a?.latitude ?? 0),\(a?.longitude ?? 0)-\(b?.latitude ?? 0),\(b?.longitude ?? 0)")
            .allowsHitTesting(false)
        } else {
            ZStack {
                LinearGradient(colors: [Theme.brandSoft, Theme.track], startPoint: .topLeading, endPoint: .bottomTrailing)
                VStack(spacing: 8) {
                    Image(systemName: transport.mode == .flight ? "airplane.departure" : "tram.fill")
                        .font(.largeTitle).foregroundStyle(Theme.brand)
                    Text(transport.mode == .flight ? "Choose airports to see the route" : "Choose stations to see the route")
                        .font(.footnote).foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }

    private func pin(_ text: String, filled: Bool) -> some View {
        Text(transport.mode == .flight ? text : "")
            .font(.caption.weight(.heavy)).monospaced()
            .foregroundStyle(filled ? .white : Theme.brand)
            .padding(.horizontal, transport.mode == .flight ? 8 : 6).padding(.vertical, transport.mode == .flight ? 4 : 6)
            .background(filled ? Theme.brand : Theme.card, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.brand, lineWidth: 2))
            .shadow(color: .black.opacity(0.15), radius: 3, y: 1)
    }

    private func pass(_ ends: (from: End, to: End)) -> some View {
        let duration = transport.durationMinutes(departDay: departDay, departTime: departTime)
        return VStack(spacing: 12) {
            if transport.mode == .flight, let airline = transport.airlineName {
                Text([airline, transport.flightNumber.uppercased()].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(alignment: .top, spacing: 8) {
                endColumn(ends.from, time: departTime, dayOffset: 0, terminal: transport.departTerminal, alignment: .leading)
                VStack(spacing: 4) {
                    HStack(spacing: 4) {
                        dashes
                        Image(systemName: transport.mode.symbol).font(.subheadline.weight(.bold)).foregroundStyle(Theme.brand)
                        dashes
                    }
                    Text(duration.map(TripTransport.durationText) ?? " ")
                        .font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(Theme.text)
                    if let km = transport.distanceKm, km >= 1 {
                        Text("\(Int(km.rounded()).formatted()) km").font(.caption2).foregroundStyle(Theme.textTertiary)
                    }
                }
                .frame(width: 92)
                .padding(.top, transport.mode == .flight ? 10 : 4)
                endColumn(ends.to, time: transport.arriveTime, dayOffset: transport.arriveDayOffset,
                          terminal: transport.arriveTerminal, alignment: .trailing)
            }
        }
    }

    private func endColumn(_ end: End, time: Int?, dayOffset: Int, terminal: String, alignment: HorizontalAlignment) -> some View {
        let isFlight = transport.mode == .flight
        return VStack(alignment: alignment, spacing: 2) {
            Text(end.title)
                .font(isFlight ? Font.system(size: 34, weight: .heavy, design: .rounded) : Font.headline.weight(.bold))
                .foregroundStyle(Theme.text)
                .lineLimit(2).minimumScaleFactor(0.7)
                .multilineTextAlignment(alignment == .leading ? .leading : .trailing)
            Text(end.subtitle).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            if let time {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(TripTransport.timeText(time)).font(.title3.weight(.semibold)).monospacedDigit()
                    if dayOffset > 0 {
                        Text("+\(dayOffset)").font(.caption2.weight(.bold)).foregroundStyle(Theme.pending)
                    }
                }
                .foregroundStyle(Theme.text)
                .padding(.top, 4)
            }
            if isFlight, !terminal.isEmpty {
                Text("Terminal \(terminal)").font(.caption2.weight(.medium)).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private var dashes: some View {
        Rectangle().fill(Theme.textTertiary.opacity(0.6)).frame(height: 1.5)
    }
}

extension TripTransport {
    /// "14:55" / "2:55 PM", following the phone's 12/24-hour setting.
    static func timeText(_ minutes: Int) -> String {
        let date = Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: .now) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }
}

// MARK: - Airport search

struct AirportSearchView: View {
    let title: String
    let onPick: (Airport) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var searchFocused: Bool

    var body: some View {
        let results = Airports.search(query)
        List(results) { airport in
            Button {
                onPick(airport)
                dismiss()
            } label: {
                AirportLabel(airport: airport)
            }
        }
        .overlay {
            if query.isEmpty {
                ContentUnavailableView("Search airports", systemImage: "airplane.departure",
                                       description: Text("Type a code like HKG, a city, or an airport's name."))
            } else if results.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Code, city or airport")
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .searchFocused($searchFocused)
        .onAppear { searchFocused = true }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AirportLabel: View {
    let airport: Airport

    var body: some View {
        HStack(spacing: 12) {
            Text(airport.code)
                .font(.subheadline.weight(.heavy)).monospaced()
                .foregroundStyle(Theme.brand)
                .frame(width: 52, height: 34)
                .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                // "Hong Kong", not "Hong Kong, Hong Kong" (same for Singapore, Macao…).
                let country = Locale.current.localizedString(forRegionCode: airport.country)
                Text([airport.place, country == airport.place ? nil : country].compactMap { $0 }.joined(separator: ", "))
                    .font(.subheadline.weight(.medium)).foregroundStyle(Theme.text)
                Text(airport.name).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
        }
    }
}
