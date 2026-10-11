import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var showConnect = false
    @State private var confirmErase = false
    @AppStorage("displayName") private var displayName = ""
    @AppStorage(AICategorizer.enabledKey) private var aiEnabled = true
    @AppStorage(ReviewReminder.enabledKey) private var reviewRemindersEnabled = true

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Your first name", text: $displayName)
                        .textContentType(.givenName)
                } header: {
                    Text("Name")
                } footer: {
                    Text("Used in the dashboard greeting.")
                }

                Section("Bank Connection") {
                    if app.mode == .live {
                        LabeledContent {
                            Text("Connected").foregroundStyle(.green)
                        } label: {
                            Label("SimpleFIN", systemImage: "building.columns.fill")
                        }
                        if let last = app.lastSyncAt {
                            LabeledContent("Last Sync", value: last.formatted(.relative(presentation: .named)))
                        }
                        Button {
                            Task { await app.sync(context: context) }
                        } label: {
                            HStack {
                                Label("Sync Now", systemImage: "arrow.clockwise")
                                if app.isSyncing { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(app.isSyncing)
                    } else {
                        LabeledContent("Status", value: "Sample Data")
                        Button("Connect with SimpleFIN", systemImage: "link") { showConnect = true }
                    }
                }

                Section {
                    Toggle(isOn: $reviewRemindersEnabled) {
                        Label("Remind me to review", systemImage: "bell")
                    }
                } footer: {
                    Text("If transactions are still waiting for a category when you leave the app, you'll get a reminder the next morning.")
                }

                Section {
                    Toggle(isOn: $aiEnabled) {
                        Label("Suggest categories", systemImage: "sparkles")
                    }
                    .disabled(AICategorizer.status != .available)
                    .onChange(of: aiEnabled) { _, on in
                        if on { Task { await app.autoCategorize(context: context) } }
                    }
                } header: {
                    Text("Apple Intelligence")
                } footer: {
                    Text(AICategorizer.statusDescription + " Suggestions stay in your review queue until you confirm them.")
                }

                Section("Modules") {
                    NavigationLink {
                        ModulesSettingsView()
                    } label: {
                        Label("Modules", systemImage: "square.grid.2x2.fill")
                    }
                }

                Section("Household") {
                    NavigationLink {
                        PeopleSettingsView()
                    } label: {
                        Label("People", systemImage: "person.2.fill")
                    }
                }

                Section("Budget") {
                    NavigationLink {
                        RulesView()
                    } label: {
                        Label("Rules", systemImage: "wand.and.stars")
                    }
                    NavigationLink {
                        CategoriesSettingsView()
                    } label: {
                        Label("Categories", systemImage: "square.grid.2x2")
                    }
                }

                Section {
                    PrivacyRow(symbol: "iphone", text: "Accounts and transactions are stored on this iPhone.")
                    PrivacyRow(symbol: "icloud", text: "They sync only to your own private iCloud. Turn on Advanced Data Protection in iCloud settings for end-to-end encryption.")
                    PrivacyRow(symbol: "key", text: "Your SimpleFIN access key is kept in your iCloud Keychain, end-to-end encrypted like your saved passwords, so a new iPhone connects automatically.")
                    PrivacyRow(symbol: "eye.slash", text: "No analytics, no ads, and no Wooli server.")
                } header: {
                    Text("Privacy")
                }

                Section {
                    Button(app.mode == .live ? "Disconnect and Erase All Data" : "Erase Sample Data", role: .destructive) {
                        confirmErase = true
                    }
                } footer: {
                    Text("Removes the SimpleFIN connection and everything Wooli stored on this iPhone, in your iCloud, and on your other devices.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog("Erase all Wooli data?", isPresented: $confirmErase, titleVisibility: .visible) {
                Button("Erase All Data", role: .destructive) {
                    dismiss()
                    app.disconnectAndErase(context: context)
                }
            } message: {
                Text("This can't be undone. Your bank accounts themselves aren't affected.")
            }
            .sheet(isPresented: $showConnect) { ConnectSheet() }
        }
    }
}

private struct PrivacyRow: View {
    let symbol: String
    let text: String

    var body: some View {
        Label {
            Text(text).font(.subheadline)
        } icon: {
            Image(systemName: symbol).foregroundStyle(Color.accentColor)
        }
    }
}
