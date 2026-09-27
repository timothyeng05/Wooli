import SwiftUI
import SwiftData

/// First-run screen in the style of Apple's "Welcome to …" sheets.
struct WelcomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var showConnect = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 36) {
                    VStack(spacing: 16) {
                        SymbolTile(symbol: "leaf.fill", size: 88)
                            .shadow(color: .accentColor.opacity(0.3), radius: 16, y: 8)
                        Text("Welcome to Wooli")
                            .font(.largeTitle.bold())
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 56)

                    VStack(alignment: .leading, spacing: 28) {
                        FeatureRow(symbol: "lock.shield.fill", tint: .green, title: "Private by design",
                                   detail: "Your accounts and transactions stay on this iPhone and in your own iCloud. There's no Wooli server.")
                        FeatureRow(symbol: "building.columns.fill", tint: .blue, title: "Connect with SimpleFIN",
                                   detail: "Read-only access to your banks. Wooli can see balances and transactions but can never move money.")
                        FeatureRow(symbol: "chart.pie.fill", tint: .orange, title: "Budget your way",
                                   detail: "Review each transaction, set monthly targets, and see where your money goes.")
                    }
                    .padding(.horizontal, 8)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
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

                Button("Explore with Sample Data") {
                    app.startSample(context: context)
                }
                .font(.body.weight(.medium))
                .padding(.vertical, 8)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
            .frame(maxWidth: 520)
        }
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
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.title)
                .foregroundStyle(tint)
                .frame(width: 44)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
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
                    TextField("Setup token", text: $token, axis: .vertical)
                        .lineLimit(3...6)
                        .font(.body.monospaced())
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Paste from Clipboard", systemImage: "doc.on.clipboard") {
                        token = UIPasteboard.general.string ?? token
                    }
                } header: {
                    Text("SimpleFIN Setup Token")
                } footer: {
                    Text("In SimpleFIN Bridge, connect your banks, then create a setup token for a new app and paste it here. The token can only be used once.")
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Link(destination: URL(string: "https://beta-bridge.simplefin.org")!) {
                        Label("Open SimpleFIN Bridge", systemImage: "safari")
                    }
                } footer: {
                    Text("SimpleFIN Bridge is a paid service (about $15 a year) that links your banks. Your access key is stored only in this iPhone's Keychain.")
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
