// Sample data for the web demo. Everything here is made up; it follows the
// design system's reference screens (ios/Wooli/DesignSystem/reference).

export type AppId = "today" | "trips" | "eats" | "movies" | "recipes" | "budget";

export const APPS: { id: AppId; name: string; line: string }[] = [
  { id: "today", name: "Today", line: "What's next, from every app" },
  { id: "trips", name: "Trips", line: "Plan a trip day by day" },
  { id: "eats", name: "Eats", line: "Rank every place you eat" },
  { id: "movies", name: "Movies", line: "Rank every film you see" },
  { id: "recipes", name: "Recipes", line: "Recipes from reels" },
  { id: "budget", name: "Budget", line: "Plan each month" },
];

export type Kind = "transit" | "stay" | "meal" | "activity" | "note";
export type Plan = { time: string; kind: Kind; title: string; sub: string };
export type Day = { label: string; plans: Plan[] };
export type City = { id: string; name: string; dates: string; nights: number; x: number; y: number; days: Day[] };
export type Booking = { kind: Kind; what: string; when: string; ref: string; status: "Confirmed" | "Pending" | "Paid" };
export type Trip = {
  id: string;
  name: string;
  dates: string;
  countdown: string;
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  flight: string;
  times: string;
  people: string[];
  cities: City[];
  ideas: { title: string; sub: string; kind: Kind }[];
  bookings: Booking[];
};

export const TRIPS: Trip[] = [
  {
    id: "portugal",
    name: "Lisbon & Porto",
    dates: "Nov 13 – 20",
    countdown: "in 16 days",
    from: "JFK",
    fromCity: "New York",
    to: "LIS",
    toCity: "Lisbon",
    flight: "TP 210",
    times: "19:40 → 07:25 +1",
    people: ["MJ", "TE"],
    cities: [
      {
        id: "lisbon",
        name: "Lisbon",
        dates: "Nov 13 – 17",
        nights: 4,
        x: 34,
        y: 78,
        days: [
          {
            label: "Fri, Nov 13",
            plans: [
              { time: "07:25", kind: "transit", title: "Land in Lisbon", sub: "Humberto Delgado Airport · TP 210" },
              { time: "10:00", kind: "stay", title: "Check in", sub: "Casa do Príncipe · 4 nights" },
              { time: "13:00", kind: "meal", title: "Taberna da Rua das Flores", sub: "Petiscos · Chiado" },
              { time: "17:30", kind: "activity", title: "Miradouro da Graça", sub: "Sunset over the river" },
            ],
          },
          {
            label: "Sat, Nov 14",
            plans: [
              { time: "09:30", kind: "transit", title: "Tram 28", sub: "From Martim Moniz, early to beat the line" },
              { time: "11:00", kind: "activity", title: "Jerónimos Monastery", sub: "Belém · tickets on the day" },
              { time: "12:30", kind: "meal", title: "Pastéis de Belém", sub: "Bakery · Belém" },
              { time: "20:00", kind: "meal", title: "A Cevicheria", sub: "Peruvian · Príncipe Real" },
            ],
          },
          {
            label: "Sun, Nov 15",
            plans: [
              { time: "10:00", kind: "activity", title: "Day trip to Sintra", sub: "Pena Palace, then Quinta da Regaleira" },
              { time: "19:30", kind: "meal", title: "Time Out Market", sub: "Food hall · Cais do Sodré" },
            ],
          },
          {
            label: "Mon, Nov 16",
            plans: [
              { time: "10:30", kind: "activity", title: "Gulbenkian Museum", sub: "And the garden" },
              { time: "", kind: "note", title: "Pack tonight", sub: "Early train tomorrow" },
            ],
          },
        ],
      },
      {
        id: "porto",
        name: "Porto",
        dates: "Nov 17 – 20",
        nights: 3,
        x: 46,
        y: 22,
        days: [
          {
            label: "Tue, Nov 17",
            plans: [
              { time: "09:39", kind: "transit", title: "Alfa Pendular to Porto", sub: "Car 4 · Seats 41, 42 · 2h 50m" },
              { time: "13:30", kind: "stay", title: "Check in", sub: "Torel Avantgarde · 3 nights" },
              { time: "16:00", kind: "activity", title: "Livraria Lello", sub: "Book the 4 pm slot" },
            ],
          },
          {
            label: "Wed, Nov 18",
            plans: [
              { time: "10:00", kind: "activity", title: "Walk the Ribeira", sub: "Then across Dom Luís I bridge" },
              { time: "13:00", kind: "meal", title: "Cantinho do Avillez", sub: "Portuguese · Baixa" },
              { time: "20:00", kind: "meal", title: "Majestic Café", sub: "Café · Santa Catarina" },
            ],
          },
          {
            label: "Fri, Nov 20",
            plans: [{ time: "11:15", kind: "transit", title: "Fly home", sub: "OPO → JFK · TP 1953 via LIS" }],
          },
        ],
      },
    ],
    ideas: [
      { title: "Oceanário de Lisboa", sub: "From Sights · Parque das Nações", kind: "activity" },
      { title: "Marisqueira Azul", sub: "From Eats · Want to try", kind: "meal" },
      { title: "Fado night in Alfama", sub: "Saved from a reel", kind: "activity" },
      { title: "Serralves Museum", sub: "From Sights · Porto", kind: "activity" },
    ],
    bookings: [
      { kind: "transit", what: "TP 210 · JFK → LIS", when: "Thu, Nov 12 · 19:40", ref: "K7QW2M", status: "Confirmed" },
      { kind: "stay", what: "Casa do Príncipe", when: "Nov 13 – 17 · 4 nights", ref: "HB-48213", status: "Paid" },
      { kind: "transit", what: "Alfa Pendular · LIS → OPO", when: "Tue, Nov 17 · 09:39", ref: "CP 9QX41", status: "Confirmed" },
      { kind: "stay", what: "Torel Avantgarde", when: "Nov 17 – 20 · 3 nights", ref: "TA-55102", status: "Pending" },
      { kind: "transit", what: "TP 1953 · OPO → JFK", when: "Fri, Nov 20 · 11:15", ref: "K7QW2M", status: "Confirmed" },
    ],
  },
  {
    id: "japan",
    name: "Kyoto in spring",
    dates: "Apr 2 – 9",
    countdown: "in 4 months",
    from: "JFK",
    fromCity: "New York",
    to: "KIX",
    toCity: "Osaka",
    flight: "JL 5",
    times: "13:25 → 17:05 +1",
    people: ["TE"],
    cities: [
      {
        id: "kyoto",
        name: "Kyoto",
        dates: "Apr 2 – 6",
        nights: 4,
        x: 55,
        y: 40,
        days: [
          {
            label: "Fri, Apr 3",
            plans: [
              { time: "06:30", kind: "activity", title: "Fushimi Inari", sub: "Before the crowds" },
              { time: "12:00", kind: "meal", title: "Honke Owariya", sub: "Soba · since 1465" },
              { time: "17:00", kind: "activity", title: "Philosopher's Path", sub: "Cherry blossoms" },
            ],
          },
        ],
      },
      {
        id: "osaka",
        name: "Osaka",
        dates: "Apr 6 – 9",
        nights: 3,
        x: 40,
        y: 64,
        days: [
          {
            label: "Mon, Apr 6",
            plans: [
              { time: "10:12", kind: "transit", title: "Shinkansen to Shin-Osaka", sub: "Hikari 503 · Car 7" },
              { time: "19:00", kind: "meal", title: "Dotonbori street food", sub: "Takoyaki crawl" },
            ],
          },
        ],
      },
    ],
    ideas: [{ title: "teamLab Botanical Garden", sub: "From Sights · Osaka", kind: "activity" }],
    bookings: [{ kind: "transit", what: "JL 5 · JFK → KIX", when: "Thu, Apr 2 · 13:25", ref: "JX2L9P", status: "Confirmed" }],
  },
];

export type Place = {
  id: string;
  name: string;
  cuisine: string;
  area: string;
  price: string;
  emoji: string;
  note: string;
  visits: { date: string; who: string; ate: string }[];
};

export const BEEN: Place[] = [
  { id: "carota", name: "Via Carota", cuisine: "Italian", area: "West Village", price: "$$$", emoji: "🍝", note: "The cacio e pepe and the green salad. Walk-in only, go at 5.", visits: [{ date: "Sep 30", who: "with Maya", ate: "Cacio e pepe, svizzerina" }] },
  { id: "tgourmet", name: "Taiwanese Gourmet", cuisine: "Taiwanese", area: "Elmhurst", price: "$", emoji: "🥟", note: "Three-cup chicken. Cash only.", visits: [{ date: "Aug 18", who: "just you", ate: "Three-cup chicken, oyster omelette" }] },
  { id: "lucali", name: "Lucali", cuisine: "Pizza", area: "Carroll Gardens", price: "$$", emoji: "🍕", note: "Get the calzone. Line starts at 5.", visits: [{ date: "Oct 24", who: "with Maya", ate: "Calzone, plain pie" }, { date: "Jun 2", who: "just you", ate: "Pepperoni pie" }] },
  { id: "katz", name: "Katz's Delicatessen", cuisine: "Deli", area: "Lower East Side", price: "$$", emoji: "🥪", note: "Pastrami on rye, tip the cutter.", visits: [{ date: "Jul 7", who: "with Sam", ate: "Pastrami, matzo ball soup" }] },
  { id: "xian", name: "Xi'an Famous Foods", cuisine: "Chinese", area: "Chinatown", price: "$", emoji: "🌶️", note: "Spicy cumin lamb noodles, extra spicy.", visits: [{ date: "Oct 2", who: "just you", ate: "Cumin lamb noodles" }] },
  { id: "russ", name: "Russ & Daughters Cafe", cuisine: "Jewish deli", area: "Lower East Side", price: "$$", emoji: "🥯", note: "Super Heebster on a bagel.", visits: [{ date: "May 12", who: "with Mom", ate: "Super Heebster, latkes" }] },
  { id: "timeout", name: "Time Out Market", cuisine: "Food hall", area: "Lisbon", price: "$$", emoji: "🍤", note: "Go hungry and split everything.", visits: [{ date: "Mar 3", who: "with Maya", ate: "Bifana, prawns" }] },
];

export const NEW_PLACE: Place = {
  id: "una",
  name: "Una Pizza Napoletana",
  cuisine: "Pizza",
  area: "Lower East Side",
  price: "$$",
  emoji: "🍕",
  note: "Just added. Rank it to place it on your list.",
  visits: [{ date: "Today", who: "with Maya", ate: "Margherita, filetti" }],
};

export const WANT: { name: string; cuisine: string; area: string; from: string }[] = [
  { name: "Thai Diner", cuisine: "Thai", area: "Nolita", from: "Saved from a reel" },
  { name: "Dhamaka", cuisine: "Indian", area: "Lower East Side", from: "Maya's list" },
  { name: "Marisqueira Azul", cuisine: "Seafood", area: "Lisbon", from: "On your Lisbon trip" },
  { name: "Golden Diner", cuisine: "Diner", area: "Two Bridges", from: "Saved from a reel" },
];

export type Movie = { title: string; year: number; genre: string; director: string; feel: "Loved" | "Liked" | "Fine"; seen: string };
export const MOVIES: Movie[] = [
  { title: "Past Lives", year: 2023, genre: "Drama", director: "Celine Song", feel: "Loved", seen: "Jun 2023" },
  { title: "Spirited Away", year: 2001, genre: "Animation", director: "Hayao Miyazaki", feel: "Loved", seen: "Jan 2024" },
  { title: "Paddington 2", year: 2017, genre: "Comedy", director: "Paul King", feel: "Loved", seen: "Dec 2023" },
  { title: "Arrival", year: 2016, genre: "Sci-fi", director: "Denis Villeneuve", feel: "Loved", seen: "Mar 2024" },
  { title: "Ratatouille", year: 2007, genre: "Animation", director: "Brad Bird", feel: "Liked", seen: "Feb 2024" },
  { title: "Dune: Part Two", year: 2024, genre: "Sci-fi", director: "Denis Villeneuve", feel: "Liked", seen: "Mar 2024" },
  { title: "The Grand Budapest Hotel", year: 2014, genre: "Comedy", director: "Wes Anderson", feel: "Liked", seen: "Aug 2024" },
  { title: "Chef", year: 2014, genre: "Comedy", director: "Jon Favreau", feel: "Fine", seen: "Sep 2024" },
];

export type Recipe = {
  id: string;
  name: string;
  emoji: string;
  meal: string;
  mins: number;
  from: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
};
export const RECIPES: Recipe[] = [
  {
    id: "cacio",
    name: "Cacio e pepe",
    emoji: "🍝",
    meal: "Dinner",
    mins: 20,
    from: "From Rome · June 2025",
    ingredients: [
      { name: "Tonnarelli", amount: "200 g" },
      { name: "Pecorino Romano", amount: "80 g, finely grated" },
      { name: "Black pepper", amount: "2 tsp, coarsely cracked" },
      { name: "Salt", amount: "for the water" },
    ],
    steps: [
      "Toast the pepper in a dry pan until fragrant.",
      "Cook the pasta in less water than usual, so it's starchy.",
      "Whisk the cheese with a ladle of pasta water into a paste.",
      "Toss the pasta with the pepper, then the paste, off the heat.",
      "Loosen with pasta water until glossy. No cream.",
    ],
  },
  {
    id: "salmon",
    name: "Miso-glazed salmon",
    emoji: "🐟",
    meal: "Dinner",
    mins: 25,
    from: "Saved from a reel",
    ingredients: [
      { name: "Salmon fillets", amount: "2" },
      { name: "White miso", amount: "2 tbsp" },
      { name: "Maple syrup", amount: "1 tbsp" },
      { name: "Rice vinegar", amount: "1 tsp" },
    ],
    steps: ["Mix miso, maple and vinegar.", "Brush over the salmon.", "Broil 8 minutes until caramelised.", "Serve over rice with scallions."],
  },
  {
    id: "shakshuka",
    name: "Shakshuka",
    emoji: "🍳",
    meal: "Breakfast",
    mins: 30,
    from: "Saved from a reel",
    ingredients: [
      { name: "Eggs", amount: "4" },
      { name: "Crushed tomatoes", amount: "1 can" },
      { name: "Red pepper", amount: "1, sliced" },
      { name: "Cumin and paprika", amount: "1 tsp each" },
    ],
    steps: ["Soften the pepper and onion.", "Add spices, then tomatoes; simmer 10 minutes.", "Make wells and crack in the eggs.", "Cover until the whites set."],
  },
  {
    id: "dumplings",
    name: "Pork & chive dumplings",
    emoji: "🥟",
    meal: "Lunch",
    mins: 60,
    from: "From Grandma",
    ingredients: [
      { name: "Ground pork", amount: "500 g" },
      { name: "Garlic chives", amount: "1 bunch" },
      { name: "Wrappers", amount: "50" },
      { name: "Soy, sesame oil, ginger", amount: "to taste" },
    ],
    steps: ["Mix the filling one direction until sticky.", "Fold and pleat.", "Pan-fry, then steam with a splash of water.", "Uncover and crisp the bottoms."],
  },
  {
    id: "granola",
    name: "Olive oil granola",
    emoji: "🥣",
    meal: "Breakfast",
    mins: 45,
    from: "Saved from a reel",
    ingredients: [
      { name: "Oats", amount: "3 cups" },
      { name: "Olive oil", amount: "½ cup" },
      { name: "Maple syrup", amount: "½ cup" },
      { name: "Pecans", amount: "1 cup" },
    ],
    steps: ["Toss everything together.", "Spread thin on a tray.", "Bake at 300°F for 40 minutes, stirring once.", "Cool completely before breaking up."],
  },
  {
    id: "salad",
    name: "Smashed cucumber salad",
    emoji: "🥒",
    meal: "Lunch",
    mins: 10,
    from: "Saved from a reel",
    ingredients: [
      { name: "Cucumbers", amount: "2" },
      { name: "Black vinegar", amount: "1 tbsp" },
      { name: "Chili crisp", amount: "1 tbsp" },
      { name: "Garlic", amount: "2 cloves" },
    ],
    steps: ["Smash and chop the cucumbers.", "Salt and drain 10 minutes.", "Toss with dressing and serve cold."],
  },
];

export type Category = { id: string; name: string; emoji: string; group: "food" | "home" | "travel" | "fun" | "shopping" | "health"; plan: number; spent: number; last: number };
export const CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", emoji: "🛒", group: "food", plan: 550, spent: 288, last: 412 },
  { id: "dining", name: "Food & dining", emoji: "🍽️", group: "food", plan: 880, spent: 412, last: 655 },
  { id: "coffee", name: "Coffee", emoji: "☕", group: "food", plan: 80, spent: 31, last: 58 },
  { id: "rent", name: "Rent", emoji: "🏠", group: "home", plan: 1900, spent: 1900, last: 1900 },
  { id: "transport", name: "Transport", emoji: "🚇", group: "travel", plan: 160, spent: 66, last: 132 },
  { id: "subs", name: "Subscriptions", emoji: "📺", group: "fun", plan: 60, spent: 47, last: 47 },
  { id: "shopping", name: "Shopping", emoji: "🛍️", group: "shopping", plan: 400, spent: 104, last: 301 },
  { id: "fitness", name: "Fitness", emoji: "🏋️", group: "health", plan: 120, spent: 45, last: 90 },
];

export type Txn = { id: string; payee: string; amount: number; date: string; account: string; category?: string; suggestion?: string };
export const REVIEW: Txn[] = [
  { id: "r1", payee: "Blue Bottle Coffee", amount: -6.5, date: "Oct 21", account: "Chase", suggestion: "coffee" },
  { id: "r2", payee: "SQ *Corner Deli", amount: -14.2, date: "Oct 21", account: "Amex" },
  { id: "r3", payee: "Trader Joe's #540", amount: -62.18, date: "Oct 20", account: "Chase", suggestion: "groceries" },
  { id: "r4", payee: "MTA*NYCT PAYGO", amount: -2.9, date: "Oct 20", account: "Citi", suggestion: "transport" },
  { id: "r5", payee: "UNIQLO SOHO", amount: -39.9, date: "Oct 19", account: "Amex", suggestion: "shopping" },
];
export const POSTED: Txn[] = [
  { id: "p1", payee: "Spotify", amount: -11.99, date: "Oct 19", account: "Citi", category: "subs" },
  { id: "p2", payee: "Lucali", amount: -78.0, date: "Oct 18", account: "Amex", category: "dining" },
  { id: "p3", payee: "Payroll", amount: 3240.0, date: "Oct 15", account: "Chase", category: "income" },
  { id: "p4", payee: "Whole Foods", amount: -84.31, date: "Oct 14", account: "Chase", category: "groceries" },
  { id: "p5", payee: "Climbing gym", amount: -45.0, date: "Oct 12", account: "Citi", category: "fitness" },
  { id: "p6", payee: "Rent · Oct", amount: -1900.0, date: "Oct 1", account: "Chase", category: "rent" },
];

export const ACCOUNTS = [
  { name: "Chase Checking", kind: "Checking", balance: 4820.12, logo: "/logos/chase.png" },
  { name: "Amex Gold", kind: "Credit card", balance: -612.4, logo: "/logos/amex.jpeg" },
  { name: "Citi Premier", kind: "Credit card", balance: -233.87, logo: "/logos/citi.png" },
  { name: "Fidelity 401(k)", kind: "Retirement", balance: 48210.55, logo: "/logos/fidelity.jpeg" },
];
