import SwiftUI
import SwiftData

/// Full-screen, one-at-a-time review: "130 remaining", a card per transaction,
/// Skip for now / Mark as reviewed.
struct ReviewView: View {
    /// True for the guided first-run pass right after connecting a bank:
    /// scoped to the last 30 days instead of the usual review window, with
    /// a one-time tip pointing at rule creation.
    var isCalibration = false

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @Query private var rules: [MerchantRule]

    /// Fixed order for this session, so rows don't jump around as they change.
    @State private var queue: [PersistentIdentifier] = []
    @State private var skipped: Set<PersistentIdentifier> = []
    @State private var showSameMerchant = false
    @State private var direction: Edge = .trailing
    @State private var showTip = true
    /// Every card acted on this session, newest last, so Back can walk
    /// through them. `reviewed` = marked reviewed (Back puts it back in the
    /// queue); otherwise it was skipped.
    @State private var history: [(id: PersistentIdentifier, reviewed: Bool)] = []

    @State private var hasSeenIntro = false

    var body: some View {
        if isCalibration && !hasSeenIntro {
            introScreen
        } else {
            mainReview
        }
    }
    
    @ViewBuilder
    private var introScreen: some View {
        VStack(spacing: 32) {
            Spacer()
            Image(systemName: "tray.full.fill").font(.system(size: 72)).foregroundStyle(.white)
            VStack(spacing: 12) {
                Text("Transactions Loaded").font(.system(size: 32, weight: .bold)).foregroundStyle(.white)
                Text("We've securely loaded in your transactions from the past month and month to date.")
                    .font(.title3).foregroundStyle(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 24)
            
            Spacer()
            
            VStack(spacing: 16) {
                PillButton(title: "Let me explore the app first", filled: false) {
                    dismiss()
                }
                PillButton(title: "Review them now", filled: true) {
                    withAnimation { hasSeenIntro = true }
                }
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.gradient.ignoresSafeArea())
    }

    private var mainReview: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let byId = Dictionary(transactions.map { ($0.persistentModelID, $0) }, uniquingKeysWith: { a, _ in a })
        let pending = queue.compactMap { byId[$0] }.filter { $0.needsReview && !$0.isHidden }
        let current = pending.first { !skipped.contains($0.persistentModelID) } ?? pending.first

        return ZStack {
            Theme.gradient.ignoresSafeArea()

            VStack(spacing: 16) {
                HStack {
                    Button("Close", systemImage: "xmark") { dismiss() }
                        .labelStyle(.iconOnly)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                    Spacer()
                    Text(pending.isEmpty ? "All done" : "\(pending.count) remaining")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                    Spacer()
                    if !history.isEmpty {
                        Button("Back to previous", systemImage: "arrow.uturn.backward") { goBack() }
                            .labelStyle(.iconOnly)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                    } else {
                        Color.clear.frame(width: 44, height: 44)
                    }
                }
                .padding(.horizontal, 12)

                if isCalibration && showTip {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "lightbulb.fill").foregroundStyle(.white)
                        Text("Pick a category, then tap **Create rule** when Wooli offers it — that teaches Wooli to categorize transactions like this one automatically from now on.")
                            .font(.footnote)
                            .foregroundStyle(.white)
                        Spacer(minLength: 0)
                        Button("Dismiss", systemImage: "xmark") { withAnimation { showTip = false } }
                            .labelStyle(.iconOnly)
                            .foregroundStyle(.white.opacity(0.8))
                    }
                    .padding(12)
                    .background(.white.opacity(0.15), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.horizontal, 16)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

                if let tx = current {
                    let sameMerchant = transactions.filter { $0.normalizedMerchant == tx.normalizedMerchant }
                    ScrollView {
                        VStack(alignment: .leading, spacing: 22) {
                            TransactionHeader(transaction: tx, category: ledger.category(for: tx),
                                              account: accounts.first { $0.providerAccountId == tx.accountId },
                                              sameMerchantCount: sameMerchant.count) { showSameMerchant = true }
                            Divider()
                            TransactionEditor(transaction: tx,
                                              suggestions: CategorySuggestions.suggest(for: tx, rules: rules,
                                                                                       categories: categories,
                                                                                       history: transactions),
                                              allCategories: categories)
                        }
                        .padding(22)
                    }
                    .scrollIndicators(.hidden)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.12), radius: 20, y: 8)
                    .padding(.horizontal, 16)
                    .id(tx.persistentModelID)
                    .transition(.asymmetric(insertion: .move(edge: direction).combined(with: .opacity),
                                            removal: .move(edge: direction == .trailing ? .leading : .trailing).combined(with: .opacity)))
                    .sheet(isPresented: $showSameMerchant) {
                        SameMerchantSheet(title: tx.title, transactions: sameMerchant, categories: categories)
                    }

                    VStack(spacing: 6) {
                        HStack(spacing: 12) {
                            if pending.count > 1 {
                                PillButton(title: "Skip for now", filled: false) { advance(skipping: tx, pending: pending) }
                            }
                            PillButton(title: "Mark as reviewed", filled: true) { confirm(tx) }
                                .disabled(tx.categoryId == nil)
                                .contextMenu {
                                    if let category = categories.first(where: { $0.id == tx.categoryId }) {
                                        Button("Mark as reviewed", systemImage: "checkmark") { confirm(tx) }
                                        Button("Always \(category.name) for \(tx.baseTitle) · skip review", systemImage: "checkmark.seal") {
                                            direction = .trailing
                                            history.append((tx.persistentModelID, true))
                                            withAnimation(.snappy) {
                                                _ = RuleEngine.autoApprove(tx, category: category, context: context)
                                            }
                                        }
                                    }
                                }
                        }
                        if tx.categoryId == nil {
                            Text("Choose a category first").font(.footnote).foregroundStyle(.white.opacity(0.9))
                        } else {
                            Text("Hold \"Mark as reviewed\" to always skip review for \(tx.baseTitle)")
                                .font(.caption).foregroundStyle(.white.opacity(0.8))
                                .lineLimit(1).minimumScaleFactor(0.8)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                } else {
                    Spacer()
                    VStack(spacing: 14) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 72))
                            .foregroundStyle(.white)
                            .symbolEffect(.bounce, value: pending.isEmpty)
                        Text("You're all caught up").font(.title2.weight(.bold)).foregroundStyle(.white)
                        Text("Every transaction has been reviewed.").foregroundStyle(.white.opacity(0.85))
                        Button("Done") { dismiss() }
                            .buttonStyle(.borderedProminent)
                            .tint(.white)
                            .foregroundStyle(Theme.brand)
                            .controlSize(.large)
                            .padding(.top, 8)
                        if !history.isEmpty {
                            Button("Go back to the last one", systemImage: "arrow.uturn.backward") { goBack() }
                                .foregroundStyle(.white)
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                    Spacer()
                }
            }
        }
        .onAppear {
            if queue.isEmpty {
                let source = isCalibration
                    ? transactions.filter { $0.needsReview && !$0.isHidden && ledger.isVisible($0) && $0.transactedAt >= calibrationStart }
                    : ledger.reviewQueue(transactions)
                queue = source.map(\.persistentModelID)
            }
        }
    }

    /// The last 30 days, for the guided first-run pass.
    private var calibrationStart: Date {
        Calendar.current.date(byAdding: .day, value: -30, to: .now)!
    }

    private func confirm(_ tx: LocalTransaction) {
        direction = .trailing
        history.append((tx.persistentModelID, true))
        withAnimation(.snappy) {
            _ = Categorizer.confirm(tx, categories: categories, context: context)
        }
    }

    /// Step back to the previous card. A reviewed one goes back in the queue
    /// (its category stays — what a mistap needs undone is "done", not the
    /// pick); a skipped one just comes back to the front. Repeat to keep going.
    private func goBack() {
        guard let step = history.popLast(),
              let tx = transactions.first(where: { $0.persistentModelID == step.id }) else { return }
        direction = .leading
        withAnimation(.snappy) {
            if step.reviewed { tx.needsReview = true }
            skipped.remove(step.id)
            if let i = queue.firstIndex(of: step.id) { queue.remove(at: i) }
            queue.insert(step.id, at: 0)
        }
    }

    private func advance(skipping tx: LocalTransaction, pending: [LocalTransaction]) {
        direction = .trailing
        history.append((tx.persistentModelID, false))
        withAnimation(.snappy) {
            skipped.insert(tx.persistentModelID)
            // Once everything has been skipped, start another pass.
            if pending.allSatisfy({ skipped.contains($0.persistentModelID) }) { skipped.removeAll() }
            // Move the skipped one to the back of the line.
            if let i = queue.firstIndex(of: tx.persistentModelID) {
                queue.append(queue.remove(at: i))
            }
        }
    }
}

/// Large rounded button on the review gradient.
private struct PillButton: View {
    let title: String
    let filled: Bool
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .foregroundStyle(filled ? .white : Theme.brandDark)
                .background(filled ? Color(hex: "#1d4ed8") : .white,
                            in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .opacity(isEnabled ? 1 : 0.5)
                .shadow(color: .black.opacity(0.1), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }
}
