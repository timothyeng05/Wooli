import Foundation
import UserNotifications

/// A local nudge to clear the review queue: scheduled for 9am the next day
/// whenever the app backgrounds with transactions still waiting, cancelled
/// if the queue is already empty by the next time that happens. No server,
/// no background refresh — just whatever the count already was when you
/// left the app.
enum ReviewReminder {
    private static let identifier = "review-reminder"
    static let enabledKey = "reviewRemindersEnabled"

    static var isEnabled: Bool {
        UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true
    }

    /// Call whenever the app backgrounds.
    static func scheduleOrCancel(reviewCount: Int) {
        let center = UNUserNotificationCenter.current()
        guard isEnabled, reviewCount > 0 else {
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            return
        }
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            center.add(request(for: reviewCount))
        }
    }

    private static func request(for reviewCount: Int) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = "Transactions to review"
        content.body = reviewCount == 1 ? "1 transaction is waiting for a category."
                                         : "\(reviewCount) transactions are waiting for a category."
        content.sound = .default

        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: .now))!
        var components = cal.dateComponents([.year, .month, .day], from: tomorrow)
        components.hour = 9
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        return UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
    }
}
