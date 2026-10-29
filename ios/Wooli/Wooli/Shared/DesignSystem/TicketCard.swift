import SwiftUI

struct TicketRowData: Identifiable {
    let id = UUID()
    let symbol: String
    let title: String
    var detail: String?
}

/// The Trips boarding pass: a navy-to-blue card with notched sides, white text and darkened inset rows.
/// For journeys only (Trips, transport); everything else uses `HeroCard`, `CinemaStub` or `DepartureBoard`.
struct TicketCard<Content: View>: View {
    let eyebrow: String
    var meta: String?
    var rows: [TicketRowData] = []
    @ViewBuilder var content: Content

    private let notch: CGFloat = 18

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text(eyebrow).wooliFont(.eyebrow).foregroundStyle(Theme.ticketHighlight)
            content
            if let meta { Text(meta).font(.footnote) }
            if !rows.isEmpty { panel }
        }
        .foregroundStyle(Theme.onTicket)
        .padding(Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [Theme.ticketStart, Theme.ticketEnd], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
        )
        // Notches are cut in the page background, at mid-height on both sides.
        .overlay(alignment: .leading) {
            Circle().fill(Theme.background).frame(width: notch, height: notch).offset(x: -notch / 2)
        }
        .overlay(alignment: .trailing) {
            Circle().fill(Theme.background).frame(width: notch, height: notch).offset(x: notch / 2)
        }
        .shadow(color: Theme.ticketShadow, radius: 10, y: 5)
    }

    private var panel: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 { Rectangle().fill(Theme.ticketRule).frame(height: 1) }
                HStack(spacing: Space.m) {
                    Image(systemName: row.symbol)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.ticketStart)
                        .frame(width: 26, height: 26)
                        .background(Theme.onTicket, in: Circle())
                        .accessibilityHidden(true)
                    Text(row.title).font(.subheadline.weight(.semibold))
                    Spacer(minLength: Space.s)
                    if let detail = row.detail { Text(detail).font(.subheadline).monospacedDigit() }
                }
                .padding(.vertical, Space.s)
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.horizontal, Space.m)
        .background(Theme.ticketPanel, in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
    }
}

#Preview {
    LightDark {
        TicketCard(eyebrow: "Next up · Fri, May 29", meta: "Terminal 4 · Gate B22 · Seat 34A", rows: [
            TicketRowData(symbol: "airplane.departure", title: "JFK", detail: "21:05"),
            TicketRowData(symbol: "airplane.arrival", title: "HND", detail: "+1 · 00:40"),
        ]) {
            HStack {
                Text("JFK").wooliFont(.code)
                Image(systemName: "airplane")
                Text("HND").wooliFont(.code)
            }
        }
    }
}
