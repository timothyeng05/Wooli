import SwiftUI
import SwiftData

/// Shown first, before the welcome tour, only while there's no SimpleFIN
/// credential yet (otherwise AppModel already jumped straight to `.live`).
/// Gives CloudKit a few seconds to report any existing data from another
/// device on the same Apple ID, so a returning user on a new iPhone doesn't
/// get funneled through onboarding past data that's already on its way.
struct ICloudCheckView: View {
    private enum Phase { case checking, foundData, noData }

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var phase: Phase = .checking

    var body: some View {
        ZStack {
            Theme.gradient.ignoresSafeArea()
            VStack(spacing: 20) {
                switch phase {
                case .checking, .noData:
                    // .noData renders identically for the instant before the
                    // parent swaps to the welcome tour, so nothing flashes.
                    ProgressView()
                        .tint(.white)
                        .controlSize(.large)
                    Text("Checking iCloud for your data…")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.9))
                case .foundData:
                    Image(systemName: "icloud.fill")
                        .font(.system(size: 52))
                        .foregroundStyle(.white)
                    Text("We found your Wooli data in iCloud")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("Looks like you've used Wooli on another device with this Apple ID. Continue to pick up right where you left off.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                        .multilineTextAlignment(.center)
                    Button("Continue") {
                        app.mode = .live
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.white)
                    .foregroundStyle(Theme.brand)
                    .controlSize(.large)
                    .padding(.top, 8)
                }
            }
            .padding(32)
        }
        .task {
            // A relaunch after finding data (but before the user tapped
            // Continue) skips straight to the prompt — no re-wait needed.
            if app.onboardingStage == .foundExistingData {
                phase = .foundData
                return
            }
            let found = await CloudKitImportWatcher.checkForExistingData(context: context)
            if found {
                withAnimation { phase = .foundData }
            } else {
                phase = .noData
            }
            app.recordICloudCheckResult(found: found)
        }
    }
}

/// First-run screen — the web sign-in page's look: blue gradient, white card,
/// sheep logo, blue "Wooli" wordmark. A swipeable tour (one page per tab,
/// plus a peek at the starter categories) runs before the connect step, so
/// people can see what the app offers before they've connected anything.
struct WelcomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var lineup = AppLineup.shared
    @State private var page = 0
    @State private var showConnect = false
    @State private var showExplainer = false
    /// How Budget gets transactions; chosen on the last page.
    @State private var bankChoice: BankChoice?

    private enum BankChoice { case manual, simpleFIN }
    private enum Page: Hashable { case welcome, apps, dashboard, accounts, transactions, reports, budget, connect, ready }

    /// The Budget tour and bank connection only appear if Budget was picked.
    private var pages: [Page] {
        [.welcome, .apps] + (lineup.isEnabled(.budget)
            ? [.dashboard, .accounts, .transactions, .reports, .budget, .connect]
            : [.ready])
    }

    private var isLast: Bool { page >= pages.count - 1 }

    var body: some View {
        ZStack {
            Theme.gradient.ignoresSafeArea()
            VStack(spacing: 16) {
                // One page at a time, advanced only by the button: swiping
                // past a page would skip it, and the app picker needs taps.
                pageView(pages[min(page, pages.count - 1)])
                    .id(page)
                    .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .leading))
                        .combined(with: .opacity))
                    .frame(height: 420)
                    .clipped()

                HStack(spacing: 6) {
                    ForEach(pages.indices, id: \.self) { i in
                        Capsule()
                            .fill(i == page ? Color(hex: "#2563eb") : Color(hex: "#2563eb").opacity(0.2))
                            .frame(width: i == page ? 16 : 6, height: 6)
                    }
                }
                .animation(.default, value: page)

                // One button in a fixed spot: Continue through the tour, then
                // the same button finishes — the card keeps its height.
                Button {
                    if !isLast {
                        withAnimation { page += 1 }
                    } else if lineup.isEnabled(.budget) {
                        switch bankChoice {
                        case .simpleFIN: showConnect = true
                        case .manual: app.startWithoutBank(context: context)
                        case nil: break
                        }
                    } else {
                        app.startWithoutBank(context: context)
                    }
                } label: {
                    Text(finishTitle)
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .contentTransition(.opacity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(pages[min(page, pages.count - 1)] == .apps && lineup.installed.isEmpty
                          || isLast && lineup.isEnabled(.budget) && bankChoice == nil)
            }
            .padding(28)
            .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 24, y: 10)
            .frame(maxWidth: 460)
            .padding(20)
            .frame(maxWidth: .infinity, minHeight: 0)
            .containerRelativeFrame(.vertical, alignment: .center)
        }
        .environment(\.colorScheme, .light)
        .sheet(isPresented: $showConnect) {
            ConnectSheet()
        }
        .sheet(isPresented: $showExplainer) {
            SimpleFINExplainer()
        }
        #if DEBUG
        // `-onboardingPage N`: jump to a page (1 = app picker). `-simplefinExplainer`: open the deep dive.
        .task {
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-onboardingPage"), i + 1 < args.count, let n = Int(args[i + 1]) { page = n }
            if args.contains("-simplefinExplainer") { showExplainer = true }
        }
        #endif
    }

    private var finishTitle: String {
        if !isLast { return "Continue" }
        guard lineup.isEnabled(.budget) else { return "Start using Wooli" }
        switch bankChoice {
        case .manual: return "Start with manual entry"
        case .simpleFIN: return "Connect with SimpleFIN"
        case nil: return "Choose one to continue"
        }
    }

    @ViewBuilder
    private func pageView(_ page: Page) -> some View {
        switch page {
        case .welcome: welcomePage
        case .apps: appsPage
        case .dashboard:
            SimpleTourPage(symbol: "house", tint: Color(hex: "#2563eb"), title: "Dashboard",
                           detail: "See your net worth, this month's budget, and recent transactions at a glance.")
        case .accounts:
            SimpleTourPage(symbol: "square.stack.3d.up", tint: Color(hex: "#16a34a"), title: "Accounts",
                           detail: "Every account in one place — imported from your bank, or entered by you.")
        case .transactions:
            SimpleTourPage(symbol: "creditcard", tint: Color(hex: "#f97316"), title: "Transactions",
                           detail: "Search, filter, and fix any transaction's category in a couple of taps.")
        case .reports:
            SimpleTourPage(symbol: "chart.pie", tint: Color(hex: "#ec4899"), title: "Reports",
                           detail: "See where your money goes with spending breakdowns and trends over time.")
        case .budget: BudgetTourPage()
        case .connect: ctaPage
        case .ready: readyPage
        }
    }

    /// Pick apps and rank them. The order sets Today and the ☰ switcher.
    private var appsPage: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Make Wooli yours")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Color(hex: "#111827"))
            Text("Turn on the apps you'll use, then drag to put what matters most first.")
                .font(.subheadline)
                .foregroundStyle(Color(hex: "#6b7280"))
                .fixedSize(horizontal: false, vertical: true)
            List {
                AppLineupRows()
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 10, leading: 0, bottom: 10, trailing: 0))
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .scrollBounceBehavior(.basedOnSize)
            .environment(\.editMode, .constant(.active))
            Text("You can change this any time in Settings → Apps.")
                .font(.caption)
                .foregroundStyle(Color(hex: "#9ca3af"))
        }
    }

    /// Last page when Budget wasn't picked: no bank needed.
    private var readyPage: some View {
        VStack(spacing: 20) {
            Spacer()
            HStack(spacing: 12) {
                ForEach(lineup.installed) { AppIconTile($0, size: 52) }
            }
            Text("You're all set")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Color(hex: "#111827"))
            Text("Your apps are ready. Add Budget any time from Settings → Apps.")
                .font(.subheadline)
                .foregroundStyle(Color(hex: "#6b7280"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
    }

    private var welcomePage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 10) {
                    WooliLogo(size: 40)
                    Text("Wooli")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(Color(hex: "#2563eb"))
                }
                Text("Your money, trips, and more — private to you.")
                    .font(.title3)
                    .foregroundStyle(Color(hex: "#4b5563"))

                VStack(alignment: .leading, spacing: 18) {
                    FeatureRow(symbol: "square.grid.2x2.fill", tint: Color(hex: "#2563eb"), title: "Apps for your life",
                               detail: "Budget, Trips, and more in one place. Pick yours next.")
                    FeatureRow(symbol: "lock.shield.fill", tint: Color(hex: "#16a34a"), title: "Private by design",
                               detail: "Your data stays on this iPhone and your own iCloud.")
                    FeatureRow(symbol: "building.columns.fill", tint: Color(hex: "#f97316"), title: "Your choice of bank access",
                               detail: "Type transactions in yourself, or import them read-only.")
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    /// How Budget gets transactions: typed in (free) or imported with SimpleFIN ($15/yr).
    private var ctaPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("How should Budget get your transactions?")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color(hex: "#111827"))
                    .fixedSize(horizontal: false, vertical: true)

                BankOption(isSelected: bankChoice == .manual, symbol: "square.and.pencil", tint: Color(hex: "#16a34a"),
                           title: "Enter them yourself", price: "Free",
                           detail: "Add accounts and transactions by hand. Nothing leaves your iPhone.") {
                    withAnimation(.snappy) { bankChoice = .manual }
                }
                BankOption(isSelected: bankChoice == .simpleFIN, symbol: "building.columns.fill", tint: Color(hex: "#2563eb"),
                           title: "Import from your bank", price: "$15/yr + tax, paid to SimpleFIN",
                           detail: "Balances and transactions arrive automatically through SimpleFIN, a separate read-only service. Wooli doesn't charge you anything.") {
                    withAnimation(.snappy) { bankChoice = .simpleFIN }
                }

                Button {
                    showExplainer = true
                } label: {
                    Label("How SimpleFIN works and what the $15 pays for", systemImage: "info.circle")
                        .font(.subheadline.weight(.medium))
                }
                .padding(.top, 2)

                Button("Or explore with sample data") { app.startSample(context: context) }
                    .font(.subheadline)
                    .foregroundStyle(Color(hex: "#6b7280"))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 6)
            }
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

/// A selectable option card on the bank-choice page.
private struct BankOption: View {
    let isSelected: Bool
    let symbol: String
    let tint: Color
    let title: String
    let price: String
    let detail: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(tint)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.headline).foregroundStyle(Color(hex: "#111827"))
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(Color(hex: "#6b7280"))
                        .fixedSize(horizontal: false, vertical: true)
                    Text(price)
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(tint.opacity(0.12), in: Capsule())
                        .foregroundStyle(tint)
                        .padding(.top, 3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? tint : Color(hex: "#d1d5db"))
            }
            .padding(14)
            .background(isSelected ? tint.opacity(0.06) : .white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(isSelected ? tint : Color(hex: "#E5E7EB"), lineWidth: isSelected ? 2 : 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// One tour page: a symbol, a title, and a short description.
private struct SimpleTourPage: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: symbol)
                .font(.system(size: 52))
                .foregroundStyle(tint)
            Text(title)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(Color(hex: "#111827"))
            Text(detail)
                .font(.title3)
                .foregroundStyle(Color(hex: "#6b7280"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Spacer()
        }
        .padding(.horizontal, 12)
    }
}

/// The Budget tour page also previews the starter spending groups, since
/// budgeting is the one tab that benefits from a concrete look at what's
/// already set up. A grid rather than a scrolling row: paging is locked on
/// tour pages, which would also freeze a horizontal scroll inside one.
private struct BudgetTourPage: View {
    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        VStack(spacing: 12) {
            Spacer(minLength: 0)
            Image(systemName: "map")
                .font(.system(size: 44))
                .foregroundStyle(Color(hex: "#2563eb"))
            Text("Budget")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(Color(hex: "#111827"))
            Text("Plan a monthly target for every category. Wooli starts you off with a full set you can rename, reorder, or remove.")
                .font(.subheadline)
                .foregroundStyle(Color(hex: "#6b7280"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(DefaultCategories.groups.filter { !$0.isIncome && !$0.isTransfer }, id: \.name) { group in
                    HStack(spacing: 6) {
                        Text(group.icon)
                        Text(group.name)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Color(hex: "#111827"))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(hex: "#E5E7EB")))
                }
            }
            .padding(.top, 4)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
    }
}

private struct FeatureRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(tint)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline).foregroundStyle(Color(hex: "#111827"))
                Text(detail).font(.subheadline).foregroundStyle(Color(hex: "#6b7280"))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct ConnectStep: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Theme.brand, in: Circle())
            Text(text)
        }
    }
}

/// Paste a SimpleFIN setup token. Used from Welcome and from Settings.
struct ConnectSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var token = ""
    @State private var isConnecting = false
    @State private var errorMessage: String?
    @State private var showExplainer = false

    private var trimmed: String { token.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ConnectStep(number: 1, text: "Open SimpleFIN Bridge and connect your bank accounts.")
                    ConnectStep(number: 2, text: "Create a setup token for a new app.")
                    ConnectStep(number: 3, text: "Paste that token below. It can only be used once.")
                    Link(destination: URL(string: "https://beta-bridge.simplefin.org")!) {
                        Label("Open SimpleFIN Bridge", systemImage: "safari")
                    }
                    Button("How SimpleFIN works", systemImage: "info.circle") { showExplainer = true }
                } header: {
                    Text("How to Connect")
                } footer: {
                    Text("SimpleFIN Bridge is a separate service that links your banks to apps like Wooli. It costs $15 a year plus tax, paid to SimpleFIN — not to Wooli. You'll need an account there before you can get a token.")
                }

                Section {
                    TextField("Setup token", text: $token, axis: .vertical)
                        .lineLimit(3...6)
                        .font(.body.monospaced())
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Paste from Clipboard", systemImage: "doc.on.clipboard") {
                        token = UIPasteboard.general.string ?? token
                    }
                } header: {
                    Text("Setup Token")
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Label("Read-only. Wooli can see balances and transactions but can never move money.", systemImage: "lock.shield")
                } footer: {
                    Text("Your access key is kept in your iCloud Keychain, end-to-end encrypted like your saved passwords.")
                }
            }
            .navigationTitle("Connect")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isConnecting {
                        ProgressView()
                    } else {
                        Button("Connect") { connect() }
                            .disabled(trimmed.isEmpty)
                    }
                }
            }
            .interactiveDismissDisabled(isConnecting)
            .sheet(isPresented: $showExplainer) { SimpleFINExplainer() }
        }
    }

    private func connect() {
        isConnecting = true
        errorMessage = nil
        Task {
            do {
                try await app.connect(setupToken: trimmed, context: context)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isConnecting = false
        }
    }
}
