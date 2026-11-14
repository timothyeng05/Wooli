import Foundation

/// A booking found in pasted confirmation text (M2-3). Every field is optional:
/// the review sheet shows what was found and the user fills in the rest.
struct ParsedBooking: Equatable {
    var flightNumber: String?
    /// IATA codes.
    var from: String?
    var to: String?
    /// "yyyy-MM-dd".
    var day: String?
    /// Minutes after midnight.
    var departMinutes: Int?
    var confirmation: String?
    var amount: Double?
    var currency: String?
}

/// The no-Apple-Intelligence reader for a confirmation email or PDF's text:
/// flight numbers, airport codes, a date, a time, a booking code and a total.
/// Pure and on-device. Flights are split by flight number; the booking code
/// and total are shared by every flight found in the text.
enum ConfirmationParser {
    static func parse(_ text: String, referenceYear: Int = Calendar.current.component(.year, from: .now),
                      isAirport: (String) -> Bool = { Airports.airport($0) != nil }) -> [ParsedBooking] {
        let code = confirmationCode(in: text)
        let total = total(in: text)
        let flights = matches(#"\b([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{2,4})\b"#, in: text)
            .filter { airlineLooksReal($0.groups[0]) }
        guard !flights.isEmpty else { return [] }

        var found: [ParsedBooking] = []
        let ns = text as NSString
        for (i, flight) in flights.enumerated() {
            let end = i + 1 < flights.count ? flights[i + 1].range.location : ns.length
            let segment = ns.substring(with: NSRange(location: flight.range.location, length: end - flight.range.location))
            var booking = ParsedBooking()
            booking.flightNumber = flight.groups[0] + flight.groups[1]
            let airports = airportCodes(in: segment, isAirport: isAirport)
            booking.from = airports.first
            booking.to = airports.dropFirst().first
            booking.day = day(in: segment, referenceYear: referenceYear)
            booking.departMinutes = minutes(in: segment)
            booking.confirmation = code
            booking.amount = total?.amount
            booking.currency = total?.currency
            found.append(booking)
        }
        return found
    }

    // MARK: Pieces

    /// "Confirmation: ABC123", "Booking reference NUMBER ABC123", "PNR XY7K2M".
    static func confirmationCode(in text: String) -> String? {
        let pattern = #"(?i:confirmation|booking|reservation|reference|record locator|pnr)(?:\s*(?i:number|code|no\.?|#|id))?\s*[:#]?\s*([A-Z0-9]{5,8})\b"#
        return matches(pattern, in: text).first { m in
            let c = m.groups[0]
            // A real code mixes in a digit or is six letters; plain words ("NUMBER") aren't.
            return c.contains { $0.isNumber } || c.count == 6
        }?.groups[0]
    }

    /// Airport codes in order of appearance: three capitals that are real airports.
    static func airportCodes(in text: String, isAirport: (String) -> Bool) -> [String] {
        var seen: [String] = []
        for m in matches(#"\b([A-Z]{3})\b"#, in: text) where isAirport(m.groups[0]) && !seen.contains(m.groups[0]) {
            seen.append(m.groups[0])
        }
        return seen
    }

    private static let months = ["jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                                 "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12]

    /// "2027-04-09", "Apr 9, 2027", "9 April 2027", "Fri, Apr 9" (year from `referenceYear`).
    static func day(in text: String, referenceYear: Int) -> String? {
        if let m = matches(#"\b(\d{4})-(\d{2})-(\d{2})\b"#, in: text).first {
            return "\(m.groups[0])-\(m.groups[1])-\(m.groups[2])"
        }
        let name = #"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?"#
        if let m = matches(#"(?i)\b"# + name + #"\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b"#, in: text).first {
            return key(month: m.groups[0], day: m.groups[1], year: m.groups.count > 2 ? m.groups[2] : "", ref: referenceYear)
        }
        if let m = matches(#"(?i)\b(\d{1,2})(?:st|nd|rd|th)?\s+"# + name + #"(?:,?\s+(\d{4}))?\b"#, in: text).first {
            return key(month: m.groups[1], day: m.groups[0], year: m.groups.count > 2 ? m.groups[2] : "", ref: referenceYear)
        }
        return nil
    }

    private static func key(month: String, day: String, year: String, ref: Int) -> String? {
        guard let mo = months[month.prefix(3).lowercased()], let d = Int(day), (1...31).contains(d) else { return nil }
        return String(format: "%04d-%02d-%02d", Int(year) ?? ref, mo, d)
    }

    /// The first clock time: "7:45 PM", "19:45".
    static func minutes(in text: String) -> Int? {
        guard let m = matches(#"(?i)\b(\d{1,2}):(\d{2})\s?(AM|PM)?\b"#, in: text).first,
              var h = Int(m.groups[0]), let min = Int(m.groups[1]), min < 60 else { return nil }
        let ampm = m.groups.count > 2 ? m.groups[2].uppercased() : ""
        if ampm == "PM", h < 12 { h += 12 }
        if ampm == "AM", h == 12 { h = 0 }
        return h < 24 ? h * 60 + min : nil
    }

    /// The amount after the word "total" ("Total: USD 1,284.50", "Total paid $420").
    static func total(in text: String) -> (amount: Double, currency: String)? {
        let money = #"(USD|EUR|GBP|JPY|HKD|CNY|KRW|TWD|SGD|THB|CAD|AUD|MXN|CHF|\$|€|£|¥)\s?([\d,]+(?:\.\d{1,2})?)"#
        let after = #"(?i)total[^\d\n$€£¥]{0,30}"#
        let patterns = [after + money, after + #"([\d,]+(?:\.\d{1,2})?)\s?(USD|EUR|GBP|JPY|HKD|CNY|KRW|TWD|SGD|THB|CAD|AUD|MXN|CHF)"#]
        for (i, p) in patterns.enumerated() {
            guard let m = matches(p, in: text).first else { continue }
            let symbol = i == 0 ? m.groups[0] : m.groups[1]
            let number = i == 0 ? m.groups[1] : m.groups[0]
            guard let amount = Double(number.replacingOccurrences(of: ",", with: "")) else { continue }
            let codes = ["$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"]
            return (amount, codes[symbol] ?? symbol)
        }
        return nil
    }

    /// Two letters followed by digits is also a seat ("12A"), a gate or a state.
    /// A flight number's airline part can't be a month, a day word or a common stopword.
    private static func airlineLooksReal(_ airline: String) -> Bool {
        !["PM", "AM", "NO", "ID", "AT", "TO", "ON", "OF", "IN", "US", "UK"].contains(airline)
    }

    // MARK: Regex helper

    private struct Match { var range: NSRange; var groups: [String] }

    private static func matches(_ pattern: String, in text: String) -> [Match] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        let ns = text as NSString
        return re.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { m in
            Match(range: m.range, groups: (1..<m.numberOfRanges).map { i in
                m.range(at: i).location == NSNotFound ? "" : ns.substring(with: m.range(at: i))
            })
        }
    }
}
