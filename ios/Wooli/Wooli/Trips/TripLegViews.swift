import SwiftUI
import CoreLocation

/// One day card on the trip page. A day you move on also carries the
/// travel (shown inside the card) and, when you arrive somewhere new, that
/// leg's header as a divider: plans before the departure time sit above
/// the travel, the rest below the header.
struct TripDayBlock: Identifiable {
    let day: String
    let number: Int
    /// The leg the day (or its later part) belongs to; nil outside every leg.
    let leg: TripLeg?

    /// Arriving at `leg` today: travel from `travelFrom` (nil = from home),
    /// which may have started on an earlier day (an overnight flight).
    var arriving = false
    var travelFrom: TripLeg?
    var travelStart: String?
    var travel: [TripItem] = []
    /// Departure time; plans before it are shown above the travel.
    var departure: Int?

    /// Heading home at the end of the trip.
    var homeTravel: [TripItem] = []

    var id: String { day }
}

enum TripLayout {
    /// The day cards for a trip, plus the travel items shown inside them
    /// (so they aren't listed again among the day's plans).
    static func blocks(trip: Trip, items: [TripItem]) -> (blocks: [TripDayBlock], travelIDs: Set<String>) {
        let days = trip.days
        guard !trip.legs.isEmpty else {
            return (days.enumerated().map { TripDayBlock(day: $1, number: $0 + 1, leg: nil) }, [])
        }
        func transit(on day: String) -> [TripItem] {
            items.filter { $0.day == day && $0.kind == .transit }
                .sorted { ($0.time ?? Int.max, $0.createdAt) < ($1.time ?? Int.max, $1.createdAt) }
        }
        func hasOtherPlans(_ day: String) -> Bool { items.contains { $0.day == day && $0.kind != .transit } }

        var blocks: [TripDayBlock] = []
        var used = Set<String>()
        var previousLeg: TripLeg?
        // Travel on days outside every leg (an overnight flight), carried to the next arrival.
        var carried: [TripItem] = []
        var carriedFrom: String?

        for (index, day) in days.enumerated() {
            guard let leg = trip.leg(for: day) else {
                let hop = transit(on: day)
                if !hop.isEmpty {
                    carried += hop
                    carriedFrom = carriedFrom ?? day
                    used.formUnion(hop.map(\.id))
                }
                // A day that's only travel folds into the next card.
                if hop.isEmpty || hasOtherPlans(day) {
                    blocks.append(TripDayBlock(day: day, number: index + 1, leg: nil))
                }
                continue
            }
            var block = TripDayBlock(day: day, number: index + 1, leg: leg)
            if leg.id != previousLeg?.id {
                let hop = transit(on: day)
                block.arriving = true
                block.travelFrom = previousLeg
                block.travelStart = carriedFrom ?? day
                block.travel = carried + hop
                // Split the day at departure if it starts in the leg you're leaving.
                if previousLeg != nil, carried.isEmpty, let departure = hop.compactMap(\.time).min() {
                    block.departure = departure
                }
                used.formUnion(hop.map(\.id))
                carried = []
                carriedFrom = nil
                previousLeg = leg
            }
            blocks.append(block)
        }

        // Heading home from the last leg's last day (plus any travel after it).
        if let lastLeg = previousLeg, let i = blocks.lastIndex(where: { $0.leg?.id == lastLeg.id }) {
            let home = transit(on: blocks[i].day).filter { !used.contains($0.id) } + carried
            if !home.isEmpty {
                blocks[i].homeTravel = home
                used.formUnion(home.map(\.id))
            }
        }
        return (blocks, used)
    }
}

/// What the trip page lists, in order: day cards (a travel day split into
/// "1 of 2" in the city you leave and "2 of 2" where you arrive), travel
/// cards, and each leg's header.
enum TripRow: Identifiable {
    enum Half: Hashable { case whole, first, second }

    case day(TripDayBlock, half: Half, leg: TripLeg?)
    case travel(from: TripLeg?, to: TripLeg?, start: String, end: String, items: [TripItem])
    case legHeader(TripLeg)

    var id: String {
        switch self {
        case .day(let block, let half, _): "day-\(block.day)-\(half)"
        case .travel(let from, let to, let start, _, _): "travel-\(from?.id ?? "home")-\(to?.id ?? "home")-\(start)"
        case .legHeader(let leg): "leg-\(leg.id)"
        }
    }

    static func rows(blocks: [TripDayBlock], items: [TripItem], collapsed: Set<String>) -> [TripRow] {
        func hidden(_ leg: TripLeg?) -> Bool { leg.map { collapsed.contains($0.id) } ?? false }
        var rows: [TripRow] = []
        for block in blocks {
            if block.arriving, let leg = block.leg {
                // "1 of 2" when you're still in the last city that morning.
                let split = block.departure.map { departure in
                    (block.travelFrom.map { $0.endDay >= block.day } ?? false)
                        || items.contains { $0.day == block.day && $0.kind != .transit && ($0.time ?? Int.max) < departure }
                } ?? false
                if split && !hidden(block.travelFrom) {
                    rows.append(.day(block, half: .first, leg: block.travelFrom))
                }
                if !block.travel.isEmpty || block.travelFrom != nil {
                    rows.append(.travel(from: block.travelFrom, to: leg, start: block.travelStart ?? block.day,
                                        end: block.day, items: block.travel))
                }
                rows.append(.legHeader(leg))
                if !hidden(leg) { rows.append(.day(block, half: split ? .second : .whole, leg: leg)) }
            } else if !hidden(block.leg) {
                rows.append(.day(block, half: .whole, leg: block.leg))
            }
            if !block.homeTravel.isEmpty {
                rows.append(.travel(from: block.leg, to: nil, start: block.day, end: block.day, items: block.homeTravel))
            }
        }
        return rows
    }
}

// MARK: - Leg header

struct TripLegHeader: View {
    let leg: TripLeg
    let number: Int
    let colorHex: String
    let planCount: Int
    let isCollapsed: Bool
    let isNow: Bool

    var body: some View {
        let color = Color(hex: colorHex)
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(color.gradient)
                if leg.emoji.isEmpty || leg.emoji == "📍" {
                    Text("\(number)").font(.headline.weight(.bold)).foregroundStyle(.white)
                } else {
                    Text(leg.emoji).font(.title3)
                }
            }
            .frame(width: 44, height: 44)
            .shadow(color: color.opacity(0.35), radius: 6, y: 3)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(leg.name.isEmpty ? "Leg \(number)" : leg.name)
                        .font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                    if isNow {
                        Text("NOW").font(.caption2.weight(.heavy)).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(color, in: Capsule())
                    }
                }
                Text(summary).font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.down")
                .font(.footnote.weight(.bold))
                .foregroundStyle(color)
                .rotationEffect(.degrees(isCollapsed ? -90 : 0))
        }
        .padding(14)
        .background(
            LinearGradient(colors: [color.opacity(0.16), color.opacity(0.05)], startPoint: .leading, endPoint: .trailing),
            in: RoundedRectangle(cornerRadius: 20, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(color.opacity(0.22)))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint(isCollapsed ? "Shows this leg's days" : "Hides this leg's days")
    }

    private var summary: String {
        let start = DayKey.date(leg.startDay), end = DayKey.date(leg.endDay)
        let range = start == end ? start.formatted(.dateTime.month(.abbreviated).day())
            : (start..<end.addingTimeInterval(1)).formatted(.interval.month(.abbreviated).day())
        let nights = leg.nights == 0 ? "Day trip" : "\(leg.nights) night\(leg.nights == 1 ? "" : "s")"
        return "\(range) · \(nights) · \(planCount) plan\(planCount == 1 ? "" : "s")"
    }
}

// MARK: - Travel between legs

/// A boarding-pass style card for moving between legs: the two places, how
/// you get there, how far it is, and the bookings for that hop.
struct TripTravelCard: View {
    let fromName: String?
    let toName: String?
    let day: String
    /// Day you arrive, when the trip there runs overnight.
    var endDay: String? = nil
    let items: [TripItem]
    let distanceKm: Double?
    let onSelect: (TripItem) -> Void
    /// Add a booking for this hop (shown when there are none yet).
    let onAdd: () -> Void

    var body: some View {
        let mode = Self.mode(for: items)
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                endpoint(fromName ?? "Home", caption: fromName == nil ? "Getting there" : "From", alignment: .leading)
                route(symbol: mode.symbol)
                endpoint(toName ?? "Home", caption: toName == nil ? "Heading home" : "To", alignment: .trailing)
            }
            Text([dateText,
                  mode.label, distanceKm.map { "~\(Int($0.rounded()).formatted()) km" }]
                .compactMap { $0 }.joined(separator: " · "))
                .font(.caption.weight(.medium)).foregroundStyle(.white.opacity(0.85))

            if items.isEmpty {
                Button(action: onAdd) {
                    Label("Add how you're getting there", systemImage: "plus")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        Button { onSelect(item) } label: {
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text(item.timeText ?? "—").font(.caption.weight(.semibold)).monospacedDigit()
                                    .frame(width: 64, alignment: .leading)
                                Text(item.title).font(.subheadline.weight(.medium)).lineLimit(2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "chevron.right").font(.caption2.weight(.bold)).opacity(0.6)
                            }
                            .foregroundStyle(.white)
                            .padding(.vertical, 9)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if item.id != items.last?.id {
                            Rectangle().fill(.white.opacity(0.2)).frame(height: 1)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(16)
        .background(
            LinearGradient(colors: Self.gradient, startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        // Ticket notches.
        .mask {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .overlay(alignment: .leading) { Circle().frame(width: 18).offset(x: -9).blendMode(.destinationOut) }
                .overlay(alignment: .trailing) { Circle().frame(width: 18).offset(x: 9).blendMode(.destinationOut) }
                .compositingGroup()
        }
        .shadow(color: Self.gradient[1].opacity(0.3), radius: 10, y: 5)
        .padding(.vertical, 4)
    }

    private var dateText: String {
        let start = DayKey.date(day)
        guard let endDay, endDay != day else { return start.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()) }
        let style = Date.FormatStyle.dateTime.weekday(.abbreviated).month(.abbreviated).day()
        return "\(start.formatted(style)) → \(DayKey.date(endDay).formatted(style))"
    }

    private func endpoint(_ name: String, caption: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(caption.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
            Text(name).font(.headline.weight(.bold)).foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private func route(symbol: String) -> some View {
        HStack(spacing: 6) {
            dashes
            Image(systemName: symbol)
                .font(.subheadline.weight(.bold)).foregroundStyle(Self.gradient[1])
                .frame(width: 34, height: 34)
                .background(.white, in: Circle())
            dashes
        }
        .frame(width: 84)
    }

    private var dashes: some View {
        Line().stroke(.white.opacity(0.7), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [3, 4]))
            .frame(height: 2)
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            Path { $0.move(to: CGPoint(x: 0, y: rect.midY)); $0.addLine(to: CGPoint(x: rect.maxX, y: rect.midY)) }
        }
    }

    /// Every travel card (and the flight / train ticket) uses the same dark
    /// to light blue, so stays, food and activities can have their own colors.
    static let gradient = [Color(hex: "#1e3a8a"), Color(hex: "#3b82f6")]

    /// Best guess at how you're travelling, from the bookings' wording.
    static func mode(for items: [TripItem]) -> (symbol: String, label: String?) {
        if let mode = items.lazy.compactMap(\.transport?.mode).first { return (mode.symbol, mode.label) }
        let text = items.map { " \($0.title) \($0.notes) " }.joined().lowercased()
        func has(_ words: [String]) -> Bool { words.contains { text.contains($0) } }
        // A flight number like "CX928" or "UA 7923" counts as a flight too.
        let flightNumber = items.contains { $0.title.range(of: #"\b[A-Z][A-Z0-9] ?\d{2,4}\b"#, options: .regularExpression) != nil }
        if flightNumber || has(["flight", "fly ", "airport", "✈", "airline", "airways", "boarding",
                                "(hnd", "(nrt", "(kix", "(icn", "(jfk", "(hkg", "(ckg", "(pvg", "(pek", "(lgw", "(lhr",
                                " hnd", " nrt", " kix", " icn", " gmp", " jfk", " fuk", " hkg", " ckg", " pvg"]) {
            return ("airplane", "Flight")
        }
        if has(["shinkansen", "train", " jr ", "rail", "station", "ktx", "express"]) { return ("tram.fill", "Train") }
        if has(["ferry", "boat", "cruise"]) { return ("ferry.fill", "Ferry") }
        if has(["drive", "rental car", "car ", "road trip"]) { return ("car.fill", "Drive") }
        if has(["bus "]) { return ("bus.fill", "Bus") }
        return ("arrow.right", nil)
    }

    /// Straight-line distance between the middles of two legs' places.
    static func distanceKm(from: TripLeg?, to: TripLeg?, items: [TripItem]) -> Double? {
        func center(_ leg: TripLeg?) -> CLLocation? {
            guard let leg else { return nil }
            let places = items.filter { $0.day.map(leg.contains) ?? false }.compactMap(\.place)
            guard !places.isEmpty else { return nil }
            let lat = places.map(\.latitude).reduce(0, +) / Double(places.count)
            let lon = places.map(\.longitude).reduce(0, +) / Double(places.count)
            return CLLocation(latitude: lat, longitude: lon)
        }
        guard let a = center(from), let b = center(to) else { return nil }
        let km = a.distance(from: b) / 1000
        return km >= 20 ? km : nil
    }
}
