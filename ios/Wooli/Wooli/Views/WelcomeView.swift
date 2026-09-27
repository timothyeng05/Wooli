import SwiftUI
import SwiftData

/// First-run screen — the web sign-in page's look: blue gradient, white card,
/// sheep logo, blue "Wooli" wordmark. A swipeable tour (one page per tab,
/// plus a peek at the starter categories) runs before the connect step, so
/// people can see what the app offers before they've connected anything.
struct WelcomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var page = 0
    @State private var showConnect = false

    private let pageCount = 7

    var body: some View {
        ZStack {
            Theme.gradient.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Spacer()
                    if page < pageCount - 1 {
                        Button("Skip") { withAnimation { page = pageCount - 1 } }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color(hex: "#6b7280"))
                    }
                }

                TabView(selection: $page) {
                    welcomePage.tag(0)
                    SimpleTourPage(symbol: "house", tint: Color(hex: "#2563eb"), title: "Dashboard",
                                   detail: "See your net worth, this month's budget, and recent transactions at a glance.")
                        .tag(1)
                    SimpleTourPage(symbol: "square.stack.3d.up", tint: Color(hex: "#16a34a"), title: "Accounts",
                                   detail: "Every account you connect, kept in sync with your bank automatically.")
                        .tag(2)
                    SimpleTourPage(symbol: "creditcard", tint: Color(hex: "#f97316"), title: "Transactions",
                                   detail: "Search, filter, and fix any transaction's category in a couple of taps.")
                        .tag(3)
                    SimpleTourPage(symbol: "chart.pie", tint: Color(hex: "#ec4899"), title: "Reports",
                                   detail: "See where your money goes with spending breakdowns and trends over time.")
                        .tag(4)
                    BudgetTourPage().tag(5)
                    ctaPage.tag(6)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(height: 420)

                HStack(spacing: 6) {
                    ForEach(0..<pageCount, id: \.self) { i in
                        Capsule()
                            .fill(i == page ? Color(hex: "#2563eb") : Color(hex: "#2563eb").opacity(0.2))
                            .frame(width: i == page ? 16 : 6, height: 6)
                    }
                }
                .animation(.default, value: page)

                if page < pageCount - 1 {
                    Button {
                        withAnimation { page += 1 }
                    } label: {
                        Text("Continue")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
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
                Text("Your budget, private to you.")
                    .font(.title3)
                    .foregroundStyle(Color(hex: "#4b5563"))

                VStack(alignment: .leading, spacing: 18) {
                    FeatureRow(symbol: "lock.shield.fill", tint: Color(hex: "#16a34a"), title: "Private by design",
                               detail: "Your accounts and transactions stay on this iPhone and in your own iCloud. There's no Wooli server.")
                    FeatureRow(symbol: "building.columns.fill", tint: Color(hex: "#2563eb"), title: "Connect with SimpleFIN",
                               detail: "Read-only access to your banks. Wooli can see balances and transactions but can never move money.")
                    FeatureRow(symbol: "checkmark.square.fill", tint: Color(hex: "#f97316"), title: "Review and budget",
                               detail: "Confirm each transaction, plan your month, and see where your money goes.")
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private var ctaPage: some View {
        VStack(spacing: 20) {
            Spacer()
            WooliLogo(size: 40)
            Text("Ready when you are")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Color(hex: "#111827"))
            Text("Connect your bank with SimpleFIN, or explore first with sample data.")
                .font(.subheadline)
                .foregroundStyle(Color(hex: "#6b7280"))
                .multilineTextAlignment(.center)
            Spacer()
            VStack(spacing: 12) {
                Button {
                    showConnect = true
                } label: {
                    Text("Connect with SimpleFIN")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button {
                    app.startSample(context: context)
                } label: {
                    Text("Explore with sample data")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .tint(Color(hex: "#374151"))
                .controlSize(.large)
            }
        }
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

/// The Budget tour page also previews the starter category groups, since
/// budgeting is the one tab that benefits from a concrete look at what's
/// already set up.
private struct BudgetTourPage: View {
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "map")
                .font(.system(size: 52))
                .foregroundStyle(Color(hex: "#2563eb"))
            Text("Budget")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(Color(hex: "#111827"))
            Text("Plan a monthly target for every category. Wooli starts you off with a full set you can rename, reorder, or remove.")
                .font(.subheadline)
                .foregroundStyle(Color(hex: "#6b7280"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(DefaultCategories.groups, id: \.name) { group in
                        VStack(spacing: 4) {
                            Text(group.icon).font(.title2)
                            Text(group.name)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color(hex: "#111827"))
                                .lineLimit(1)
                            Text("\(group.children.count) categories")
                                .font(.caption2)
                                .foregroundStyle(Color(hex: "#9ca3af"))
                        }
                        .frame(width: 96)
                        .padding(.vertical, 12)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color(hex: "#E5E7EB")))
                    }
                }
                .padding(.horizontal, 2).padding(.vertical, 4)
            }
            Spacer()
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
                } header: {
                    Text("How to Connect")
                } footer: {
                    Text("SimpleFIN Bridge is a separate, paid service (about $15 a year) that links your banks to apps like Wooli. You'll need an account there before you can get a token.")
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
