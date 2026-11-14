import Foundation
import MapKit
import Observation
import OSLog

/// Looks up travel times between two places with Apple's directions (M3-2).
/// Each pair and mode is asked once: answers are kept on disk, so reopening a trip
/// makes no requests. Requests go one at a time with a short gap, and a failure
/// (offline, no route) falls back to the straight-line distance and isn't retried
/// until the app is next launched.
@MainActor @Observable
final class TravelEstimator {
    static let shared = TravelEstimator()

    @ObservationIgnored private let log = Logger(subsystem: "com.timothyeng.wooli", category: "TravelEstimator")
    private var cache: [String: TravelEstimate]
    /// Pairs that failed this launch, so scrolling doesn't keep asking.
    @ObservationIgnored private var failed = Set<String>()
    @ObservationIgnored private var inFlight: [String: Task<TravelEstimate, Never>] = [:]
    /// The one request at a time, so a long trip doesn't fire dozens at once.
    @ObservationIgnored private var queue: Task<Void, Never> = Task {}

    private static var fileURL: URL {
        URL.applicationSupportDirectory.appending(path: "travel-times.json")
    }

    private init() {
        cache = (try? JSONDecoder().decode([String: TravelEstimate].self, from: Data(contentsOf: Self.fileURL))) ?? [:]
    }

    /// What's already known for this hop, without asking anyone.
    func cached(from: TripPlace, to: TripPlace, mode: TravelMode) -> TravelEstimate? {
        cache[TravelTime.cacheKey(from: from, to: to, mode: mode)]
    }

    /// Whatever is already known for this hop: the mode you picked for it, else any mode that's cached.
    /// Reads the cache only, so a day header can total a day without causing requests.
    func known(from: TripPlace, to: TripPlace) -> TravelEstimate? {
        let picked = UserDefaults.standard.string(forKey: TravelConnectorRow.defaultsKey(from: from, to: to)).flatMap(TravelMode.init(rawValue:))
        if let picked, let hit = cached(from: from, to: to, mode: picked) { return hit }
        return TravelMode.allCases.lazy.compactMap { self.cached(from: from, to: to, mode: $0) }.first
    }

    /// The estimate for a hop in `mode` (nil = choose by distance). Always returns something.
    func estimate(from: TripPlace, to: TripPlace, mode: TravelMode? = nil) async -> TravelEstimate {
        let km = TravelTime.km(from: from, to: to)
        let chosen = mode ?? TravelTime.defaultMode(km: km, transitAvailable: true)
        let key = TravelTime.cacheKey(from: from, to: to, mode: chosen)
        if let hit = cache[key] { return hit }
        if failed.contains(key) { return TravelTime.fallback(from: from, to: to) }
        if let running = inFlight[key] { return await running.value }

        let previous = queue
        let task = Task<TravelEstimate, Never> { [weak self] in
            await previous.value
            guard let self else { return TravelTime.fallback(from: from, to: to) }
            let result = await self.ask(from: from, to: to, mode: chosen, km: km, key: key)
            // A short gap between requests keeps us under Apple's rate limit.
            try? await Task.sleep(for: .milliseconds(250))
            return result
        }
        queue = Task { _ = await task.value }
        inFlight[key] = task
        let result = await task.value
        inFlight[key] = nil
        return result
    }

    private func ask(from: TripPlace, to: TripPlace, mode: TravelMode, km: Double, key: String) async -> TravelEstimate {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: .init(latitude: from.latitude, longitude: from.longitude)))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: .init(latitude: to.latitude, longitude: to.longitude)))
        switch mode {
        case .walk: request.transportType = .walking
        case .transit: request.transportType = .transit
        case .drive: request.transportType = .automobile
        }
        do {
            let eta = try await MKDirections(request: request).calculateETA()
            let estimate = TravelEstimate(mode: mode, minutes: max(Int((eta.expectedTravelTime / 60).rounded()), 1), km: km)
            cache[key] = estimate
            save()
            return estimate
        } catch {
            // Transit isn't everywhere: try driving once before giving up.
            if mode == .transit {
                let driving = await ask(from: from, to: to, mode: .drive, km: km, key: TravelTime.cacheKey(from: from, to: to, mode: .drive))
                if driving.minutes != nil { cache[key] = driving; save(); return driving }
            }
            log.info("No directions for \(key): \(error.localizedDescription)")
            failed.insert(key)
            return TravelTime.fallback(from: from, to: to)
        }
    }

    private func save() {
        do {
            try FileManager.default.createDirectory(at: URL.applicationSupportDirectory, withIntermediateDirectories: true)
            try JSONEncoder().encode(cache).write(to: Self.fileURL, options: .atomic)
        } catch {
            log.error("Couldn't save travel times: \(error.localizedDescription)")
        }
    }
}
