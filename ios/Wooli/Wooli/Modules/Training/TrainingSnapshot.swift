import Foundation

// The files written by the user's own garmin-mcp snapshot job
// (`~/Library/Application Support/garmin-mcp/latest.json` and `snapshots/YYYY-MM-DD.json`).
// Wooli only reads them. Nothing here is saved to SwiftData or synced to iCloud:
// App Store guideline 5.1.3(ii) keeps personal health data out of iCloud.

struct TrainingRecord: Decodable {
    let snapshot: TrainingSnapshot
    let insights: TrainingInsights
}

struct TrainingSnapshot: Decodable {
    let date: String
    let lastSynced: String?
    let today: Markers
    let activities: [Activity]?

    struct Activity: Decodable, Identifiable {
        let id: Int
        let date: String
        let start: String?
        let name: String?
        let sport: String?
        let durationMinutes: Double?
        let distanceKm: Double?
        let avgHeartRate: Double?
    }

    struct Markers: Decodable {
        let sleep: Sleep?
        let bodyBattery: BodyBattery?
        let hrv: HRV?
        let restingHeartRate: Double?
        let stress: Stress?
    }
    struct Sleep: Decodable { let sleepScore: Int?; let sleepDurationHours: Double?; let deepSleepMinutes: Double?; let remSleepMinutes: Double? }
    struct BodyBattery: Decodable { let charged: Int?; let drained: Int?; let mostRecent: Int? }
    struct HRV: Decodable { let lastNightAvg: Int?; let baselineLow: Int?; let baselineHigh: Int?; let status: String? }
    struct Stress: Decodable { let avg: Int? }
}

struct TrainingInsights: Decodable {
    let date: String
    let location: String
    let raining: Bool?
    let readiness: String
    let checks: [String: Check]
    let today: Session
    let week: Week
    let heatmap: [HeatDay]
    let race: Race?

    struct Check: Decodable { let value: Double?; let target: Double?; let met: Bool? }
    struct Session: Decodable {
        let label: String?
        let window: [String]?
        let minutes: Int?
        let notes: [String]
        let intensity: String?
    }
    struct Week: Decodable {
        let sessions: Int
        let bySport: [String: SportTotal]
        let zone2Minutes: Double
        let easySharePct: Int?
        let easyShareTarget: Int
    }
    struct SportTotal: Decodable { let sessions: Int; let minutes: Double; let km: Double }
    struct HeatDay: Decodable, Identifiable {
        let date: String
        let minutes: Int
        let sports: [String]
        var id: String { date }
    }
    struct Race: Decodable { let name: String; let date: String?; let month: String?; let days: Int?; let months: Int?; let dateTBA: Bool? }
}

extension TrainingInsights {
    /// Today's call, in words and a symbol.
    var verdict: (title: String, symbol: String) {
        switch readiness {
        case "ready": ("Ready to train", "checkmark.seal.fill")
        case "easy": ("Go easy today", "tortoise.fill")
        case "recover": ("Recovery day", "bed.double.fill")
        default: ("Not enough data yet", "questionmark.circle")
        }
    }

    /// Today's session: "Run · 07:00–08:00 · 45 min", or rest.
    var sessionLine: String {
        guard let label = today.label else { return "Rest / mobility" }
        guard let w = today.window, w.count == 2 else { return label }
        let mins = today.minutes.map { " · \($0) min" } ?? ""
        return "\(label) · \(w[0])–\(w[1])\(mins)"
    }

    /// Share of recovery checks that met their target (0–1), for the Today ring.
    var recoveryShare: Double {
        let known = checks.values.compactMap(\.met)
        guard !known.isEmpty else { return 0 }
        return Double(known.filter { $0 }.count) / Double(known.count)
    }
}

/// A saved GPS route (`tracks/<activity id>.json`): [lat, lon] pairs.
struct TrainingRoute: Decodable {
    let activityId: Int
    let points: [[Double]]
}

/// One night from an older snapshot, for the trend lines.
struct TrainingTrendPoint: Identifiable {
    let date: Date
    let sleepHours: Double?
    let sleepScore: Int?
    let restingHR: Double?
    let hrv: Int?
    var id: Date { date }
}

#if os(macOS)
import AppKit
import CoreLocation

/// Finds and reads the snapshot folder. Mac only: the folder is chosen once in an open panel
/// and remembered as a security-scoped bookmark in local UserDefaults (never synced).
@MainActor @Observable
final class TrainingFolder {
    static let shared = TrainingFolder()

    enum State { case needsFolder, loaded(TrainingRecord, [TrainingTrendPoint]), failed(String) }
    private(set) var state: State = .needsFolder
    /// GPS routes by activity id, from `tracks/`. Activities without GPS aren't in here.
    private(set) var routes: [Int: [CLLocationCoordinate2D]] = [:]

    private let bookmarkKey = "training.snapshotFolderBookmark"

    /// The real home folder (the sandbox's `homeDirectoryForCurrentUser` points into the container).
    private var realHome: URL {
        if let pw = getpwuid(getuid()), let dir = pw.pointee.pw_dir {
            return URL(fileURLWithPath: String(cString: dir))
        }
        return FileManager.default.homeDirectoryForCurrentUser
    }

    var hasFolder: Bool { UserDefaults.standard.data(forKey: bookmarkKey) != nil }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.showsHiddenFiles = true
        panel.prompt = "Use this folder"
        panel.message = "Choose the garmin-mcp folder (usually Library › Application Support › garmin-mcp)."
        panel.directoryURL = realHome.appending(path: "Library/Application Support/garmin-mcp")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let data = try url.bookmarkData(options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess])
            UserDefaults.standard.set(data, forKey: bookmarkKey)
            reload()
        } catch {
            state = .failed("Wooli couldn't remember that folder: \(error.localizedDescription)")
        }
    }

    func forgetFolder() {
        UserDefaults.standard.removeObject(forKey: bookmarkKey)
        state = .needsFolder
    }

    func reload() {
        guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { state = .needsFolder; return }
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: data, options: .withSecurityScope, bookmarkDataIsStale: &stale) else {
            state = .needsFolder; return
        }
        guard url.startAccessingSecurityScopedResource() else { state = .failed("Wooli can't open that folder any more. Choose it again."); return }
        defer { url.stopAccessingSecurityScopedResource() }
        if stale, let fresh = try? url.bookmarkData(options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess]) {
            UserDefaults.standard.set(fresh, forKey: bookmarkKey)
        }
        do {
            let latest = try Data(contentsOf: url.appending(path: "latest.json"))
            let record = try JSONDecoder().decode(TrainingRecord.self, from: latest)
            routes = Self.routes(in: url.appending(path: "tracks"), for: record.snapshot.activities ?? [])
            state = .loaded(record, Self.trend(in: url.appending(path: "snapshots")))
        } catch CocoaError.fileReadNoSuchFile {
            state = .failed("No latest.json in that folder yet. Run the garmin-mcp snapshot job once, then refresh.")
        } catch {
            state = .failed("Wooli couldn't read latest.json: \(error.localizedDescription)")
        }
    }

    private static func routes(in folder: URL, for activities: [TrainingSnapshot.Activity]) -> [Int: [CLLocationCoordinate2D]] {
        var out: [Int: [CLLocationCoordinate2D]] = [:]
        for a in activities {
            guard let data = try? Data(contentsOf: folder.appending(path: "\(a.id).json")),
                  let route = try? JSONDecoder().decode(TrainingRoute.self, from: data) else { continue }
            let coords = route.points.compactMap { $0.count == 2 ? CLLocationCoordinate2D(latitude: $0[0], longitude: $0[1]) : nil }
            if coords.count > 1 { out[a.id] = coords }
        }
        return out
    }

    private static func trend(in folder: URL, days: Int = 30) -> [TrainingTrendPoint] {
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        let day = DateFormatter.trainingDay
        return files
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .suffix(days)
            .compactMap { file -> TrainingTrendPoint? in
                guard let data = try? Data(contentsOf: file),
                      let rec = try? JSONDecoder().decode(TrainingRecord.self, from: data),
                      let date = day.date(from: rec.snapshot.date) else { return nil }
                let t = rec.snapshot.today
                return TrainingTrendPoint(date: date, sleepHours: t.sleep?.sleepDurationHours, sleepScore: t.sleep?.sleepScore,
                                          restingHR: t.restingHeartRate, hrv: t.hrv?.lastNightAvg)
            }
    }
}
#endif

extension DateFormatter {
    static let trainingDay: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
