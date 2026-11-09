import SwiftUI

/// Category icons grouped by topic, with keyword search.
enum IconLibrary {
    struct Icon: Hashable {
        let emoji: String
        let keywords: String
    }

    struct Topic: Identifiable {
        let name: String
        let icons: [Icon]
        var id: String { name }
    }

    private static func t(_ name: String, _ items: [(String, String)]) -> Topic {
        Topic(name: name, icons: items.map { Icon(emoji: $0.0, keywords: $0.1) })
    }

    static let topics: [Topic] = [
        t("Food & Drink", [
            ("🍽️", "restaurants dining food eat out dinner"), ("🛒", "groceries supermarket grocery"),
            ("☕", "coffee cafe"), ("🥡", "takeout delivery"), ("🍕", "pizza fast food"), ("🍔", "burger fast food"),
            ("🌮", "tacos mexican"), ("🍣", "sushi japanese"), ("🍜", "noodles ramen asian"), ("🥗", "salad healthy lunch"),
            ("🥐", "bakery breakfast"), ("🍩", "snacks donut treats"), ("🧋", "boba tea drinks"), ("🍷", "wine alcohol"),
            ("🍺", "beer bar drinks alcohol"), ("🍸", "cocktails bar nightlife"), ("🧃", "drinks juice"), ("🍎", "produce fruit farmers market"),
        ]),
        t("Home", [
            ("🏠", "home house rent mortgage housing"), ("🏡", "house home mortgage"), ("🔑", "rent lease deposit"),
            ("💡", "utilities electric power light"), ("🔌", "utilities electric power internet"), ("📶", "internet wifi"),
            ("🔥", "gas heating utilities"), ("💧", "water utilities"), ("🗑️", "trash waste"),
            ("🧻", "home supplies household paper"), ("🧽", "cleaning supplies household"), ("🧴", "toiletries supplies household"),
            ("🧺", "laundry household"), ("🧹", "cleaning housekeeping"), ("🛋️", "furniture decor home goods"),
            ("🛏️", "bedding furniture"), ("🔨", "home improvement repairs tools hardware"), ("🪴", "plants garden"),
            ("🛠️", "maintenance repairs"), ("📦", "storage moving shipping"),
        ]),
        t("Transport", [
            ("🚇", "transit subway metro train"), ("🚌", "bus transit"), ("🚆", "train rail commuter"),
            ("🚕", "taxi cab"), ("🚗", "rideshare uber lyft car"), ("🚘", "car auto vehicle"), ("⛽", "gas fuel"),
            ("🅿️", "parking tolls"), ("🛣️", "tolls highway road"), ("🔧", "car maintenance repair"),
            ("🚲", "bike cycling citibike"), ("🛴", "scooter"), ("🚙", "car rental suv"), ("🪪", "license registration dmv"),
        ]),
        t("Travel", [
            ("✈️", "flights airfare travel"), ("🏨", "hotels lodging"), ("🏖️", "vacation beach holiday"),
            ("🧳", "travel luggage trip"), ("🗺️", "travel trip tourism"), ("🎟️", "tickets events attractions"),
            ("🏕️", "camping outdoors"), ("🚢", "cruise ferry"), ("🛂", "passport visa"),
        ]),
        t("Shopping", [
            ("🛍️", "shopping retail"), ("👗", "clothing apparel clothes"), ("👟", "shoes sneakers"),
            ("👜", "bags accessories"), ("💍", "jewelry"), ("📱", "phone electronics"), ("💻", "computer electronics software"),
            ("🎧", "headphones electronics audio"), ("📦", "amazon online orders packages"), ("🎁", "gifts presents"),
            ("🕶️", "accessories sunglasses"), ("⌚", "watch accessories"),
        ]),
        t("Health & Personal", [
            ("🏥", "medical hospital doctor health"), ("💊", "pharmacy medicine prescriptions"), ("🦷", "dentist dental"),
            ("👓", "vision eye glasses optometrist"), ("🧠", "therapy mental health"), ("💪", "fitness gym workout"),
            ("🧘", "yoga wellness"), ("💅", "personal care nails beauty"), ("💇", "hair salon haircut barber"),
            ("💄", "beauty makeup cosmetics"), ("🧼", "hygiene personal care"), ("🩺", "doctor checkup medical"),
        ]),
        t("Fun & Subscriptions", [
            ("🎬", "entertainment movies cinema"), ("📺", "streaming tv subscriptions"), ("🎵", "music spotify concerts"),
            ("🎮", "games gaming"), ("📚", "books reading"), ("📰", "news subscriptions magazines"),
            ("🎨", "hobbies art crafts"), ("⚽", "sports recreation"), ("🎳", "activities bowling"), ("🎤", "concerts events"),
            ("📱", "subscriptions apps phone"), ("☁️", "cloud storage subscriptions icloud"),
        ]),
        t("Family & Pets", [
            ("👶", "baby kids childcare"), ("🧸", "toys kids"), ("🎓", "education tuition school"), ("✏️", "school supplies"),
            ("🐾", "pets pet supplies"), ("🐶", "dog pet vet"), ("🐱", "cat pet"), ("👵", "family parents"),
            ("💝", "gifts family"), ("🎂", "birthday party celebrations"),
        ]),
        t("Money", [
            ("💵", "income salary paycheck cash"), ("💰", "savings money income"), ("💻", "freelance side income work"),
            ("📈", "investments stocks brokerage"), ("🏦", "bank banking"), ("💳", "credit card payment"),
            ("↔️", "transfer between accounts"), ("⚖️", "balance adjustments"), ("🧾", "bills receipts"),
            ("📋", "taxes tax"), ("💸", "fees bank fees charges"), ("🏛️", "government taxes"), ("🛡️", "insurance"),
            ("🤝", "loans lending"), ("❤️", "donations charity giving"), ("⛪", "church tithe donations"),
        ]),
        t("Other", [
            ("📌", "miscellaneous other"), ("📁", "other general"), ("❓", "unknown uncategorized"), ("⭐", "favorites special"),
            ("🏢", "work business office"), ("💼", "business work expenses"), ("📮", "postage mail shipping"),
            ("🔒", "security"), ("🌍", "international foreign"), ("🎯", "goals"),
        ]),
    ]

    static let all: [Icon] = {
        var seen = Set<String>()
        return topics.flatMap(\.icons).filter { seen.insert($0.emoji).inserted }
    }()

    /// Icons whose keywords match any word in `name`.
    static func suggestions(for name: String) -> [String] {
        let words = name.lowercased().split { !$0.isLetter }.map(String.init).filter { $0.count > 2 }
        guard !words.isEmpty else { return [] }
        var seen = Set<String>()
        return all.filter { icon in words.contains { icon.keywords.contains($0) } }
            .map(\.emoji).filter { seen.insert($0).inserted }
            .prefix(16).map { $0 }
    }
}

struct IconPickerView: View {
    @Binding var selection: String
    let categoryName: String
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var custom = ""

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)

    var body: some View {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        let suggested = IconLibrary.suggestions(for: categoryName)

        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if !query.isEmpty {
                    let results = IconLibrary.all.filter { $0.keywords.contains(query) }.map(\.emoji)
                    if results.isEmpty {
                        Text("No icons for \"\(search)\". You can type any emoji below.")
                            .font(.subheadline).foregroundStyle(Theme.textSecondary)
                    } else {
                        grid(title: "Results", emojis: results)
                    }
                } else {
                    if !suggested.isEmpty {
                        grid(title: "Suggested for \(categoryName)", emojis: suggested)
                    }
                    ForEach(IconLibrary.topics) { topic in
                        grid(title: topic.name, emojis: topic.icons.map(\.emoji))
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel("Any emoji")
                    TextField("Type or paste an emoji", text: $custom)
                        .padding(12)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border))
                        .onChange(of: custom) { _, new in
                            guard let last = new.last, last.unicodeScalars.contains(where: { $0.properties.isEmojiPresentation || $0.properties.isEmoji && $0.value > 0xFF })
                            else { return }
                            selection = String(last)
                            dismiss()
                        }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .searchable(text: $search, placement: .wooliAlwaysVisible, prompt: "Search icons (e.g. wifi, supplies)")
        .navigationTitle("Icon")
        .inlineNavigationTitle()
    }

    private func grid(title: String, emojis: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(title)
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(emojis, id: \.self) { e in
                    Button {
                        selection = e
                        dismiss()
                    } label: {
                        Text(e).font(.system(size: 26))
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(selection == e ? Theme.brandSoft : Theme.card,
                                        in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .strokeBorder(selection == e ? Theme.brand : Theme.border, lineWidth: selection == e ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(e)
                    .accessibilityAddTraits(selection == e ? .isSelected : [])
                }
            }
        }
    }
}
