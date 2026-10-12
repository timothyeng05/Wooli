import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var showConnect = false
    @State private var confirmErase = false
    @State private var pushStatusMessage: String?
    @AppStorage("displayName") private var displayName = ""
    @AppStorage(AICategorizer.enabledKey) private var aiEnabled = true
    @AppStorage(ReviewReminder.enabledKey) private var reviewRemindersEnabled = true
    private var cloud = ICloudSyncMonitor.shared

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
                                if app.isSyncing {
                                    Spacer()
                                    ProgressView()
                                }
                            }
                        }
                        .disabled(app.isSyncing)
                    } else {
                        LabeledContent("Status", value: app.mode == .sample ? "Sample Data" : "Not Connected")
                        Button("Connect with SimpleFIN", systemImage: "link") { showConnect = true }
                    }
                }

                Section {
                    LabeledContent {
                        HStack(spacing: 5) {
                            Image(systemName: cloud.iconName)
                                .symbolEffect(.pulse, isActive: cloud.isSyncing)
                            Text(cloud.shortLabel.replacingOccurrences(of: "iCloud: ", with: ""))
                        }
                        .foregroundStyle(cloud.statusColor)
                    } label: {
                        Label("Status", systemImage: "icloud.fill")
                    }

                    if let lastSync = cloud.lastSyncAt {
                        LabeledContent("Last Synced", value: lastSync.formatted(date: .abbreviated, time: .shortened))
                    }

                    if let error = cloud.lastError {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Sync Issue").font(.caption.weight(.semibold)).foregroundStyle(.red)
                            Text(error).font(.caption2).foregroundStyle(.secondary)
                        }
                    }

                    Button {
                        Task { await cloud.checkAccountStatus() }
                    } label: {
                        Label("Check iCloud Status", systemImage: "arrow.clockwise")
                    }

                    Button {
                        let count = ICloudSyncService.pushAllLocalData(context: context)
                        pushStatusMessage = "Queued \(count) items to upload to iCloud."
                    } label: {
                        Label("Push All Data to iCloud", systemImage: "icloud.and.arrow.up")
                    }

                    Button {
                        Deduplicator.run(context: context)
                        pushStatusMessage = "Merged duplicates and synced local records."
                    } label: {
                        Label("Merge & Deduplicate", systemImage: "arrow.triangle.merge")
                    }

                    if let msg = pushStatusMessage {
                        Text(msg)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("iCloud Sync")
                } footer: {
                    Text("Push All Data marks all local categories, targets, rules, and reviewed transactions for immediate upload to iCloud. Merge & Deduplicate reconciles records across devices.")
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

                Section("Apps") {
                    NavigationLink {
                        ModulesSettingsView()
                    } label: {
                        Label("Apps", systemImage: "square.grid.2x2.fill")
                    }
                }

                Section("Household") {
                    NavigationLink {
                        PeopleSettingsView()
                    } label: {
                        Label("People", systemImage: "person.2")
                    }
                }

                Section {
                    Button(role: .destructive) {
                        confirmErase = true
                    } label: {
                        Label("Reset All Data", systemImage: "trash")
                    }
                } footer: {
                    Text("Removes your bank connection and deletes all cached accounts, transactions, and categories.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showConnect) {
                ConnectSheet()
            }
            .confirmationDialog(
                "Reset all data?",
                isPresented: $confirmErase,
                titleVisibility: .visible
            ) {
                Button("Delete Everything", role: .destructive) {
                    dismiss()
                    app.disconnectAndErase(context: context)
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This removes your SimpleFIN credentials and clears all transactions, accounts, and categories. You'll need to reconnect your bank to use live data again.")
            }
        }
    }
}
