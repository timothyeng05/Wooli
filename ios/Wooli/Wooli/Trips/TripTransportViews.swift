import SwiftUI
import MapKit

// MARK: - Ticket editor

/// The flight / train editor's ticket, styled like the travel cards between
/// legs: tap the codes or stations to pick them, tap a time to set it, and
/// type straight into the flight number and the stub's seat / booking /
/// terminal. Airline, title, flight time and arrival day fill themselves in.
struct TransportTicket: View {
    @Binding var transport: TripTransport
    @Binding var day: String?
    /// Clock times; nil = not set yet.
    @Binding var departure: Date?
    @Binding var arrival: Date?
    let days: [String]
    /// Where to search for each station: the leg you leave and the one you reach.
    let stationHints: (from: String, to: String)

    @State private var editingTime: End?

    enum End: Hashable { case from, to }

    static let night = Color(hex: "#050812")

    static func colors(for mode: TripTransport.Mode) -> [Color] {
        mode == .flight ? [Color(hex: "#334155"), Color(hex: "#2563eb")] : [Color(hex: "#2563eb"), Color(hex: "#0d9488")]
    }

    /// The transport as it would be saved, with the arrival day worked out.
    private var resolved: TripTransport {
        var t = transport
        t.arriveTime = arrival.map(TripTransport.minutes)
        return t.inferringArrivalDay(departDay: day, departTime: departure.map(TripTransport.minutes))
    }

    var body: some View {
        let t = resolved
        let duration = t.durationMinutes(departDay: day, departTime: departure.map(TripTransport.minutes))
        VStack(alignment: .leading, spacing: 0) {
            header
            HStack(spacing: 6) {
                endpoint(.from).frame(maxWidth: .infinity, alignment: .leading)
                routeGlyph
                endpoint(.to).frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.top, 16)
            HStack(alignment: .bottom, spacing: 6) {
                timeButton(.from, offset: 0).frame(maxWidth: .infinity, alignment: .leading)
                VStack(spacing: 2) {
                    Text(duration.map(TripTransport.durationText) ?? " ").font(.footnote.weight(.bold)).monospacedDigit()
                    if let km = t.distanceKm, km >= 1 {
                        Text("\(Int(km.rounded()).formatted()) km").font(.caption2).foregroundStyle(.white.opacity(0.65))
                    }
                }
                .frame(width: 96)
                .padding(.bottom, 4)
                timeButton(.to, offset: t.arriveDayOffset).frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.top, 16)
            perforation.padding(.top, 20)
            stub.padding(.vertical, 14)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .foregroundStyle(.white)
        .background(LinearGradient(colors: Self.colors(for: transport.mode), startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).strokeBorder(.white.opacity(0.18)))
        .shadow(color: Self.colors(for: transport.mode)[1].opacity(0.45), radius: 24, y: 12)
    }

    // MARK: Parts

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(transport.mode == .flight ? (resolved.airlineName ?? "Flight").uppercased() : "TRAIN")
                    .font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(.white.opacity(0.7))
                if transport.mode == .flight {
                    TextField("Flight number", text: $transport.flightNumber,
                              prompt: Text("CX831").foregroundStyle(.white.opacity(0.4)))
                        .font(.system(size: 26, weight: .heavy, design: .rounded))
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .frame(maxWidth: 170)
                }
            }
            Spacer(minLength: 8)
            Menu {
                Picker("Day", selection: $day) {
                    Text("Ideas · no day yet").tag(String?.none)
                    ForEach(Array(days.enumerated()), id: \.element) { i, d in
                        Text("Day \(i + 1) · \(DayKey.date(d).formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))")
                            .tag(String?.some(d))
                    }
                }
            } label: {
                Text(dayLabel).font(.caption.weight(.semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(.white.opacity(0.16), in: Capsule())
            }
        }
    }

    private var dayLabel: String {
        guard let day, let index = days.firstIndex(of: day) else { return "No day yet" }
        return "Day \(index + 1) · \(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))"
    }

    private func endpoint(_ end: End) -> some View {
        NavigationLink {
            if transport.mode == .flight {
                AirportSearchView(title: end == .from ? "Departing from" : "Arriving at") { picked in
                    if end == .from { transport.fromAirport = picked.code } else { transport.toAirport = picked.code }
                }
            } else {
                PlaceSearchView(near: end == .from ? stationHints.from : stationHints.to) { place in
                    if end == .from { transport.fromStation = place } else { transport.toStation = place }
                }
            }
        } label: {
            if transport.mode == .flight {
                airportLabel(end == .from ? transport.from : transport.to, end: end)
            } else {
                stationLabel(end == .from ? transport.fromStation : transport.toStation, end: end)
            }
        }
        .buttonStyle(.plain)
    }

    private func airportLabel(_ airport: Airport?, end: End) -> some View {
        VStack(alignment: end == .from ? .leading : .trailing, spacing: 3) {
            Text(airport?.code ?? "···")
                .font(.system(size: 44, weight: .black, design: .rounded))
                .foregroundStyle(.white.opacity(airport == nil ? 0.35 : 1))
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(airport?.place ?? (end == .from ? "From · tap" : "To · tap"))
                .font(.footnote).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
        }
    }

    private func stationLabel(_ station: TripPlace?, end: End) -> some View {
        Text(station?.name ?? (end == .from ? "From · tap" : "To · tap"))
            .font(.system(size: 22, weight: .heavy, design: .rounded))
            .foregroundStyle(.white.opacity(station == nil ? 0.4 : 1))
            .lineLimit(2).minimumScaleFactor(0.7)
            .multilineTextAlignment(end == .from ? .leading : .trailing)
    }

    private var routeGlyph: some View {
        HStack(spacing: 6) {
            dashes
            Image(systemName: transport.mode.symbol)
                .font(.subheadline.weight(.bold)).foregroundStyle(Self.colors(for: transport.mode)[1])
                .frame(width: 36, height: 36)
                .background(.white, in: Circle())
            dashes
        }
        .frame(width: 96)
    }

    private var dashes: some View {
        DashLine().stroke(.white.opacity(0.6), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [3, 4]))
            .frame(height: 2)
    }

    private func timeButton(_ end: End, offset: Int) -> some View {
        let date = end == .from ? departure : arrival
        return Button { editingTime = end } label: {
            VStack(alignment: end == .from ? .leading : .trailing, spacing: 2) {
                Text(end == .from ? "DEPARTS" : "ARRIVES")
                    .font(.caption2.weight(.bold)).tracking(1.1).foregroundStyle(.white.opacity(0.65))
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(date.map { TripTransport.timeText(TripTransport.minutes($0)) } ?? "--:--")
                        .font(.system(size: 24, weight: .bold)).monospacedDigit()
                        .foregroundStyle(.white.opacity(date == nil ? 0.35 : 1))
                    if offset > 0 && date != nil {
                        Text("+\(offset)").font(.caption.weight(.bold)).foregroundStyle(Color(hex: "#fde68a"))
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .popover(isPresented: Binding(get: { editingTime == end }, set: { if !$0 { editingTime = nil } })) {
            TimePickerPopover(title: end == .from ? "Departs" : "Arrives",
                              date: end == .from ? $departure : $arrival,
                              suggestion: end == .from ? nil : departure?.addingTimeInterval(2 * 3600))
        }
    }

    /// The tear line, with notches cut into both edges.
    private var perforation: some View {
        HStack(spacing: 0) {
            Circle().fill(Self.night).frame(width: 22, height: 22).offset(x: -11)
            DashLine().stroke(.white.opacity(0.3), style: StrokeStyle(lineWidth: 2, dash: [5, 5]))
                .frame(height: 2)
            Circle().fill(Self.night).frame(width: 22, height: 22).offset(x: 11)
        }
        .padding(.horizontal, -18)
    }

    private var stub: some View {
        HStack(spacing: 8) {
            stubField("SEAT", text: $transport.seats, prompt: transport.mode == .flight ? "14A" : "Car 7, 12A")
            stubField("BOOKING", text: $transport.confirmation, prompt: "ABC123")
            if transport.mode == .flight {
                stubBox(label: "TERMINAL", empty: transport.departTerminal.isEmpty && transport.arriveTerminal.isEmpty) {
                    HStack(spacing: 4) {
                        stubText($transport.departTerminal, prompt: "–")
                        Image(systemName: "arrow.right").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
                        stubText($transport.arriveTerminal, prompt: "–")
                    }
                }
            }
        }
    }

    private func stubField(_ label: String, text: Binding<String>, prompt: String) -> some View {
        stubBox(label: label, empty: text.wrappedValue.isEmpty) { stubText(text, prompt: prompt) }
    }

    private func stubText(_ text: Binding<String>, prompt: String) -> some View {
        TextField(prompt, text: text, prompt: Text(prompt).foregroundStyle(.white.opacity(0.4)))
            .font(.subheadline.weight(.bold))
            .textInputAutocapitalization(transport.mode == .flight ? .characters : .never)
            .autocorrectionDisabled()
    }

    private func stubBox<Content: View>(label: String, empty: Bool, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2.weight(.bold)).tracking(1.1).foregroundStyle(.white.opacity(0.65))
            content()
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(empty ? 0 : 0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            if empty {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(.white.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
            }
        }
    }
}

private struct DashLine: Shape {
    func path(in rect: CGRect) -> Path {
        Path { $0.move(to: CGPoint(x: 0, y: rect.midY)); $0.addLine(to: CGPoint(x: rect.maxX, y: rect.midY)) }
    }
}

/// Wheel time picker in a popover; changes apply as you scroll.
private struct TimePickerPopover: View {
    let title: String
    @Binding var date: Date?
    @State private var value: Date
    @Environment(\.dismiss) private var dismiss

    init(title: String, date: Binding<Date?>, suggestion: Date?) {
        self.title = title
        _date = date
        _value = State(initialValue: date.wrappedValue ?? suggestion ?? TripTransport.clock(12 * 60))
    }

    var body: some View {
        VStack(spacing: 8) {
            Text(title).font(.headline)
            DatePicker(title, selection: $value, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
            HStack {
                if date != nil {
                    Button("Clear", role: .destructive) {
                        date = nil
                        dismiss()
                    }
                }
                Spacer()
                Button("Done") {
                    date = value
                    dismiss()
                }
                .fontWeight(.semibold)
            }
        }
        .padding()
        .frame(width: 300)
        .onChange(of: value) { _, new in date = new }
        .presentationCompactAdaptation(.popover)
    }
}

// MARK: - Route backdrop

/// Behind the ticket: the globe for long flights, a dark Apple Map for
/// trains and short hops (the globe makes a short route look like a dot).
struct RouteBackdrop: View {
    let transport: TripTransport
    /// Where to face before both ends are picked (the trip's places).
    let focus: CLLocationCoordinate2D?

    var body: some View {
        let ends = transport.endPoints
        let accent = Color(hex: transport.mode == .flight ? "#60a5fa" : "#5eead4")
        if let a = ends.from, let b = ends.to, transport.mode == .train || (transport.distanceKm ?? 0) < 2000 {
            RouteMap(from: a, to: b, labels: ends.labels, accent: accent)
        } else {
            RouteGlobe(from: ends.from, to: ends.to,
                       focus: focus ?? CLLocationCoordinate2D(latitude: 20, longitude: 0),
                       fromLabel: ends.labels.from, toLabel: ends.labels.to, accent: accent)
        }
    }
}

private struct RouteMap: View {
    let from: CLLocationCoordinate2D
    let to: CLLocationCoordinate2D
    let labels: (from: String, to: String)
    let accent: Color

    var body: some View {
        Map(initialPosition: .automatic, interactionModes: []) {
            MapPolyline(coordinates: [from, to]).stroke(accent.opacity(0.35), lineWidth: 9)
            MapPolyline(coordinates: [from, to]).stroke(accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            Annotation(labels.from, coordinate: from) {
                Circle().fill(TransportTicket.night).frame(width: 12, height: 12)
                    .overlay(Circle().stroke(Color(white: 0.9), lineWidth: 3))
            }
            Annotation(labels.to, coordinate: to) {
                Circle().fill(accent).frame(width: 13, height: 13)
                    .overlay(Circle().stroke(.white, lineWidth: 2))
                    .background(Circle().fill(accent.opacity(0.35)).frame(width: 26, height: 26))
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
        .environment(\.colorScheme, .dark)
        // Keep the route clear of the toolbar above and the ticket below.
        .safeAreaPadding(EdgeInsets(top: 110, leading: 40, bottom: 110, trailing: 40))
        // Re-frame when an end changes; `initialPosition` only applies once.
        .id("\(from.latitude),\(from.longitude)-\(to.latitude),\(to.longitude)")
        .allowsHitTesting(false)
    }
}

extension TripTransport {
    /// "14:55" / "2:55 PM", following the phone's 12/24-hour setting.
    static func timeText(_ minutes: Int) -> String {
        clock(minutes).formatted(date: .omitted, time: .shortened)
    }

    /// Today at that many minutes after midnight, for time pickers.
    static func clock(_ minutes: Int) -> Date {
        Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: .now) ?? .now
    }

    static func minutes(_ date: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }

    /// Both ends on the map, with short labels ("JFK", "Tokyo Station").
    var endPoints: (from: CLLocationCoordinate2D?, to: CLLocationCoordinate2D?, labels: (from: String, to: String)) {
        switch mode {
        case .flight: (from?.coordinate, to?.coordinate, (fromAirport, toAirport))
        case .train: (fromStation?.coordinate, toStation?.coordinate, (fromStation?.name ?? "", toStation?.name ?? ""))
        }
    }
}

// MARK: - Airport search

struct AirportSearchView: View {
    let title: String
    let onPick: (Airport) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var searchFocused: Bool

    var body: some View {
        let results = Airports.search(query)
        List(results) { airport in
            Button {
                onPick(airport)
                dismiss()
            } label: {
                AirportLabel(airport: airport)
            }
        }
        .overlay {
            if query.isEmpty {
                ContentUnavailableView("Search airports", systemImage: "airplane.departure",
                                       description: Text("Type a code like HKG, a city, or an airport's name."))
            } else if results.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Code, city or airport")
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .searchFocused($searchFocused)
        .onAppear { searchFocused = true }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AirportLabel: View {
    let airport: Airport

    var body: some View {
        HStack(spacing: 12) {
            Text(airport.code)
                .font(.subheadline.weight(.heavy)).monospaced()
                .foregroundStyle(Theme.brand)
                .frame(width: 52, height: 34)
                .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                // "Hong Kong", not "Hong Kong, Hong Kong" (same for Singapore, Macao…).
                let country = Locale.current.localizedString(forRegionCode: airport.country)
                Text([airport.place, country == airport.place ? nil : country].compactMap { $0 }.joined(separator: ", "))
                    .font(.subheadline.weight(.medium)).foregroundStyle(Theme.text)
                Text(airport.name).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
        }
    }
}
