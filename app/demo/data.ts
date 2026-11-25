// Sample data for the web demo. Everything here follows the
// Wooli Mac app design system and actual app screens.

export type AppId = "today" | "budget" | "sights" | "trips" | "eats" | "movies" | "recipes";

export const APPS: { id: AppId; name: string; line: string }[] = [
  { id: "today", name: "Today", line: "What's next, from every app" },
  { id: "budget", name: "Budget", line: "Plan each month & forecast net worth" },
  { id: "sights", name: "Sights", line: "Save places you want to see" },
  { id: "trips", name: "Trips", line: "Plan a trip day by day" },
  { id: "eats", name: "Eats", line: "Rank every place you eat" },
  { id: "movies", name: "Movies", line: "Rank every film you see" },
  { id: "recipes", name: "Recipes", line: "Recipes from reels" },
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
    id: "spain",
    name: "Spain 2026",
    dates: "Dec 24 – Jan 4",
    countdown: "in 29 days",
    from: "JFK",
    fromCity: "New York",
    to: "MAD",
    toCity: "Madrid",
    flight: "DL 126",
    times: "19:30 → 08:55 +1",
    people: ["Me", "Sam"],
    cities: [
      {
        id: "madrid",
        name: "Madrid",
        dates: "Dec 25 – 29",
        nights: 4,
        x: 38,
        y: 65,
        days: [
          {
            label: "Fri, Dec 25",
            plans: [
              { time: "08:55", kind: "transit", title: "Land in Madrid Barajas", sub: "Terminal 4S · DL 126" },
              { time: "11:00", kind: "stay", title: "Check in", sub: "Barrio de Salamanca · 4 nights" },
              { time: "13:30", kind: "meal", title: "Mercado de San Miguel", sub: "Tapas crawl · Centro" },
              { time: "17:00", kind: "activity", title: "El Retiro Park & Crystal Palace", sub: "Afternoon walk" },
            ],
          },
          {
            label: "Sat, Dec 26",
            plans: [
              { time: "10:30", kind: "activity", title: "Prado Museum", sub: "Velázquez & Goya collections" },
              { time: "13:00", kind: "meal", title: "Casa Dani", sub: "Tortilla de patatas · Mercado de la Paz" },
              { time: "16:00", kind: "activity", title: "Sézane Madrid Flagship", sub: "Calle de Claudio Coello" },
            ],
          },
        ],
      },
      {
        id: "seville",
        name: "Seville",
        dates: "Dec 29 – Jan 1",
        nights: 3,
        x: 32,
        y: 82,
        days: [
          {
            label: "Tue, Dec 29",
            plans: [
              { time: "10:05", kind: "transit", title: "Renfe AVE to Seville Santa Justa", sub: "Coach 3 · 2h 35m" },
              { time: "13:00", kind: "meal", title: "Eslava", sub: "Tapas · San Lorenzo" },
              { time: "16:30", kind: "activity", title: "Royal Alcázar of Seville", sub: "Gardens & palace" },
            ],
          },
        ],
      },
      {
        id: "barcelona",
        name: "Barcelona",
        dates: "Jan 1 – 4",
        nights: 3,
        x: 68,
        y: 42,
        days: [
          {
            label: "Fri, Jan 1",
            plans: [
              { time: "11:20", kind: "transit", title: "Vueling SVQ → BCN", sub: "Flight VY 2214" },
              { time: "16:00", kind: "activity", title: "Sagrada Família", sub: "Late afternoon light through stained glass" },
              { time: "20:30", kind: "meal", title: "Bar Cañete", sub: "Tapas · El Raval" },
            ],
          },
          {
            label: "Mon, Jan 4",
            plans: [{ time: "12:15", kind: "transit", title: "Fly home BCN → JFK", sub: "DL 169 · Nonstop" }],
          },
        ],
      },
    ],
    ideas: [
      { title: "Sézane Madrid", sub: "From Sights · Salamanca", kind: "activity" },
      { title: "Bar Mut", sub: "From Eats · Barcelona want to try", kind: "meal" },
      { title: "Park Güell", sub: "From Sights · Barcelona", kind: "activity" },
    ],
    bookings: [
      { kind: "transit", what: "DL 126 · JFK → MAD", when: "Thu, Dec 24 · 19:30", ref: "DL-938201", status: "Confirmed" },
      { kind: "stay", what: "Madrid Salamanca Suite", when: "Dec 25 – 29 · 4 nights", ref: "AB-29401", status: "Paid" },
      { kind: "transit", what: "Renfe AVE · MAD → SVQ", when: "Tue, Dec 29 · 10:05", ref: "RF-88219", status: "Confirmed" },
      { kind: "transit", what: "DL 169 · BCN → JFK", when: "Mon, Jan 4 · 12:15", ref: "DL-938201", status: "Confirmed" },
    ],
  },
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
    people: ["Me", "Sam"],
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
            ],
          },
        ],
      },
    ],
    ideas: [
      { title: "Oceanário de Lisboa", sub: "From Sights · Parque das Nações", kind: "activity" },
      { title: "Marisqueira Azul", sub: "From Eats · Want to try", kind: "meal" },
    ],
    bookings: [
      { kind: "transit", what: "TP 210 · JFK → LIS", when: "Thu, Nov 12 · 19:40", ref: "K7QW2M", status: "Confirmed" },
      { kind: "stay", what: "Casa do Príncipe", when: "Nov 13 – 17 · 4 nights", ref: "HB-48213", status: "Paid" },
    ],
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
  { id: "jua", name: "JUA", cuisine: "Korean wood-fired", area: "Flatiron", price: "$$$$", emoji: "🥩", note: "Your #1 place. 7-course wood-fired tasting menu. Jopers steak and caviar.", visits: [{ date: "Nov 12", who: "with Sam", ate: "Tasting menu, caviar tart, galbi" }] },
  { id: "carota", name: "Via Carota", cuisine: "Italian", area: "West Village", price: "$$$", emoji: "🍝", note: "The cacio e pepe and the green salad. Walk-in only, go at 5.", visits: [{ date: "Sep 30", who: "with Sam", ate: "Cacio e pepe, svizzerina" }] },
  { id: "lucali", name: "Lucali", cuisine: "Pizza", area: "Carroll Gardens", price: "$$", emoji: "🍕", note: "Get the calzone. Line starts at 5.", visits: [{ date: "Oct 24", who: "with Sam", ate: "Calzone, plain pie" }, { date: "Jun 2", who: "just you", ate: "Pepperoni pie" }] },
  { id: "tgourmet", name: "Taiwanese Gourmet", cuisine: "Taiwanese", area: "Elmhurst", price: "$", emoji: "🥟", note: "Three-cup chicken. Cash only.", visits: [{ date: "Aug 18", who: "just you", ate: "Three-cup chicken, oyster omelette" }] },
  { id: "katz", name: "Katz's Delicatessen", cuisine: "Deli", area: "Lower East Side", price: "$$", emoji: "🥪", note: "Pastrami on rye, tip the cutter.", visits: [{ date: "Jul 7", who: "with Sam", ate: "Pastrami, matzo ball soup" }] },
  { id: "xian", name: "Xi'an Famous Foods", cuisine: "Chinese", area: "Chinatown", price: "$", emoji: "🌶️", note: "Spicy cumin lamb noodles, extra spicy.", visits: [{ date: "Oct 2", who: "just you", ate: "Cumin lamb noodles" }] },
  { id: "russ", name: "Russ & Daughters Cafe", cuisine: "Jewish deli", area: "Lower East Side", price: "$$", emoji: "🥯", note: "Super Heebster on a bagel.", visits: [{ date: "May 12", who: "with Mom", ate: "Super Heebster, latkes" }] },
  { id: "timeout", name: "Time Out Market", cuisine: "Food hall", area: "Lisbon", price: "$$", emoji: "🍤", note: "Go hungry and split everything.", visits: [{ date: "Mar 3", who: "with Sam", ate: "Bifana, prawns" }] },
];

export const NEW_PLACE: Place = {
  id: "una",
  name: "Una Pizza Napoletana",
  cuisine: "Pizza",
  area: "Lower East Side",
  price: "$$",
  emoji: "🍕",
  note: "Just added. Rank it to place it on your list.",
  visits: [{ date: "Today", who: "with Sam", ate: "Margherita, filetti" }],
};

export const WANT: { name: string; cuisine: string; area: string; from: string }[] = [
  { name: "Thai Diner", cuisine: "Thai", area: "Nolita", from: "Saved from a reel" },
  { name: "Dhamaka", cuisine: "Indian", area: "Lower East Side", from: "Sam's list" },
  { name: "Marisqueira Azul", cuisine: "Seafood", area: "Lisbon", from: "On your Lisbon trip" },
  { name: "Golden Diner", cuisine: "Diner", area: "Two Bridges", from: "Saved from a reel" },
];

export type Sight = {
  id: string;
  name: string;
  city: string;
  category: string;
  visited: boolean;
  notes: string;
  lat: number;
  lng: number;
};

export const SIGHTS: Sight[] = [
  { id: "sezane", name: "Sézane Madrid", city: "Madrid", category: "Flagship & Boutique", visited: false, notes: "Calle de Claudio Coello · Next to see on Spain 2026 trip", lat: 40.428, lng: -3.687 },
  { id: "prado", name: "Prado Museum", city: "Madrid", category: "Art Museum", visited: false, notes: "Velázquez and Goya collections. Reserve morning slot.", lat: 40.4138, lng: -3.6921 },
  { id: "retiro", name: "El Retiro Park", city: "Madrid", category: "City Park & Gardens", visited: false, notes: "Crystal Palace and boat row at the pond.", lat: 40.4153, lng: -3.6845 },
  { id: "jeronimos", name: "Jerónimos Monastery", city: "Lisbon", category: "Historic Landmark", visited: true, notes: "Belém · Portuguese Late Gothic Manueline style.", lat: 38.6979, lng: -9.2067 },
  { id: "sintra", name: "Pena Palace", city: "Lisbon", category: "Palace & Gardens", visited: false, notes: "Sintra day trip · Take 434 bus up from station.", lat: 38.7876, lng: -9.3906 },
  { id: "highline", name: "The High Line", city: "New York", category: "Public Park", visited: true, notes: "Chelsea · Sunset walk from Meatpacking up to Hudson Yards.", lat: 40.748, lng: -74.0048 },
  { id: "fushimi", name: "Fushimi Inari Shrine", city: "Kyoto", category: "Shinto Shrine", visited: false, notes: "Early morning hike before 7 AM through torii gates.", lat: 34.9671, lng: 135.7727 },
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
    id: "tamjai",
    name: "譚仔米線 inspired rice noodles",
    emoji: "🍜",
    meal: "Dinner",
    mins: 45,
    from: "Hong Kong style · Chinese comfort",
    ingredients: [
      { name: "Rice vermicelli / mixian", amount: "300 g" },
      { name: "Pork belly slices", amount: "150 g" },
      { name: "Pickled mustard greens", amount: "3 tbsp" },
      { name: "Bean curd sheets", amount: "4 rolls" },
      { name: "Spicy & sour broth base", amount: "4 cups" },
      { name: "Chili oil & Sichuan pepper", amount: "to taste" },
    ],
    steps: [
      "Simmer the pork bone broth with pickled greens until tangy and savory.",
      "Add bean curd sheets and sliced pork belly; cook gently for 3 minutes.",
      "Blanch rice noodles in boiling water until springy and drain.",
      "Pour hot soup and toppings over the noodles, drizzle with chili oil.",
    ],
  },
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
];

export type Category = { id: string; name: string; emoji: string; group: "food" | "home" | "travel" | "fun" | "shopping" | "health"; plan: number; spent: number; last: number };
export const CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", emoji: "🛒", group: "food", plan: 800, spent: 780, last: 760 },
  { id: "dining", name: "Food & dining", emoji: "🍽️", group: "food", plan: 1200, spent: 1450, last: 1100 },
  { id: "rent", name: "Rent & Housing", emoji: "🏠", group: "home", plan: 2200, spent: 2200, last: 2200 },
  { id: "travel", name: "Travel & Trips", emoji: "✈️", group: "travel", plan: 1000, spent: 1485, last: 600 },
  { id: "transport", name: "Transport", emoji: "🚇", group: "travel", plan: 250, spent: 220, last: 210 },
  { id: "subs", name: "Subscriptions", emoji: "📺", group: "fun", plan: 120, spent: 115, last: 115 },
  { id: "shopping", name: "Shopping", emoji: "🛍️", group: "shopping", plan: 600, spent: 685, last: 520 },
  { id: "fitness", name: "Fitness & Health", emoji: "🏋️", group: "health", plan: 248, spent: 200, last: 220 },
];

export type Txn = { id: string; payee: string; amount: number; date: string; account: string; category?: string; suggestion?: string };
export const REVIEW: Txn[] = [
  { id: "r1", payee: "Blue Bottle Coffee", amount: -6.5, date: "Nov 24", account: "Citi 4417", suggestion: "dining" },
  { id: "r2", payee: "SQ *Corner Deli", amount: -14.2, date: "Nov 23", account: "Amex 2008" },
  { id: "r3", payee: "Trader Joe's", amount: -62.18, date: "Nov 22", account: "Citi 4417", suggestion: "groceries" },
  { id: "r4", payee: "MTA*NYCT PAYGO", amount: -2.9, date: "Nov 22", account: "Amex 2008", suggestion: "transport" },
  { id: "r5", payee: "UNIQLO SOHO", amount: -39.9, date: "Nov 21", account: "Amex 2008", suggestion: "shopping" },
];

export const POSTED: Txn[] = [
  { id: "p1", payee: "Spotify", amount: -11.99, date: "Nov 20", account: "Amex 2008", category: "subs" },
  { id: "p2", payee: "JUA", amount: -142.0, date: "Nov 19", account: "Citi 4417", category: "dining" },
  { id: "p3", payee: "Payroll (Acme Co.)", amount: 4385.0, date: "Nov 15", account: "Chase Checking", category: "income" },
  { id: "p4", payee: "Whole Foods", amount: -84.31, date: "Nov 14", account: "Citi 4417", category: "groceries" },
  { id: "p5", payee: "Half Marathon Registration", amount: -95.0, date: "Nov 12", account: "Amex 2008", category: "fitness" },
  { id: "p6", payee: "Apartment Rent", amount: -2200.0, date: "Nov 1", account: "Chase Checking", category: "rent" },
];

export const ACCOUNTS = [
  { name: "Chase Checking", kind: "Checking", balance: 6420.12, logo: "/logos/chase.png" },
  { name: "Citi Double Cash (*4417)", kind: "Credit card", balance: -612.4, logo: "/logos/citi.png" },
  { name: "Amex Gold (*2008)", kind: "Credit card", balance: -287.15, logo: "/logos/amex.jpeg" },
  { name: "Company 401(k)", kind: "Retirement", balance: 58310.0, logo: "/logos/fidelity.jpeg" },
  { name: "Schwab Brokerage", kind: "Brokerage", balance: 42780.25, logo: "/logos/schwab.png" },
];

export const FORECAST_DATA = {
  name: "Baseline forecast",
  savedTime: "Saved 54 minutes ago",
  eoyNetWorth: 186000,
  retirementNetWorth: 4820000,
  retirementAge: 62,
  endNetWorth: 3950000,
  yearlyExpenses: 84000,
  participants: [
    { name: "Me", age: 31, income: "$142K" },
    { name: "Sam", age: 30, income: "$128K" },
  ],
  milestones: [
    { year: 2028, icon: "🚗", label: "New Car", offsetPct: 18 },
    { year: 2030, icon: "🏠", label: "Home Purchase", offsetPct: 22 },
    { year: 2033, icon: "🌍", label: "Sabbatical Year", offsetPct: 28 },
    { year: 2057, icon: "🏖️", label: "Retirement (Age 62)", offsetPct: 62 },
    { year: 2088, icon: "🏛️", label: "Legacy ($3.95M)", offsetPct: 98 },
  ],
  projections: [
    { year: "2026", netWorth: "$186K", assets: "$186K", savings: "$12.4K", retirement: "$58K" },
    { year: "2027", netWorth: "$262K", assets: "$262K", savings: "$71K", retirement: "$67K" },
    { year: "2028", netWorth: "$345K", assets: "$345K", savings: "$133K", retirement: "$77K" },
    { year: "2029", netWorth: "$421K", assets: "$421K", savings: "$188K", retirement: "$88K" },
    { year: "2030", netWorth: "$508K", assets: "$508K", savings: "$252K", retirement: "$99K" },
    { year: "2031", netWorth: "$602K", assets: "$602K", savings: "$320K", retirement: "$111K" },
  ],
};
