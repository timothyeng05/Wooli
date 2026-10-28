import SwiftUI
import CoreLocation

/// One day card on the trip page. A day you travel carries the ticket
/// inside the card, where it falls in the day: plans before the departure
/// above it, the rest below.
struct TripDayBlock: Identifiable {
    let day: String
    let number: Int
    /// The leg the day belongs to; nil outside every leg.
    let leg: TripLeg?

    /// Today starts a new leg (its header goes above this card).
    var arriving = false
    /// The ticket shown in this card: travel that departs today, from
    /// `travelFrom` (nil = home) to `travelTo` (nil = home), arriving on
    /// `travelEnd` when it runs overnight.
    var travel: [TripItem] = []
    /// Other people's travel you're meeting today ("[Mom] HKG → FUK").
    var meeting: [TripItem] = []
    var showsTicket = false
    var travelFrom: TripLeg?
    var travelTo: TripLeg?
    var travelEnd: String?
    /// Departure time; plans before it sit above the ticket.
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
        // A day's travel that moves you on: not out-and-back side trips
        // (those stay in the day as plans) and not other people's bookings.
        func transit(on day: String) -> [TripItem] {
            let all = items.filter { $0.day == day && $0.kind == .transit }
                .sorted { ($0.time ?? Int.max, $0.createdAt) < ($1.time ?? Int.max, $1.createdAt) }
            let side = TravelLegs.sideTripIDs(in: all)
            return all.filter { !side.contains($0.id) && !TravelLegs.isSomeoneElse($0) }
        }
        func meeting(on day: String) -> [TripItem] {
            items.filter { $0.day == day && $0.kind == .transit && TravelLegs.isSomeoneElse($0) }
        }

        var blocks: [TripDayBlock] = []
        var used = Set<String>()
        var previousLeg: TripLeg?
        // A ticket on a day outside every leg (an overnight flight), still
        // waiting to learn where it lands.
        var inFlight: Int?

        for (index, day) in days.enumerated() {
            guard let leg = trip.leg(for: day) else {
                var block = TripDayBlock(day: day, number: index + 1, leg: nil)
                block.meeting = meeting(on: day)
                used.formUnion(block.meeting.map(\.id))
                let hop = transit(on: day)
                if !hop.isEmpty {
                    block.travel = hop
                    block.showsTicket = true
                    block.travelFrom = previousLeg
                    block.departure = hop.compactMap(\.time).min()
                    used.formUnion(hop.map(\.id))
                    inFlight = blocks.count
                }
                blocks.append(block)
                continue
            }
            var block = TripDayBlock(day: day, number: index + 1, leg: leg)
            block.meeting = meeting(on: day)
            used.formUnion(block.meeting.map(\.id))
            if leg.isHome {
                // Where the trip starts: its travel is the way out, landing at the next city.
                block.arriving = leg.id != previousLeg?.id
                let hop = transit(on: day)
                if !hop.isEmpty {
                    block.travel = hop
                    block.showsTicket = true
                    block.travelFrom = leg
                    block.departure = hop.compactMap(\.time).min()
                    used.formUnion(hop.map(\.id))
                    inFlight = blocks.count
                }
                previousLeg = leg
                blocks.append(block)
                continue
            }
            if leg.id != previousLeg?.id {
                block.arriving = true
                let hop = transit(on: day)
                if let i = inFlight {
                    // Landing from yesterday's flight; anything booked today is a connection.
                    blocks[i].travelTo = leg
                    blocks[i].travelEnd = day
                    inFlight = nil
                    if !hop.isEmpty {
                        block.travel = hop
                        block.showsTicket = true
                        block.travelFrom = blocks[i].travelFrom
                        block.travelTo = leg
                        block.departure = hop.compactMap(\.time).min()
                    }
                } else {
                    block.travel = hop
                    // Moving on from another city: show the ticket even before it's booked.
                    block.showsTicket = !hop.isEmpty || previousLeg != nil
                    block.travelFrom = previousLeg
                    block.travelTo = leg
                    block.departure = hop.compactMap(\.time).min()
                }
                used.formUnion(hop.map(\.id))
                previousLeg = leg
            }
            blocks.append(block)
        }

        // Others' travel rides in a ticket; on a day without one it stays a plan.
        for i in blocks.indices where !blocks[i].showsTicket && blocks[i].homeTravel.isEmpty && !blocks[i].meeting.isEmpty {
            used.subtract(blocks[i].meeting.map(\.id))
            blocks[i].meeting = []
        }

        // Heading home from the last leg's last day.
        if let lastLeg = previousLeg, let i = blocks.lastIndex(where: { $0.leg?.id == lastLeg.id }) {
            let home = transit(on: blocks[i].day).filter { !used.contains($0.id) }
            if !home.isEmpty {
                blocks[i].homeTravel = home
                used.formUnion(home.map(\.id))
            }
        }
        return (blocks, used)
    }
}

/// What the trip page lists, in order: each leg's header, then its day
/// cards (travel rides inside them). A collapsed leg still shows its
/// tickets, so the trip reads as its stops and how you got between them.
enum TripRow: Identifiable {
    case day(TripDayBlock, leg: TripLeg?)
    case travel(from: TripLeg?, to: TripLeg?, start: String, end: String, items: [TripItem], arrival: String)
    case legHeader(TripLeg)

    var id: String {
        switch self {
        case .day(let block, _): "day-\(block.day)"
        case .travel(_, _, _, _, _, let arrival): "travel-\(arrival)"
        case .legHeader(let leg): "leg-\(leg.id)"
        }
    }

    static func rows(blocks: [TripDayBlock], items: [TripItem], collapsed: Set<String>) -> [TripRow] {
        func hidden(_ leg: TripLeg?) -> Bool { leg.map { collapsed.contains($0.id) } ?? false }
        var rows: [TripRow] = []
        for block in blocks {
            if block.arriving, let leg = block.leg { rows.append(.legHeader(leg)) }
            if !hidden(block.leg) {
                rows.append(.day(block, leg: block.leg))
            } else {
                if block.showsTicket {
                    rows.append(.travel(from: block.travelFrom, to: block.travelTo, start: block.day,
                                        end: block.travelEnd ?? block.day, items: block.travel, arrival: block.day))
                }
                if !block.homeTravel.isEmpty {
                    rows.append(.travel(from: block.leg, to: nil, start: block.day, end: block.day,
                                        items: block.homeTravel, arrival: block.day + "-home"))
                }
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
                    Text(leg.name.isEmpty ? "City \(number)" : leg.name)
                        .font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                    if isNow {
                        Text("NOW").font(.caption2.weight(.heavy)).foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(color, in: Capsule())
                    }
                }
                Text(summary).font(.caption).foregroundStyle(Theme.textSecondary)
                if isCollapsed {
                    // Folded cities keep their plans; say so, so it doesn't read as empty.
                    Label("Folded · tap to show its days", systemImage: "eye.slash")
                        .font(.caption.weight(.semibold)).foregroundStyle(color)
                }
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
        .accessibilityHint(isCollapsed ? "Shows this city's days" : "Hides this city's days")
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
    /// Other people's travel you're meeting, shown under the route.
    var meeting: [TripItem] = []
    let distanceKm: Double?
    let onSelect: (TripItem) -> Void
    /// Add a booking for this hop (shown when there are none yet).
    let onAdd: () -> Void

    var body: some View {
        let modes = TravelLegs.modes(of: items)
        let main = TravelLegs.mainMode(of: items)
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                endpoint(fromName ?? "Home", caption: fromName == nil ? "Getting there" : "From", alignment: .leading)
                route(symbols: modes.isEmpty ? [Self.mode(for: items).symbol] : modes.map(\.symbol))
                endpoint(toName ?? "Home", caption: toName == nil ? "Heading home" : "To", alignment: .trailing)
            }
            Text([dateText,
                  modes.count > 1 ? modes.map(\.label).joined(separator: " + ") : main?.label,
                  distanceKm.map { "~\(Int($0.rounded()).formatted()) km" }]
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
                            HStack(alignment: .center, spacing: 10) {
                                Image(systemName: TravelLegs.mode(of: item).symbol)
                                    .font(.caption.weight(.bold)).foregroundStyle(Self.gradient[0])
                                    .frame(width: 26, height: 26)
                                    .background(.white, in: Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(TravelLegs.title(of: item)).font(.subheadline.weight(.semibold)).lineLimit(2)
                                    Text(legDetail(item)).font(.caption.weight(.medium)).monospacedDigit().opacity(0.8)
                                }
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
            ForEach(meeting) { item in
                Button { onSelect(item) } label: {
                    Label {
                        Text("Meeting " + meetingText(item)).lineLimit(2)
                    } icon: {
                        Image(systemName: TravelLegs.mode(of: item) == .other ? "person.2.fill" : TravelLegs.mode(of: item).symbol)
                    }
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.9))
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
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

    /// "21:00–22:30 · 1h 30m", from what's known.
    private func legDetail(_ item: TripItem) -> String {
        let minutes = TravelLegs.minutes(of: item)
        let time: String? = item.time.map { depart in
            let start = TripTransport.timeText(depart)
            guard let minutes else { return start }
            // The arrival as it reads where you land (a flight can cross time zones).
            return "\(start)–\(TripTransport.timeText(item.transport?.arriveTime ?? (depart + minutes) % 1440))"
        }
        return [time ?? "No time yet", minutes.map(TripTransport.durationText)].compactMap { $0 }.joined(separator: " · ")
    }

    /// "Mom / Jojo · HKG → FUK, lands 16:10".
    private func meetingText(_ item: TripItem) -> String {
        let title = item.title.replacingOccurrences(of: "[", with: "").replacingOccurrences(of: "]", with: " ·")
        guard let depart = item.time, let minutes = TravelLegs.minutes(of: item) else { return title }
        return "\(title), lands \(TripTransport.timeText((depart + minutes) % 1440))"
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

    /// The dashed route with each way of travelling on it, in order.
    private func route(symbols: [String]) -> some View {
        HStack(spacing: 4) {
            dashes
            ForEach(Array(symbols.prefix(3).enumerated()), id: \.offset) { i, symbol in
                if i > 0 { Image(systemName: "chevron.right").font(.caption2.weight(.heavy)).foregroundStyle(.white.opacity(0.8)) }
                Image(systemName: symbol)
                    .font(.subheadline.weight(.bold)).foregroundStyle(Self.gradient[1])
                    .frame(width: 34, height: 34)
                    .background(.white, in: Circle())
            }
            dashes
        }
        .frame(width: symbols.count > 1 ? 120 : 84)
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
