import Foundation

// M2-3: reading a pasted confirmation (flight, hotel) into bookings. This is
// the deterministic reader: patterns and the airport list, no model. It runs
// on-device and its result is always shown for review before anything is saved.

/// One booking found in a confirmation, before it becomes a plan.
struct ImportedBooking: Identifiable, Equatable {
    var id = UUID().uuidString
    var kind: TripItem.Kind = .transit
    var title = ""
    var mode: TripTransport.Mode = .flight
    var flightNumber = ""
    var from = ""
    var to = ""
    /// Departure or check-in day, "yyyy-MM-dd".
    var day: String?
    /// Minutes after midnight.
    var time: Int?
    var arriveTime: Int?
    var arriveDayOffset = 0
    var checkOutDay: String?
    var confirmation = ""
    var price: Double?
    var currency: String?
    var seats = ""
    var cabin = ""
    /// Off in the review sheet = not added.
    var include = true

    /// The plan this becomes, booked and marked as imported.
    func tripItem(tripID: String) -> TripItem {
        var item = TripItem(tripID: tripID, day: day, kind: kind, title: title, time: time)
        if kind == .transit {
            var t = TripTransport(mode: mode)
            t.flightNumber = flightNumber
            t.fromAirport = from
            t.toAirport = to
            t.arriveTime = arriveTime
            t.arriveDayOffset = arriveDayOffset
            t.confirmation = confirmation
            t.seats = seats
            t.cabin = cabin
            if let name = Airlines.name(forFlight: flightNumber) { t.airline = name }
            item.transport = t
            if title.isEmpty { item.title = t.suggestedTitle }
        }
        if kind == .stay { item.checkOutDay = checkOutDay }
        item.cost = price
        item.currency = currency
        var extras = ItemExtras()
        extras.status = .booked
        extras.source = "import"
        item.extras = extras
        if kind == .stay, !confirmation.isEmpty { item.notes = "Confirmation \(confirmation)" }
        return item
    }

    /// `existing` with what the confirmation says laid over it: status, code, times and price.
    /// Keeps the plan's id, notes, place and order.
    func updating(_ existing: TripItem) -> TripItem {
        var item = existing
        let fresh = tripItem(tripID: existing.tripID)
        if kind == .transit {
            var t = existing.transport ?? TripTransport(mode: mode)
            let new = fresh.transport
            if !confirmation.isEmpty { t.confirmation = confirmation }
            if let new, !new.fromAirport.isEmpty { t.fromAirport = new.fromAirport }
            if let new, !new.toAirport.isEmpty { t.toAirport = new.toAirport }
            if arriveTime != nil { t.arriveTime = arriveTime; t.arriveDayOffset = arriveDayOffset }
            if !seats.isEmpty { t.seats = seats }
            if !cabin.isEmpty { t.cabin = cabin }
            item.transport = t
        } else if kind == .stay {
            if let checkOutDay { item.checkOutDay = checkOutDay }
        }
        if time != nil { item.time = time }
        if let price { item.cost = price; item.currency = currency ?? item.currency }
        item.setStatus(.booked)
        return item
    }

    /// Something to tell the user before adding: a date outside the trip, or none at all.
    func warning(trip: Trip) -> String? {
        guard let day else { return "No date found" }
        if day < trip.startDay || day > trip.endDay { return "Outside the trip's dates" }
        return nil
    }
}

enum BookingImport {
    /// The plan already in the trip that this booking would repeat: the same
    /// flight number on the same day, or a stay with the same name and check-in.
    static func duplicate(of booking: ImportedBooking, in items: [TripItem]) -> TripItem? {
        items.first { item in
            guard item.day == booking.day, item.kind == booking.kind else { return false }
            switch booking.kind {
            case .transit:
                let number = item.transport?.flightNumber.uppercased().filter { !$0.isWhitespace } ?? ""
                return !booking.flightNumber.isEmpty && number == booking.flightNumber.uppercased()
            case .stay:
                return !booking.title.isEmpty && item.title.lowercased() == booking.title.lowercased()
            default: return false
            }
        }
    }

    static func read(_ text: String, defaultYear: Int? = nil) -> [ImportedBooking] {
        let year = defaultYear ?? Calendar.current.component(.year, from: .now)
        let dates = findDates(in: text, year: year)
        let code = confirmationCode(in: text)
        let price = findPrice(in: text)

        var found = flights(in: text, dates: dates)
        if found.isEmpty, let stay = stay(in: text, dates: dates) { found = [stay] }
        for i in found.indices where found[i].confirmation.isEmpty { found[i].confirmation = code ?? "" }
        if !found.isEmpty, let price {
            found[0].price = price.amount
            found[0].currency = price.currency
        }
        return found
    }

    // MARK: Flights

    private struct Hit { var range: NSRange; var groups: [String] }

    private static func matches(_ pattern: String, in text: String, options: NSRegularExpression.Options = []) -> [Hit] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return [] }
        let ns = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { m in
            Hit(range: m.range, groups: (0..<m.numberOfRanges).map { i in
                m.range(at: i).location == NSNotFound ? "" : ns.substring(with: m.range(at: i))
            })
        }
    }

    private static func flights(in text: String, dates: [(pos: Int, day: String)]) -> [ImportedBooking] {
        let ns = text as NSString
        // Only airline codes we know, so "A1 2024" or a seat like "12A" isn't a flight.
        let numbers = matches(#"\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{1,4})\b"#, in: text).filter {
            Airlines.name(forFlight: $0.groups[1] + $0.groups[2]) != nil
        }
        var seen = Set<String>()
        var out: [ImportedBooking] = []
        for (i, hit) in numbers.enumerated() {
            let number = hit.groups[1] + hit.groups[2]
            let end = i + 1 < numbers.count ? numbers[i + 1].range.location : ns.length
            let forward = ns.substring(with: NSRange(location: hit.range.location, length: end - hit.range.location))
            var booking = ImportedBooking()
            booking.flightNumber = number
            booking.day = day(near: hit.range.location, end: end, in: dates)
            let airports = matches(#"\b[A-Z]{3}\b"#, in: forward).map(\.groups[0]).filter { Airports.airport($0) != nil }
            var unique: [String] = []
            for code in airports where !unique.contains(code) { unique.append(code) }
            booking.from = unique.first ?? ""
            booking.to = unique.count > 1 ? unique[1] : ""
            let times = findTimes(in: forward)
            booking.time = times.first?.minutes
            if times.count > 1 {
                booking.arriveTime = times[1].minutes
                booking.arriveDayOffset = times[1].dayOffset
            }
            if let cabin = matches(#"(?i)\b(economy|premium economy|business|first)\b"#, in: forward).first?.groups[1] {
                booking.cabin = cabin.capitalized
            }
            if let seat = matches(#"(?i)\bseats?\s*:?\s*(\d{1,2}[A-K])\b"#, in: forward).first?.groups[1] { booking.seats = seat.uppercased() }
            let key = "\(number)|\(booking.day ?? "")"
            guard seen.insert(key).inserted else { continue }
            out.append(booking)
        }
        return out
    }

    /// The date just before the flight number (within a few lines), else the first one after it.
    private static func day(near pos: Int, end: Int, in dates: [(pos: Int, day: String)]) -> String? {
        if let before = dates.last(where: { $0.pos <= pos && pos - $0.pos < 220 }) { return before.day }
        return dates.first(where: { $0.pos > pos && $0.pos < end })?.day
    }

    // MARK: Stays

    private static func stay(in text: String, dates: [(pos: Int, day: String)]) -> ImportedBooking? {
        let checkIn = matches(#"(?i)check[- ]?in"#, in: text).first
        let checkOut = matches(#"(?i)check[- ]?out"#, in: text).first
        guard let checkIn, let checkOut else { return nil }
        var booking = ImportedBooking()
        booking.kind = .stay
        booking.day = dates.first(where: { $0.pos >= checkIn.range.location && $0.pos < checkIn.range.location + 90 })?.day
        booking.checkOutDay = dates.first(where: { $0.pos >= checkOut.range.location && $0.pos < checkOut.range.location + 90 })?.day
        if let out = booking.checkOutDay, let day = booking.day, out <= day { booking.checkOutDay = nil }
        let nameWords = #"(?i)\b(hotel|resort|inn|suites?|lodge|hostel|ryokan|airbnb|hyatt|marriott|hilton|ibis|sheraton|westin)\b"#
        let line = text.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }
            .first { !$0.isEmpty && $0.count <= 70 && !$0.lowercased().contains("check") && !matches(nameWords, in: $0).isEmpty }
        booking.title = line ?? "Hotel"
        if let time = findTimes(in: String(text[text.index(text.startIndex, offsetBy: min(checkIn.range.location, text.count))...].prefix(120))).first {
            booking.time = time.minutes
        }
        return booking
    }

    // MARK: Pieces

    private static let months = ["jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                                 "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12]
    private static let monthPattern = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"

    /// Every date in the text with where it sits, in text order. A date with no year takes `year`.
    static func findDates(in text: String, year: Int) -> [(pos: Int, day: String)] {
        var out: [(Int, String)] = []
        func add(_ pos: Int, _ y: Int, _ m: Int, _ d: Int) {
            guard (1...12).contains(m), (1...31).contains(d) else { return }
            out.append((pos, String(format: "%04d-%02d-%02d", y, m, d)))
        }
        for h in matches(#"\b(\d{4})-(\d{2})-(\d{2})\b"#, in: text) {
            add(h.range.location, Int(h.groups[1]) ?? year, Int(h.groups[2]) ?? 0, Int(h.groups[3]) ?? 0)
        }
        for h in matches(#"\b(\d{1,2})(?:st|nd|rd|th)?\s+(\#(monthPattern))[a-z]*\.?,?(?:\s+(\d{4}))?\b"#, in: text, options: .caseInsensitive) {
            add(h.range.location, Int(h.groups[3]) ?? year, months[h.groups[2].lowercased().prefix(3).description] ?? 0, Int(h.groups[1]) ?? 0)
        }
        for h in matches(#"\b(\#(monthPattern))[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b"#, in: text, options: .caseInsensitive) {
            add(h.range.location, Int(h.groups[3]) ?? year, months[h.groups[1].lowercased().prefix(3).description] ?? 0, Int(h.groups[2]) ?? 0)
        }
        return out.sorted { $0.0 < $1.0 }
    }

    /// 9:30, 9:30 PM, 21:05, with an optional "+1" for next-day arrival.
    static func findTimes(in text: String) -> [(minutes: Int, dayOffset: Int)] {
        matches(#"\b(\d{1,2}):(\d{2})\s?(AM|PM|am|pm)?(?:\s?\+(\d))?"#, in: text).compactMap { h in
            guard var hour = Int(h.groups[1]), let minute = Int(h.groups[2]), minute < 60 else { return nil }
            let ampm = h.groups[3].lowercased()
            if ampm == "pm", hour < 12 { hour += 12 }
            if ampm == "am", hour == 12 { hour = 0 }
            guard hour < 24 else { return nil }
            return (hour * 60 + minute, Int(h.groups[4]) ?? 0)
        }
    }

    /// "Confirmation code: ABC123", "Booking reference XY7K2P", "Record locator ...".
    static func confirmationCode(in text: String) -> String? {
        let pattern = #"(?i:confirmation|booking|reservation|record locator|pnr|reference|itinerary)(?i:\s*(?:code|number|no\.?|#|ref(?:erence)?|id))?\s*[:#]?\s*([A-Z0-9]{5,10})\b"#
        for h in matches(pattern, in: text) {
            let code = h.groups[1]
            // Needs a digit, or to be all letters of a real PNR length; skips words like "CONFIRMED".
            if code.contains(where: \.isNumber) || (code.count == 6 && code.allSatisfy(\.isLetter)) { return code }
        }
        return nil
    }

    static func findPrice(in text: String) -> (amount: Double, currency: String?)? {
        let codes = "USD|EUR|GBP|JPY|HKD|CNY|CAD|AUD|SGD|KRW|THB|NZD|CHF|MXN"
        let pattern = #"(?i)\b(?:grand total|total price|total amount|total|amount paid|amount|price|paid)\b[:\s.\-–]{0,24}(\#(codes)|[$€£¥])?\s?(\d[\d,]*(?:\.\d{1,2})?)\s?(\#(codes))?"#
        guard let h = matches(pattern, in: text).first(where: { Double($0.groups[2].replacingOccurrences(of: ",", with: "")) != nil }) else { return nil }
        let amount = Double(h.groups[2].replacingOccurrences(of: ",", with: "")) ?? 0
        let raw = [h.groups[1], h.groups[3]].first { !$0.isEmpty }
        let symbols = ["$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"]
        return (amount, raw.map { symbols[$0] ?? $0.uppercased() })
    }
}
