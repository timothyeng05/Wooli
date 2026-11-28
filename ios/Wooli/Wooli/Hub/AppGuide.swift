import SwiftUI

/// A few quick pointers shown the first time someone opens each app — the
/// gestures and entry points that aren't obvious from the screen itself.
/// Seen state is per app (`guide.<id>.seen`); Settings → Apps can reset it.
struct AppGuide {
    struct Tip: Identifiable {
        let symbol: String
        let title: String
        let detail: String
        var id: String { title }
    }

    let space: AppSpace
    let tips: [Tip]

    init(_ space: AppSpace) {
        self.space = space
        tips = Self.tips(for: space)
    }

    /// A guide with its own tips, for a screen inside an app (the Mac trip workspace).
    init(_ space: AppSpace, tips: [Tip]) {
        self.space = space
        self.tips = tips
    }

    /// Shown the first time a trip opens on the Mac: where to type, the map, and Invite.
    static let tripWorkspace = AppGuide(.trips, tips: [
        Tip(symbol: "text.cursor", title: "Type a place, press Return",
            detail: "The field at the bottom adds plans. Try \"Lunch at Casa Lucio 2pm\" or \"hotel Seville\"; Wooli finds the place."),
        Tip(symbol: "map", title: "The map follows you",
            detail: "Select a plan or a day to see it on the map. ⇧⌘M hides it, ⌥⌘I opens the inspector."),
        Tip(symbol: "person.crop.circle.badge.plus", title: "Plan together",
            detail: "Invite in the toolbar shares the trip. They join with their own Apple Account and edit with you."),
    ])

    private static func tips(for space: AppSpace) -> [Tip] {
        switch space {
        case .today: [
            Tip(symbol: "square.stack", title: "Your apps at a glance",
                detail: "Each card shows the latest from one app. Tap a card to open it."),
            Tip(symbol: "line.3.horizontal", title: "Switch apps",
                detail: "Tap ☰ or swipe in from the left edge to jump between apps."),
            Tip(symbol: "slider.horizontal.3", title: "Make it yours",
                detail: "Tap the sliders button to reorder or hide cards, or long-press any card."),
        ]
        case .budget: [
            Tip(symbol: "checkmark.circle", title: "Review what's new",
                detail: "The badge on Transactions counts ones to check. Confirm each, or fix its category in a tap."),
            Tip(symbol: "wand.and.stars", title: "Teach it once",
                detail: "When you change a category, make it a rule — that merchant sorts itself from then on."),
            Tip(symbol: "map", title: "Plan the month",
                detail: "The Budget tab sets how much goes to each group. Dashboard shows how you're pacing."),
            Tip(symbol: "line.3.horizontal", title: "More in ☰",
                detail: "Categories, Rules, Recurring and Settings live in the menu."),
        ]
        case .trips: [
            Tip(symbol: "plus", title: "Start a trip",
                detail: "Tap + and add the dates, then each city you're visiting."),
            Tip(symbol: "lightbulb", title: "Ideas, then days",
                detail: "Save places as ideas first. Long-press one to move it onto a day."),
            Tip(symbol: "square.and.arrow.up", title: "Share places in",
                detail: "Share a place from Apple Maps or an Instagram reel to Wooli to add it to a trip."),
            Tip(symbol: "person.crop.circle.badge.plus", title: "Plan together",
                detail: "Tap Invite on a trip. They join with their own Apple Account and edit with you."),
        ]
        case .eats: [
            Tip(symbol: "plus", title: "Add a place you've been",
                detail: "Pick how it felt, then answer \"which was better?\" a few times. Wooli works out the score."),
            Tip(symbol: "bookmark", title: "Want to Try",
                detail: "Share a place from Apple Maps or a food reel from Instagram to Wooli to save it."),
            Tip(symbol: "airplane", title: "Trip meals",
                detail: "Meals from your trips show up here, ready to rank or skip."),
            Tip(symbol: "person.2", title: "Friends and partner",
                detail: "Share your list to see each other's scores. ♥ Partner makes one list you both edit."),
        ]
        case .sights: [
            Tip(symbol: "plus", title: "Save a place",
                detail: "Tap + and search Apple Maps for a landmark, museum, park or viewpoint."),
            Tip(symbol: "square.and.arrow.up", title: "Share from Maps",
                detail: "Share a place from Apple Maps to Wooli and choose Save to Sights."),
            Tip(symbol: "checkmark.circle", title: "Been there?",
                detail: "Swipe a place right to move it from Want to go to Been, or open it to set the day."),
            Tip(symbol: "airplane", title: "Plan a trip around it",
                detail: "Open a place and tap Add to a trip's Ideas. Trips show the sights saved for each city."),
        ]
        case .movies: [
            Tip(symbol: "magnifyingglass", title: "Add a movie",
                detail: "Tap + and search by title."),
            Tip(symbol: "arrow.left.arrow.right", title: "Rank by comparing",
                detail: "Answer \"which was better?\" a few times. Its spot sets its score."),
            Tip(symbol: "arrow.clockwise", title: "Changed your mind?",
                detail: "Open a movie to rank it again or add your own notes."),
        ]
        case .recipes: [
            Tip(symbol: "square.and.arrow.up", title: "Share a reel",
                detail: "In Instagram, tap Share → Wooli. The caption becomes ingredients and steps."),
            Tip(symbol: "pencil", title: "Check before saving",
                detail: "The recipe opens in an editor first, so you can fix anything that came out wrong."),
            Tip(symbol: "doc.on.clipboard", title: "From anywhere else",
                detail: "Tap +, paste the text, then Split into ingredients and steps."),
            Tip(symbol: "magnifyingglass", title: "Search by ingredient",
                detail: "Find what you can make with what's in the fridge."),
        ]
        case .period: [
            Tip(symbol: "plus", title: "Log your period",
                detail: "Tap + with the start date. Leave \"Still going\" on and end it later."),
            Tip(symbol: "calendar", title: "Predictions",
                detail: "Dashed days on the calendar are the next predicted period. They sharpen after a couple of cycles."),
            Tip(symbol: "faceid", title: "Private by default",
                detail: "It stays on this \(ThisDevice.name) and your iCloud. Turn on \(ThisDevice.biometry) in Settings → Apps."),
        ]
        }
    }

    private static func seenKey(_ space: AppSpace) -> String { "guide.\(space.rawValue).seen" }

    static let tripWorkspaceKey = "guide.tripWorkspace.seen"

    static func hasSeen(_ space: AppSpace) -> Bool { UserDefaults.standard.bool(forKey: seenKey(space)) }

    static func markSeen(_ space: AppSpace) { UserDefaults.standard.set(true, forKey: seenKey(space)) }

    static func resetAll() {
        UserDefaults.standard.removeObject(forKey: tripWorkspaceKey)
        for space in AppSpace.allCases { UserDefaults.standard.removeObject(forKey: seenKey(space)) }
    }
}

extension View {
    /// Shows `space`'s guide once, the first time this screen appears while
    /// `ready` is true.
    func appGuide(_ space: AppSpace, ready: Bool = true) -> some View {
        modifier(AppGuidePresenter(space: space, ready: ready))
    }
}

extension View {
    /// The trip workspace's three pointers, once, the first time any trip opens.
    func tripWorkspaceGuide() -> some View { modifier(TripGuidePresenter()) }
}

private struct TripGuidePresenter: ViewModifier {
    @AppStorage(AppGuide.tripWorkspaceKey) private var seen = false
    @State private var showing = false

    func body(content: Content) -> some View {
        content
            .task {
                guard !seen, !ProcessInfo.processInfo.arguments.contains("-skipGuides") else { return }
                try? await Task.sleep(for: .milliseconds(700))
                guard !Task.isCancelled else { return }
                showing = true
            }
            .sheet(isPresented: $showing, onDismiss: { seen = true }) {
                AppGuideSheet(guide: .tripWorkspace)
            }
    }
}

private struct AppGuidePresenter: ViewModifier {
    let space: AppSpace
    let ready: Bool
    @State private var showing = false

    func body(content: Content) -> some View {
        content
            .task(id: ready) {
                guard ready, !AppGuide.hasSeen(space), !Self.skipped else { return }
                // Let the app switch finish before the sheet slides up.
                try? await Task.sleep(for: .milliseconds(450))
                guard !Task.isCancelled else { return }
                showing = true
            }
            .sheet(isPresented: $showing, onDismiss: { AppGuide.markSeen(space) }) {
                AppGuideSheet(guide: AppGuide(space))
            }
    }

    /// `-skipGuides` keeps guides out of screenshots and UI checks.
    private static var skipped: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipGuides")
    }
}

/// The guide itself: the app's icon and pitch, its tips, one button.
/// Sized to its content so a three-tip guide isn't a near-empty full sheet.
struct AppGuideSheet: View {
    let guide: AppGuide
    @Environment(\.dismiss) private var dismiss
    @State private var height: CGFloat = 480

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 14) {
                AppIconTile(guide.space, size: 72)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Welcome to \(guide.space.title)")
                        .font(.title2.weight(.bold))
                    Text(guide.space.pitch)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            VStack(alignment: .leading, spacing: 18) {
                ForEach(guide.tips) { tip in
                    HStack(alignment: .top, spacing: 14) {
                        Image(systemName: tip.symbol)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(guide.space.tint)
                            .frame(width: 28, height: 28)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(tip.title).font(.body.weight(.semibold))
                            Text(tip.detail)
                                .font(.subheadline)
                                .foregroundStyle(Theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }

            Button {
                dismiss()
            } label: {
                Text("Got it")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(guide.space.tint)
            .controlSize(.large)
        }
        .padding(.horizontal, 24)
        .padding(.top, 30)
        .padding(.bottom, 12)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        .presentationDetents([.height(height)])
        .presentationDragIndicator(.visible)
    }
}
