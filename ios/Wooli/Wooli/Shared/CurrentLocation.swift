import CoreLocation

/// Where the phone is right now, once, for "Near me" in Eats. Asks for
/// When In Use permission the first time; nil if it's refused or unavailable.
/// The location stays on the phone.
enum CurrentLocation {
    static func fetch() async -> CLLocation? {
        #if os(iOS)
        // Holding a session is what asks for permission (iOS 18+).
        let session = CLServiceSession(authorization: .whenInUse)
        defer { session.invalidate() }
        #endif
        do {
            for try await update in CLLocationUpdate.liveUpdates() {
                if let location = update.location { return location }
                if update.authorizationDenied || update.authorizationDeniedGlobally || update.authorizationRestricted { return nil }
            }
        } catch {}
        return nil
    }
}
