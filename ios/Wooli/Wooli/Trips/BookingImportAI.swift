import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

// M2-3: Apple Intelligence reads a confirmation the patterns couldn't. On
// device only (the same pattern as `Recipes/RecipeImport.swift`); when the
// model isn't there, the sheet just says nothing was found.

enum BookingReader {
    /// Whether this Mac can read a confirmation with Apple Intelligence.
    static var modelAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(macOS 26.0, iOS 26.0, *) {
            if case .available = SystemLanguageModel.default.availability { return true }
        }
        #endif
        return false
    }

    /// The patterns first, since they never invent anything; the model only
    /// when they find no booking.
    static func read(_ text: String, defaultYear: Int?) async -> [ImportedBooking] {
        let found = BookingImport.read(text, defaultYear: defaultYear)
        guard found.isEmpty, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return found }
        #if canImport(FoundationModels)
        if #available(macOS 26.0, iOS 26.0, *), modelAvailable {
            let session = LanguageModelSession(instructions: """
                You read travel confirmation emails. List every flight, train and hotel stay in the text, \
                copying values exactly as written; leave a field empty when the text doesn't give it. \
                Dates must be yyyy-MM-dd (use \(defaultYear.map(String.init) ?? "the current year") when no year is written), \
                times 24-hour HH:mm, airports as three-letter codes. Never invent a booking.
                """)
            if let response = try? await session.respond(to: String(text.prefix(6000)), generating: ConfirmationBookings.self) {
                return response.content.bookings.compactMap { $0.imported() }
            }
        }
        #endif
        return found
    }
}

#if canImport(FoundationModels)
@available(macOS 26.0, iOS 26.0, *)
@Generable
private struct ConfirmationBookings {
    @Guide(description: "Every booking in the text; empty if there are none")
    var bookings: [FoundBooking]
}

@available(macOS 26.0, iOS 26.0, *)
@Generable
private struct FoundBooking {
    @Guide(description: "flight, train or stay", .anyOf(["flight", "train", "stay"]))
    var type: String
    @Guide(description: "Hotel name, or the train's route; empty for a flight")
    var title: String
    @Guide(description: "Flight number such as CX831; empty if not a flight")
    var flightNumber: String
    @Guide(description: "Departure airport three-letter code, or empty")
    var fromAirport: String
    @Guide(description: "Arrival airport three-letter code, or empty")
    var toAirport: String
    @Guide(description: "Departure or check-in date as yyyy-MM-dd, or empty")
    var date: String
    @Guide(description: "Departure or check-in time as HH:mm, or empty")
    var time: String
    @Guide(description: "Arrival time as HH:mm, or empty")
    var arriveTime: String
    @Guide(description: "Check-out date as yyyy-MM-dd for a stay, or empty")
    var checkOutDate: String
    @Guide(description: "Confirmation or booking reference, or empty")
    var confirmation: String
    @Guide(description: "Total price as a number without symbols, or 0 if not given")
    var price: Double
    @Guide(description: "Three-letter currency code, or empty")
    var currency: String

    func imported() -> ImportedBooking? {
        var b = ImportedBooking()
        b.kind = type == "stay" ? .stay : .transit
        b.mode = type == "train" ? .train : .flight
        b.title = title
        b.flightNumber = flightNumber.uppercased().filter { !$0.isWhitespace }
        b.from = fromAirport.uppercased()
        b.to = toAirport.uppercased()
        b.day = Self.day(date)
        b.time = Self.minutes(time)
        b.arriveTime = Self.minutes(arriveTime)
        b.checkOutDay = Self.day(checkOutDate)
        b.confirmation = confirmation
        b.price = price > 0 ? price : nil
        b.currency = currency.isEmpty ? nil : currency.uppercased()
        // A booking with nothing to identify it isn't worth a row.
        guard b.day != nil || !b.flightNumber.isEmpty || !b.title.isEmpty else { return nil }
        return b
    }

    private static func day(_ text: String) -> String? {
        text.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil ? text : nil
    }

    private static func minutes(_ text: String) -> Int? {
        let parts = text.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, parts[0] < 24, parts[1] < 60 else { return nil }
        return parts[0] * 60 + parts[1]
    }
}
#endif
