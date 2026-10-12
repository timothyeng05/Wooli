import SwiftUI

/// "How SimpleFIN works" — what it is, what the yearly fee pays for, what
/// Wooli can and can't see, and how it compares with entering things by hand.
/// Opened from onboarding, the Connect sheet, and Settings.
struct SimpleFINExplainer: View {
    @Environment(\.dismiss) private var dismiss
    private static let bridgeURL = URL(string: "https://beta-bridge.simplefin.org")!

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    section("What is SimpleFIN?", symbol: "link") {
                        Text("SimpleFIN Bridge is an independent service — not part of Wooli — that links your bank accounts to apps you choose. You sign in to your banks on SimpleFIN's website, and it gives Wooli a read-only feed of your balances and transactions.")
                    }

                    section("What the $15 a year pays for", symbol: "creditcard") {
                        Text("SimpleFIN charges **$15 a year plus tax** (or $1.50 a month plus tax). **You pay SimpleFIN directly, not Wooli** — Wooli receives none of it and doesn't charge you anything.")
                        bullet("arrow.down.circle", "Balances and transactions import automatically — no typing.")
                        bullet("building.columns", "Connect up to 25 banks and cards.")
                        bullet("app.connected.to.app.below.fill", "Use the same subscription with up to 25 apps.")
                        bullet("arrow.clockwise", "Wooli checks for new data when you open it (at most every 30 minutes) or pull to refresh.")
                        Text("Bank connections cost money to run. Paying SimpleFIN for them is what lets Wooli work without its own server, ads, or selling your data.")
                            .foregroundStyle(Theme.textSecondary)
                    }

                    section("What SimpleFIN can and can't do", symbol: "building.columns") {
                        can("Connects to your banks through MX, a bank-data company that holds your bank logins. SimpleFIN's own servers never store them.")
                        can("Reads account names, balances, and transactions, and shares them only with apps you give a setup token to.")
                        can("Lets you cut off an app's access any time from your SimpleFIN account.")
                        can("Alerts you whenever your data is accessed from a new IP address.")
                        cannot("Can't move money — SimpleFIN access is read-only.")
                        cannot("Its staff can't see your transactions unless you grant temporary debugging access.")
                    }

                    section("What Wooli can and can't do", symbol: "lock.shield") {
                        can("Reads account names, balances, and transactions from SimpleFIN.")
                        can("Keeps them only on your iPhone and in your own iCloud.")
                        cannot("Can't move money, pay bills, or make transfers.")
                        cannot("Never sees your bank logins — you sign in to banks on SimpleFIN's site, not in Wooli.")
                        cannot("Never sends your bank data anywhere else — Wooli has no server.")
                        Text("Wooli's SimpleFIN access key is kept in your iCloud Keychain, end-to-end encrypted like your saved passwords.")
                            .foregroundStyle(Theme.textSecondary)
                    }

                    section("SimpleFIN vs. entering it yourself", symbol: "square.split.2x1") {
                        ComparisonTable()
                    }

                    section("Setting it up (about 10 minutes)", symbol: "list.number") {
                        step(1, "Create an account at SimpleFIN Bridge and choose a plan.")
                        step(2, "Connect your banks and cards there.")
                        step(3, "Create a setup token for a new app — call it Wooli — and copy it.")
                        step(4, "Paste it into Wooli. Each token works once.")
                        Link(destination: Self.bridgeURL) {
                            Label("Open SimpleFIN Bridge", systemImage: "safari")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.bordered)
                        .padding(.top, 4)
                    }

                    section("If you stop paying", symbol: "arrow.uturn.backward") {
                        Text("New transactions stop arriving, but everything already imported stays in Wooli. You can keep going by entering transactions yourself, or start with manual entry and switch to SimpleFIN later — your manual accounts stay either way.")
                    }
                }
                .padding(16)
            }
            .pageBackground()
            .navigationTitle("How SimpleFIN Works")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private func section(_ title: String, symbol: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: symbol)
                .font(.headline)
                .foregroundStyle(Theme.text)
            content()
                .font(.subheadline)
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .card(padding: 16)
    }

    private func bullet(_ symbol: String, _ text: String, tint: Color = Theme.brand) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(tint).frame(width: 20)
            Text(text)
        }
    }

    private func can(_ text: String) -> some View {
        bullet("checkmark.circle.fill", text, tint: Theme.income)
    }

    private func cannot(_ text: String) -> some View {
        bullet("xmark.circle.fill", text, tint: Theme.expense)
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(number)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Theme.brand, in: Circle())
            Text(text)
        }
    }
}

private struct ComparisonTable: View {
    private let rows: [(String, String, String)] = [
        ("Cost", "Free", "$15/yr + tax, to SimpleFIN"),
        ("Transactions", "You type each one", "Automatic"),
        ("Balances", "You update them", "Automatic"),
        ("Setup", "1 minute", "About 10 minutes"),
        ("Leaves your iPhone", "Never", "Via SimpleFIN"),
    ]

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 10) {
            GridRow {
                Text("")
                Text("Manual").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
                Text("SimpleFIN").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
            }
            ForEach(rows, id: \.0) { row in
                Divider().gridCellUnsizedAxes(.horizontal)
                GridRow {
                    Text(row.0).foregroundStyle(Theme.textSecondary)
                    Text(row.1)
                    Text(row.2)
                }
            }
        }
        .font(.footnote)
    }
}
