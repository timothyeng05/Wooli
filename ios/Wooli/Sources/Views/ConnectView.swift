import SwiftUI

struct ConnectView: View {
    var onConnected: () -> Void

    @State private var setupToken = ""
    @State private var isConnecting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Connect your bank")
                    .font(.title2.bold())
                Text("Paste a SimpleFIN setup token from your SimpleFIN Bridge account (simplefin.org). Once connected, this app talks to your bank's SimpleFIN bridge directly from this phone -- there is no Wooli server in the loop, and everything is stored only on this device.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextEditor(text: $setupToken)
                    .frame(height: 100)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(.secondary.opacity(0.3)))
                    .autocorrectionDisabled()
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    connect()
                } label: {
                    if isConnecting {
                        ProgressView()
                    } else {
                        Text("Connect")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(setupToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isConnecting)

                Spacer()
            }
            .padding()
            .navigationTitle("Wooli")
        }
    }

    private func connect() {
        isConnecting = true
        errorMessage = nil
        let token = setupToken.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                try await SyncService.connect(setupToken: token)
                isConnecting = false
                onConnected()
            } catch {
                isConnecting = false
                errorMessage = error.localizedDescription
            }
        }
    }
}
