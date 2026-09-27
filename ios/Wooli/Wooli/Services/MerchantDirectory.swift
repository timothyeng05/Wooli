import Foundation

/// A built-in list of common (mostly US) merchants and keywords → category.
/// Deterministic and private: runs before the AI so only unusual merchants
/// ever need a guess.
///
/// Entries map to a category *kind* rather than a fixed name; each kind lists
/// the category names it can land in (first match in the user's categories
/// wins), so it works with the starter set and with renamed/merged ones.
enum MerchantDirectory {
    /// Kind → category names to try, most specific first.
    static let aliases: [String: [String]] = [
        "groceries": ["Groceries", "Grocery"],
        "restaurants": ["Restaurants", "Dining", "Restaurants & Bars"],
        "coffee": ["Coffee", "Coffee Shops", "Restaurants"],
        "takeout": ["Takeout & Delivery", "Takeout", "Delivery", "Restaurants"],
        "alcohol": ["Alcohol & Bars", "Alcohol", "Bars", "Restaurants"],
        "rent": ["Rent & Mortgage", "Rent", "Mortgage", "Housing"],
        "utilities": ["Utilities & Internet", "Utilities"],
        "internet": ["Utilities & Internet", "Internet", "Utilities"],
        "phone": ["Phone", "Mobile Phone", "Utilities & Internet", "Utilities"],
        "homeSupplies": ["Home Supplies", "Home Supply", "Household"],
        "homeImprovement": ["Home Improvement", "Home Supplies", "Home Supply"],
        "transit": ["Transit", "Public Transit", "Transit & Rideshare"],
        "rideshare": ["Rideshare & Taxi", "Rideshare", "Taxi", "Transit & Rideshare"],
        "gas": ["Gas", "Gas & Fuel", "Fuel", "Car"],
        "car": ["Car", "Auto", "Car & Auto"],
        "parking": ["Parking & Tolls", "Parking", "Tolls", "Car"],
        "flights": ["Flights", "Airfare"],
        "hotels": ["Hotels", "Lodging"],
        "vacation": ["Vacation", "Hotels"],
        "clothing": ["Clothing", "Shopping"],
        "electronics": ["Electronics", "Shopping"],
        "shopping": ["Shopping", "General Shopping"],
        "gifts": ["Gifts", "Gifts & Donations", "Shopping"],
        "medical": ["Medical", "Health & Medical", "Health"],
        "pharmacy": ["Pharmacy", "Medical", "Health"],
        "fitness": ["Fitness", "Gym", "Personal Care"],
        "personalCare": ["Personal Care"],
        "entertainment": ["Entertainment", "Entertainment & Events"],
        "subscriptions": ["Subscriptions", "Streaming"],
        "kids": ["Kids & Childcare", "Childcare", "Kids"],
        "pets": ["Pets"],
        "education": ["Education"],
        "insurance": ["Insurance"],
        "taxes": ["Taxes"],
        "loans": ["Loan Payments", "Loans"],
        "fees": ["Fees & Interest", "Fees", "Bank Fees"],
        "donations": ["Donations", "Charity", "Gifts & Donations"],
        "salary": ["Salary", "Paycheck"],
        "interest": ["Interest & Dividends", "Other Income"],
        "creditCardPayment": ["Credit Card Payment"],
        "transfer": ["Transfer"],
        "investments": ["Savings & Investments", "Transfer"],
    ]

    /// Kinds that only apply to money coming in.
    private static let incomeOnly: Set<String> = ["salary", "interest"]

    /// "pattern|kind", or "~pattern|kind" to match anywhere inside a word
    /// (default is whole words). Longer patterns win, so "delta dental" beats
    /// "delta air" and "uber eats" beats "uber".
    private static let table = """
    whole foods|groceries
    wholefds|groceries
    trader joe|groceries
    safeway|groceries
    kroger|groceries
    costco|groceries
    aldi|groceries
    publix|groceries
    h-e-b|groceries
    wegmans|groceries
    stop & shop|groceries
    shoprite|groceries
    food lion|groceries
    harris teeter|groceries
    sprouts|groceries
    meijer|groceries
    fresh market|groceries
    key food|groceries
    c-town|groceries
    fairway|groceries
    h mart|groceries
    hmart|groceries
    99 ranch|groceries
    instacart|groceries
    freshdirect|groceries
    amazon fresh|groceries
    ralphs|groceries
    vons|groceries
    albertsons|groceries
    jewel-osco|groceries
    hannaford|groceries
    market basket|groceries
    lidl|groceries
    grocery outlet|groceries
    erewhon|groceries
    food bazaar|groceries
    gristedes|groceries
    morton williams|groceries
    foodtown|groceries
    sam's club|groceries
    bj's wholesale|groceries
    gopuff|groceries
    grocery|groceries
    supermarket|groceries
    chipotle|restaurants
    sweetgreen|restaurants
    cava|restaurants
    shake shack|restaurants
    panera|restaurants
    olive garden|restaurants
    applebee|restaurants
    chili's|restaurants
    cheesecake factory|restaurants
    texas roadhouse|restaurants
    outback steak|restaurants
    ihop|restaurants
    denny's|restaurants
    buffalo wild wings|restaurants
    p.f. chang|restaurants
    nando's|restaurants
    just salad|restaurants
    chopt|restaurants
    mcdonald|restaurants
    burger king|restaurants
    wendy's|restaurants
    taco bell|restaurants
    kfc|restaurants
    popeyes|restaurants
    chick-fil-a|restaurants
    five guys|restaurants
    in-n-out|restaurants
    domino's|restaurants
    dominos|restaurants
    pizza hut|restaurants
    papa john|restaurants
    little caesars|restaurants
    jersey mike|restaurants
    jimmy john|restaurants
    wingstop|restaurants
    raising cane|restaurants
    panda express|restaurants
    qdoba|restaurants
    dairy queen|restaurants
    whataburger|restaurants
    pret a manger|restaurants
    le pain quotidien|restaurants
    joe & the juice|restaurants
    opentable|restaurants
    resy|restaurants
    tst|restaurants
    restaurant|restaurants
    pizza|restaurants
    pizzeria|restaurants
    sushi|restaurants
    ramen|restaurants
    taqueria|restaurants
    diner|restaurants
    bistro|restaurants
    grill|restaurants
    kitchen|restaurants
    tavern|restaurants
    deli|restaurants
    bakery|restaurants
    starbucks|coffee
    dunkin|coffee
    peet's|coffee
    blue bottle|coffee
    la colombe|coffee
    tim hortons|coffee
    dutch bros|coffee
    philz|coffee
    caribou coffee|coffee
    gregorys coffee|coffee
    birch coffee|coffee
    blank street|coffee
    bluestone lane|coffee
    coffee|coffee
    cafe|coffee
    espresso|coffee
    doordash|takeout
    uber eats|takeout
    ubereats|takeout
    grubhub|takeout
    seamless|takeout
    postmates|takeout
    caviar|takeout
    total wine|alcohol
    bevmo|alcohol
    drizly|alcohol
    liquor|alcohol
    wine|alcohol
    brewery|alcohol
    apartments|rent
    property management|rent
    property mgmt|rent
    landlord|rent
    bilt rent|rent
    rent payment|rent
    mortgage|rent
    rocket mortgage|rent
    mr. cooper|rent
    con ed|utilities
    coned|utilities
    con edison|utilities
    pg&e|utilities
    duke energy|utilities
    dominion energy|utilities
    national grid|utilities
    xcel energy|utilities
    southern california edison|utilities
    fpl|utilities
    eversource|utilities
    pseg|utilities
    ameren|utilities
    dte energy|utilities
    consumers energy|utilities
    georgia power|utilities
    peco|utilities
    comed|utilities
    nyseg|utilities
    electric|utilities
    water bill|utilities
    comcast|internet
    xfinity|internet
    spectrum|internet
    verizon fios|internet
    fios|internet
    optimum|internet
    cox communications|internet
    frontier|internet
    google fiber|internet
    starlink|internet
    rcn|internet
    astound|internet
    verizon|phone
    verizon wireless|phone
    t-mobile|phone
    tmobile|phone
    at&t|phone
    mint mobile|phone
    visible|phone
    cricket wireless|phone
    boost mobile|phone
    google fi|phone
    us mobile|phone
    ikea|homeSupplies
    homegoods|homeSupplies
    home goods|homeSupplies
    bed bath|homeSupplies
    container store|homeSupplies
    wayfair|homeSupplies
    crate & barrel|homeSupplies
    west elm|homeSupplies
    pottery barn|homeSupplies
    home depot|homeImprovement
    lowe's|homeImprovement
    lowes|homeImprovement
    ace hardware|homeImprovement
    true value|homeImprovement
    menards|homeImprovement
    sherwin-williams|homeImprovement
    harbor freight|homeImprovement
    hardware|homeImprovement
    mta|transit
    nyct|transit
    omny|transit
    metrocard|transit
    bart|transit
    clipper|transit
    ventra|transit
    septa|transit
    wmata|transit
    smartrip|transit
    mbta|transit
    lirr|transit
    metro-north|transit
    nj transit|transit
    path|transit
    amtrak|transit
    caltrain|transit
    metrolink|transit
    trimet|transit
    marta|transit
    citi bike|transit
    citibike|transit
    lime|transit
    revel|transit
    uber|rideshare
    lyft|rideshare
    curb|rideshare
    taxi|rideshare
    yellow cab|rideshare
    waymo|rideshare
    shell|gas
    chevron|gas
    exxon|gas
    exxonmobil|gas
    mobil|gas
    sunoco|gas
    citgo|gas
    speedway|gas
    wawa|gas
    sheetz|gas
    valero|gas
    circle k|gas
    arco|gas
    phillips 66|gas
    conoco|gas
    quiktrip|gas
    racetrac|gas
    buc-ee|gas
    chargepoint|gas
    evgo|gas
    electrify america|gas
    tesla supercharger|gas
    jiffy lube|car
    valvoline|car
    firestone|car
    pep boys|car
    autozone|car
    advance auto|car
    o'reilly auto|car
    midas|car
    meineke|car
    discount tire|car
    car wash|car
    carwash|car
    dmv|car
    carmax|car
    carvana|car
    toyota financial|car
    honda financial|car
    nissan|car
    hyundai motor|car
    ford credit|car
    gm financial|car
    ~parking|parking
    ~toll|parking
    e-zpass|parking
    ~ezpass|parking
    fastrak|parking
    sunpass|parking
    i-pass|parking
    platepass|parking
    spothero|parking
    parkwhiz|parking
    parkmobile|parking
    paybyphone|parking
    laz parking|parking
    icon parking|parking
    delta air|flights
    united airlines|flights
    united air|flights
    american airlines|flights
    southwest air|flights
    jetblue|flights
    alaska air|flights
    spirit airl|flights
    frontier airlines|flights
    hawaiian air|flights
    air canada|flights
    british airways|flights
    lufthansa|flights
    air france|flights
    emirates|flights
    qatar airways|flights
    singapore air|flights
    japan airlines|flights
    cathay pacific|flights
    virgin atlantic|flights
    allegiant|flights
    sun country|flights
    airlines|flights
    marriott|hotels
    hilton|hotels
    hyatt|hotels
    ihg|hotels
    holiday inn|hotels
    sheraton|hotels
    westin|hotels
    hampton inn|hotels
    best western|hotels
    wyndham|hotels
    radisson|hotels
    four seasons|hotels
    ritz-carlton|hotels
    kimpton|hotels
    courtyard|hotels
    doubletree|hotels
    embassy suites|hotels
    motel 6|hotels
    la quinta|hotels
    airbnb|hotels
    vrbo|hotels
    booking.com|hotels
    hotels.com|hotels
    hotel|hotels
    expedia|vacation
    priceline|vacation
    viator|vacation
    getyourguide|vacation
    klook|vacation
    hertz|vacation
    avis|vacation
    enterprise rent|vacation
    budget rent|vacation
    national car rental|vacation
    sixt|vacation
    turo|vacation
    royal caribbean|vacation
    carnival cruise|vacation
    norwegian cruise|vacation
    uniqlo|clothing
    h&m|clothing
    zara|clothing
    old navy|clothing
    banana republic|clothing
    j.crew|clothing
    jcrew|clothing
    nordstrom|clothing
    macy's|clothing
    macys|clothing
    bloomingdale|clothing
    saks|clothing
    lululemon|clothing
    nike|clothing
    adidas|clothing
    under armour|clothing
    everlane|clothing
    madewell|clothing
    abercrombie|clothing
    american eagle|clothing
    urban outfitters|clothing
    anthropologie|clothing
    tj maxx|clothing
    tjmaxx|clothing
    marshalls|clothing
    ross stores|clothing
    burlington|clothing
    kohl's|clothing
    dsw|clothing
    foot locker|clothing
    allbirds|clothing
    patagonia|clothing
    north face|clothing
    aritzia|clothing
    shein|clothing
    asos|clothing
    poshmark|clothing
    apple store|electronics
    apple.com/us|electronics
    best buy|electronics
    bestbuy|electronics
    b&h photo|electronics
    micro center|electronics
    newegg|electronics
    amazon|shopping
    amzn|shopping
    target|shopping
    walmart|shopping
    wal-mart|shopping
    ebay|shopping
    etsy|shopping
    temu|shopping
    dollar tree|shopping
    dollar general|shopping
    five below|shopping
    michaels|shopping
    hobby lobby|shopping
    staples|shopping
    office depot|shopping
    barnes & noble|shopping
    rei|shopping
    1-800-flowers|gifts
    ftd|gifts
    edible arrangements|gifts
    cvs|pharmacy
    walgreens|pharmacy
    duane reade|pharmacy
    rite aid|pharmacy
    capsule pharmacy|pharmacy
    alto pharmacy|pharmacy
    pharmacy|pharmacy
    hospital|medical
    clinic|medical
    urgent care|medical
    citymd|medical
    one medical|medical
    zocdoc|medical
    labcorp|medical
    quest diagnostics|medical
    delta dental|insurance
    ~dental|medical
    dentist|medical
    ~orthodont|medical
    ~optometr|medical
    lenscrafters|medical
    warby parker|medical
    zenni|medical
    physical therapy|medical
    ~dermatolog|medical
    talkspace|medical
    betterhelp|medical
    equinox|fitness
    planet fitness|fitness
    la fitness|fitness
    crunch fitness|fitness
    orangetheory|fitness
    soulcycle|fitness
    barry's|fitness
    blink fitness|fitness
    peloton|fitness
    classpass|fitness
    ymca|fitness
    anytime fitness|fitness
    gym|fitness
    fitness|fitness
    yoga|fitness
    pilates|fitness
    sephora|personalCare
    ulta|personalCare
    bath & body works|personalCare
    glossier|personalCare
    drybar|personalCare
    great clips|personalCare
    supercuts|personalCare
    barber|personalCare
    salon|personalCare
    nails|personalCare
    massage|personalCare
    european wax|personalCare
    amc theatres|entertainment
    amc|entertainment
    regal|entertainment
    cinemark|entertainment
    alamo drafthouse|entertainment
    fandango|entertainment
    ticketmaster|entertainment
    stubhub|entertainment
    seatgeek|entertainment
    eventbrite|entertainment
    live nation|entertainment
    vivid seats|entertainment
    todaytix|entertainment
    steam games|entertainment
    steampowered|entertainment
    playstation|entertainment
    xbox|entertainment
    nintendo|entertainment
    gamestop|entertainment
    bowlero|entertainment
    topgolf|entertainment
    dave & buster|entertainment
    museum|entertainment
    netflix|subscriptions
    spotify|subscriptions
    hulu|subscriptions
    disney plus|subscriptions
    disney+|subscriptions
    disneyplus|subscriptions
    hbo max|subscriptions
    max.com|subscriptions
    paramount+|subscriptions
    peacock|subscriptions
    apple.com/bill|subscriptions
    apple music|subscriptions
    icloud|subscriptions
    youtube premium|subscriptions
    youtube tv|subscriptions
    google one|subscriptions
    google storage|subscriptions
    amazon prime|subscriptions
    prime video|subscriptions
    audible|subscriptions
    kindle unlimited|subscriptions
    dropbox|subscriptions
    adobe|subscriptions
    microsoft 365|subscriptions
    chatgpt|subscriptions
    openai|subscriptions
    anthropic|subscriptions
    claude.ai|subscriptions
    github|subscriptions
    notion|subscriptions
    1password|subscriptions
    new york times|subscriptions
    nytimes|subscriptions
    wsj|subscriptions
    washington post|subscriptions
    patreon|subscriptions
    substack|subscriptions
    siriusxm|subscriptions
    crunchyroll|subscriptions
    duolingo|subscriptions
    headspace|subscriptions
    calm.com|subscriptions
    linkedin premium|subscriptions
    tinder|subscriptions
    bumble|subscriptions
    hinge|subscriptions
    daycare|kids
    childcare|kids
    bright horizons|kids
    kindercare|kids
    care.com|kids
    babysit|kids
    buy buy baby|kids
    petco|pets
    petsmart|pets
    chewy|pets
    banfield|pets
    rover.com|pets
    barkbox|pets
    veterinary|pets
    animal hospital|pets
    vet clinic|pets
    tuition|education
    university|education
    college|education
    coursera|education
    udemy|education
    masterclass|education
    chegg|education
    sallie mae|loans
    navient|loans
    nelnet|loans
    mohela|loans
    student loan|loans
    sofi loan|loans
    loan payment|loans
    geico|insurance
    progressive|insurance
    state farm|insurance
    allstate|insurance
    liberty mutual|insurance
    usaa ins|insurance
    farmers ins|insurance
    nationwide|insurance
    lemonade|insurance
    metlife|insurance
    aetna|insurance
    cigna|insurance
    unitedhealthcare|insurance
    blue cross|insurance
    oscar health|insurance
    insurance|insurance
    irs|taxes
    us treasury|taxes
    franchise tax|taxes
    dept of revenue|taxes
    department of revenue|taxes
    nys dtf|taxes
    turbotax|taxes
    h&r block|taxes
    taxact|taxes
    freetaxusa|taxes
    tax payment|taxes
    atm fee|fees
    overdraft|fees
    service fee|fees
    monthly fee|fees
    maintenance fee|fees
    foreign transaction fee|fees
    late fee|fees
    interest charge|fees
    finance charge|fees
    annual fee|fees
    ~donation|donations
    charity|donations
    gofundme|donations
    red cross|donations
    unicef|donations
    wikimedia|donations
    st jude|donations
    salvation army|donations
    actblue|donations
    winred|donations
    tithe|donations
    payroll|salary
    direct dep|salary
    direct deposit|salary
    salary|salary
    paycheck|salary
    gusto|salary
    paychex|salary
    adp|salary
    interest paid|interest
    ~interest from|interest
    bank int|interest
    interest earned|interest
    interest payment|interest
    ~dividend|interest
    cash reward|interest
    payment thank you|creditCardPayment
    autopay|creditCardPayment
    auto pay|creditCardPayment
    card payment|creditCardPayment
    credit card payment|creditCardPayment
    crd autopay|creditCardPayment
    epay|creditCardPayment
    epayment|creditCardPayment
    applecard|creditCardPayment
    cardmember serv|creditCardPayment
    capital one online pymt|creditCardPayment
    discover e-payment|creditCardPayment
    online transfer|transfer
    internal transfer|transfer
    transfer to|transfer
    transfer from|transfer
    atm withdrawal|transfer
    atm cash|transfer
    fidelity|investments
    vanguard|investments
    charles schwab|investments
    schwab brokerage|investments
    robinhood|investments
    e*trade|investments
    etrade|investments
    wealthfront|investments
    betterment|investments
    acorns|investments
    m1 finance|investments
    coinbase|investments
    401k|investments
    401(k)|investments
    roth|investments
    ira contrib|investments
    ira rollover|investments
    brokerage|investments
    money market|investments
    spaxx|investments
    treasurydirect|investments
    """

    private struct Entry {
        let pattern: String
        let kind: String
        let anywhere: Bool
    }

    private static let entries: [Entry] = table.split(separator: "\n").compactMap { line in
        let parts = line.trimmingCharacters(in: .whitespaces).split(separator: "|", maxSplits: 1).map(String.init)
        guard parts.count == 2, !parts[0].isEmpty else { return nil }
        let anywhere = parts[0].hasPrefix("~")
        return Entry(pattern: anywhere ? String(parts[0].dropFirst()) : parts[0], kind: parts[1], anywhere: anywhere)
    }
    .sorted { $0.pattern.count > $1.pattern.count }

    /// Lowercase, with anything that isn't part of a merchant token turned into spaces.
    static func clean(_ text: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "&'.+/-()"))
        let mapped = text.lowercased().unicodeScalars.map { allowed.contains($0) ? Character($0) : " " }
        return " " + String(mapped).split(separator: " ").joined(separator: " ") + " "
    }

    /// The category kind for a transaction, if any entry matches.
    static func kind(for text: String, amount: Double) -> String? {
        let haystack = clean(text)
        func hits(_ entry: Entry) -> Bool {
            entry.anywhere ? haystack.contains(entry.pattern) : haystack.contains(" \(entry.pattern) ")
        }
        // Money in that says interest/dividend/payroll is income, even when a
        // longer pattern (e.g. "money market", "charles schwab") also matches.
        if amount > 0, let income = entries.first(where: { incomeOnly.contains($0.kind) && hits($0) }) {
            return income.kind
        }
        for entry in entries {
            let hit = entry.anywhere ? haystack.contains(entry.pattern) : haystack.contains(" \(entry.pattern) ")
            guard hit else { continue }
            if incomeOnly.contains(entry.kind) && amount <= 0 { continue }
            return entry.kind
        }
        return nil
    }

    /// Resolve a kind to one of the user's leaf categories (by name).
    static func category(forKind kind: String, in categoriesByName: [String: BudgetCategory]) -> BudgetCategory? {
        for name in aliases[kind] ?? [] {
            if let c = categoriesByName[name.lowercased()] { return c }
        }
        return nil
    }
}
