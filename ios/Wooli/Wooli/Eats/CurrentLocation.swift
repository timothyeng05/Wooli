import CoreLocation
import Foundation
import Observation

/// Where you are right now, asked for only when you sort by distance. One
/// fix at a time, kept in memory: it's never saved or synced.
@MainActor @Observable
final class CurrentLocation: NSObject {
    enum Status { case idle, locating, denied, failed }

    private(set) var location: CLLocation?
    private(set) var status = Status.idle

    private let manager = CLLocationManager()
    /// The manager reports its authorization as soon as it's made; that
    /// mustn't fetch a location nobody asked for.
    private var wanted = false

    override init() {
        super.init()
        manager.delegate = self
        // Block-level is plenty for "0.4 mi", and works with approximate location.
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func refresh() {
        wanted = true
        update()
    }

    private func update() {
        guard wanted else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            status = .locating
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            status = .locating
            manager.requestLocation()
        default:
            status = .denied
        }
    }
}

extension CurrentLocation: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in self.update() }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        Task { @MainActor in
            self.location = latest
            self.status = .idle
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            // An older fix still sorts the list; only say so when there's none.
            self.status = self.location == nil ? .failed : .idle
        }
    }
}

extension EatsPlace {
    /// Metres from there; nil for places without a pin.
    func distance(from location: CLLocation) -> CLLocationDistance? {
        guard let latitude, let longitude else { return nil }
        return location.distance(from: CLLocation(latitude: latitude, longitude: longitude))
    }

    /// "0.4 mi" or "650 m", in the units of your region.
    func distanceText(from location: CLLocation) -> String? {
        distance(from: location).map {
            Measurement(value: $0, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated, usage: .road))
        }
    }
}
