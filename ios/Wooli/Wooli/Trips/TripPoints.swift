import Foundation

/// Loyalty programs a booking can be paid from. Stored on `TripItem` as the
/// program's name, so a program that isn't listed can be typed in.
enum PointsProgram {
    struct Program: Hashable {
        let name: String
        /// What a total says: "238,000 Asia Miles", "46,500 Hyatt points".
        let unit: String
    }

    static let known: [Program] = [
        Program(name: "World of Hyatt", unit: "Hyatt points"),
        Program(name: "Marriott Bonvoy", unit: "Bonvoy points"),
        Program(name: "Hilton Honors", unit: "Hilton points"),
        Program(name: "IHG One Rewards", unit: "IHG points"),
        Program(name: "Asia Miles", unit: "Asia Miles"),
        Program(name: "AAdvantage", unit: "AAdvantage miles"),
        Program(name: "United MileagePlus", unit: "United miles"),
        Program(name: "Delta SkyMiles", unit: "SkyMiles"),
        Program(name: "Avios", unit: "Avios"),
        Program(name: "Chase Ultimate Rewards", unit: "Chase points"),
        Program(name: "Amex Membership Rewards", unit: "Amex points"),
        Program(name: "Capital One Miles", unit: "Capital One miles"),
        Program(name: "Citi ThankYou", unit: "ThankYou points"),
    ]

    /// Typed-in names are kept as they are ("Krisflyer miles").
    static func unit(for name: String) -> String {
        known.first { $0.name == name }?.unit ?? (name.isEmpty ? "points" : name)
    }

    static func text(_ amount: Double, _ program: String) -> String {
        "\(amount.formatted(.number.precision(.fractionLength(0)))) \(unit(for: program))"
    }
}

extension TripItem {
    /// The program `points` came from; "" when none was picked.
    var programName: String { pointsProgram ?? "" }

    /// "7,500 Hyatt points".
    var pointsText: String? { points.map { PointsProgram.text($0, programName) } }

    /// Cash and points together: "HKD 3,564 + 238,000 Asia Miles".
    var priceText: String? {
        let parts = [costText, pointsText].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " + ")
    }
}

/// What you'd say a point is worth, per program, in cents of your own
/// currency. Kept on this device only: it's your own valuation, not trip data.
enum PointValues {
    static let key = "trip.pointValues"

    static var all: [String: Double] {
        get { UserDefaults.standard.dictionary(forKey: key) as? [String: Double] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }

    /// The points' worth in your own currency, from the programs you've
    /// valued; nil when none of them has a value.
    static func estimate(_ points: [String: Double], values: [String: Double] = all) -> Double? {
        let valued = points.compactMap { program, amount in values[program].map { amount * $0 / 100 } }
        return valued.isEmpty ? nil : valued.reduce(0, +)
    }
}

extension TripCosts {
    /// "$1,240 + ¥86,000 + 238,000 Asia Miles": cash first, then points by program.
    static func text(_ totals: [String: Double], points: [String: Double]) -> String {
        let cash = totals.isEmpty ? [] : [text(totals)]
        let miles = points.sorted { $0.key < $1.key }.map { PointsProgram.text($0.value, $0.key) }
        return (cash + miles).joined(separator: " + ")
    }
}
