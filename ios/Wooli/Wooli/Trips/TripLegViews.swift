import SwiftUI
import CoreLocation

/// The trip page as a sequence: travel to the first stop, each leg with its
/// days, travel between legs, and the trip home. Days outside every leg are
/// listed on their own.
enum TripSegment: Identifiable {
    case leg(TripLeg, number: Int, days: [(day: String, number: Int)])
    case looseDay(day: String, number: Int)
    case travel(from: TripLeg?, to: TripLeg?, day: String, items: [TripItem])

    var id: String {
        switch self {
        case .leg(let leg, _, _): "leg-\(leg.id)"
        case .looseDay(let day, _): "day-\(day)"
        case .travel(let from, let to, let day, _): "travel-\(from?.id ?? "start")-\(to?.id ?? "end")-\(day)"
        }
    }

    /// Travel items on the day you move between legs (plus the first and
    /// last day of the trip) go on a travel card instead of a day card.
    static func build(trip: Trip, items: [TripItem]) -> (segments: [TripSegment], onTravelCards: Set<String>) {
        let days = trip.days
        guard !trip.legs.isEmpty else {
            return (days.enumerated().map { .looseDay(day: $1, number: $0 + 1) }, [])
        }
        func travel(on day: String) -> [TripItem] {
            items.filter { $0.day == day && $0.kind == .transit }
                .sorted { ($0.time ?? Int.max, $0.createdAt) < ($1.time ?? Int.max, $1.createdAt) }
        }

        // Group consecutive days by leg.
        var groups: [(leg: TripLeg?, days: [(day: String, number: Int)])] = []
        for (index, day) in days.enumerated() {
            let leg = trip.leg(for: day)
            if let last = groups.last, last.leg?.id == leg?.id, leg != nil {
                groups[groups.count - 1].days.append((day, index + 1))
            } else {
                groups.append((leg, [(day, index + 1)]))
            }
        }

        var segments: [TripSegment] = []
        var used = Set<String>()
        var previousLeg: TripLeg?
        for (i, group) in groups.enumerated() {
            if let leg = group.leg, let first = group.days.first {
                // Arriving at this leg: from the previous leg, or the trip start.
                let moving = travel(on: first.day)
                if previousLeg != nil || (i == 0 && !moving.isEmpty) {
                    segments.append(.travel(from: previousLeg, to: leg, day: first.day, items: moving))
                    used.formUnion(moving.map(\.id))
                }
                let number = (trip.legs.firstIndex { $0.id == leg.id } ?? 0) + 1
                segments.append(.leg(leg, number: number, days: group.days))
                previousLeg = leg
            } else {
                segments.append(contentsOf: group.days.map { .looseDay(day: $0.day, number: $0.number) })
            }
        }
        // Heading home from the last leg.
        if let lastLeg = previousLeg, let lastDay = days.last, lastLeg.contains(lastDay) {
            let moving = travel(on: lastDay).filter { !used.contains($0.id) }
            if !moving.isEmpty {
                segments.append(.travel(from: lastLeg, to: nil, day: lastDay, items: moving))
                used.formUnion(moving.map(\.id))
            }
        }
        return (segments, used)
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
    let fromHex: String
    let toHex: String
    let day: String
    let items: [TripItem]
    let distanceKm: Double?
    let onSelect: (TripItem) -> Void

    var body: some View {
        let mode = Self.mode(for: items)
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                endpoint(fromName ?? "Home", caption: fromName == nil ? "Getting there" : "From", alignment: .leading)
                route(symbol: mode.symbol)
                endpoint(toName ?? "Home", caption: toName == nil ? "Heading home" : "To", alignment: .trailing)
            }
            Text([DayKey.date(day).formatted(.dateTime.weekday(.wide).month(.abbreviated).day()),
                  mode.label, distanceKm.map { "~\(Int($0.rounded()).formatted()) km" }]
                .compactMap { $0 }.joined(separator: " · "))
                .font(.caption.weight(.medium)).foregroundStyle(.white.opacity(0.85))

            if !items.isEmpty {
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
            LinearGradient(colors: [Color(hex: fromHex), Color(hex: toHex)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        // Ticket notches.
        .mask {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .overlay(alignment: .leading) { Circle().frame(width: 18).offset(x: -9).blendMode(.destinationOut) }
                .overlay(alignment: .trailing) { Circle().frame(width: 18).offset(x: 9).blendMode(.destinationOut) }
                .compositingGroup()
        }
        .shadow(color: Color(hex: toHex).opacity(0.3), radius: 10, y: 5)
        .padding(.vertical, 4)
    }

    private func endpoint(_ name: String, caption: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(caption.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
            Text(name).font(.headline.weight(.bold)).foregroundStyle(.white).lineLimit(2)
                .multilineTextAlignment(alignment == .leading ? .leading : .trailing)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private func route(symbol: String) -> some View {
        HStack(spacing: 6) {
            dashes
            Image(systemName: symbol)
                .font(.subheadline.weight(.bold)).foregroundStyle(Color(hex: toHex))
                .frame(width: 34, height: 34)
                .background(.white, in: Circle())
            dashes
        }
        .frame(width: 110)
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

    /// Best guess at how you're travelling, from the bookings' wording.
    static func mode(for items: [TripItem]) -> (symbol: String, label: String?) {
        let text = items.map { " \($0.title) \($0.notes) " }.joined().lowercased()
        func has(_ words: [String]) -> Bool { words.contains { text.contains($0) } }
        if has(["flight", "fly ", "airport", "✈", " hnd", " nrt", " kix", " icn", " gmp", " jfk", " fuk", "airline", "boarding"]) { return ("airplane", "Flight") }
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
