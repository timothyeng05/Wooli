import SwiftUI
import SwiftData

struct PeopleSettingsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Person.name) private var people: [Person]
    @State private var newPersonName = ""

    var body: some View {
        Form {
            Section("Household Members") {
                ForEach(people) { person in
                    NavigationLink {
                        PersonEditView(person: person)
                    } label: {
                        HStack {
                            Text(person.icon)
                            Text(person.name)
                        }
                    }
                }
                .onDelete { indices in
                    let accounts = (try? context.fetch(FetchDescriptor<LocalAccount>())) ?? []
                    for index in indices {
                        let person = people[index]
                        for account in accounts where account.ownerId == person.id { account.ownerId = nil }
                        context.delete(person)
                    }
                }
            }

            Section("Add Person") {
                HStack {
                    TextField("Name", text: $newPersonName)
                    Button("Add") {
                        let trimmed = newPersonName.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { return }
                        let person = Person(name: trimmed)
                        context.insert(person)
                        newPersonName = ""
                    }
                    .disabled(newPersonName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .navigationTitle("Household")
        .inlineNavigationTitle()
    }
}

struct PersonEditView: View {
    let person: Person
    @State private var name: String
    @State private var icon: String

    init(person: Person) {
        self.person = person
        self._name = State(initialValue: person.name)
        self._icon = State(initialValue: person.icon)
    }

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $name)
                HStack {
                    Text("Icon")
                    Spacer()
                    TextField("Emoji", text: $icon)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 50)
                }
            }
        }
        .navigationTitle("Edit Person")
        .inlineNavigationTitle()
        .onDisappear {
            person.name = name.trimmingCharacters(in: .whitespaces)
            person.icon = icon.isEmpty ? "👤" : String(icon.prefix(1))
        }
    }
}
