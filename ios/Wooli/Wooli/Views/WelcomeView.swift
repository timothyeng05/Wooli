import SwiftUI
import SwiftData

/// First-run screen — the web sign-in page's look: blue gradient, white card,
/// sheep logo, blue "Wooli" wordmark.
struct WelcomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var showConnect = false

    var body: some View {
        ZStack {
            Theme.gradient.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack(spacing: 10) {
                        WooliLogo(size: 44)
                        Text("Wooli")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundStyle(Color(hex: "#2563eb"))
                    }
                    Text("Your budget, private to you.")
                        .font(.title3)
                        .foregroundStyle(Color(hex: "#4b5563"))

                    VStack(alignment: .leading, spacing: 22) {
                        FeatureRow(symbol: "lock.shield.fill", tint: Color(hex: "#16a34a"), title: "Private by design",
                                   detail: "Your accounts and transactions stay on this iPhone and in your own iCloud. There's no Wooli server.")
                        FeatureRow(symbol: "building.columns.fill", tint: Color(hex: "#2563eb"), title: "Connect with SimpleFIN",
                                   detail: "Read-only access to your banks. Wooli can see balances and transactions but can never move money.")
                        FeatureRow(symbol: "checkmark.square.fill", tint: Color(hex: "#f97316"), title: "Review and budget",
                                   detail: "Confirm each transaction, plan your month, and see where your money goes.")
                    }

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
                .padding(28)
                .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .shadow(color: .black.opacity(0.12), radius: 24, y: 10)
                .frame(maxWidth: 460)
                .padding(20)
                .frame(maxWidth: .infinity, minHeight: 0)
                .containerRelativeFrame(.vertical, alignment: .center)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .environment(\.colorScheme, .light)
        .sheet(isPresented: $showConnect) {
            ConnectSheet()
        }
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
