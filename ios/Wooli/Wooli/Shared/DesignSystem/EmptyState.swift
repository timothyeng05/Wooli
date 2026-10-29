import SwiftUI

/// What a module shows before it has anything in it: an invitation, not an apology.
/// The title names the first thing to do; the action uses the same words as the toolbar add button.
struct WooliEmptyState: View {
    let symbol: String
    let title: String
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: Space.m) {
            Image(systemName: symbol)
                .font(.title)
                .foregroundStyle(Theme.brandDark)
                .frame(width: 64, height: 64)
                .background(Theme.brandSoft, in: Circle())
                .accessibilityHidden(true)
            Text(title).font(.headline).foregroundStyle(Theme.text)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
            Button(action: action) { Label(actionTitle, systemImage: "plus") }
                .buttonStyle(.wooliPrimary)
        }
        .padding(Space.xxl)
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    LightDark {
        WooliEmptyState(symbol: "airplane", title: "Plan your first trip",
                        message: "Trips keeps your cities, tickets and plans in one place.",
                        actionTitle: "New trip") { }
    }
}
