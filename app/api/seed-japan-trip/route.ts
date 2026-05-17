import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const TRIP = {
  name: 'Japan + Seoul 2026',
  destination: 'Japan & South Korea',
  start_date: '2026-05-30',
  end_date: '2026-07-03',
  description: '35-day trip through Tokyo, Kyushu, Seoul, Osaka, Kyoto, Hakone, and Hokkaido',
}

const DAYS: { date: string; title: string; notes: string }[] = [
  {
    date: '2026-05-30',
    title: 'New York → Tokyo',
    notes: `FLIGHT
JFK → HND: 2:00am JFK (Sat May 30) → 5:15am HND (Sun May 31)
UA 7923, operated by All Nippon Airways
Boeing 777-300ER · 14h 15m
Basic Economy · Checked bags included · No carry-on`,
  },
  {
    date: '2026-05-31',
    title: 'Arrive Tokyo – Asakusa + Sumo',
    notes: `MORNING
- Land at HND ~5am
- Keikyu Line to Asakusa (~50 min)
- Drop luggage, check in "Other Space Asakusa"
- Early morning walk through Senso-ji Temple before crowds

LUNCH OPTIONS
- Sometaro: DIY okonomiyaki grilled at table, Asakusa since 1930s
- Pelikan Café: thick-cut toast sets, retro Showa atmosphere
- Asakusa Kagetsudo: giant fluffy melon pan near Senso-ji

AFTERNOON
- Walk to Ryōgoku Kokugikan (~20 min)
- 11am–3pm Sumo Wrestling at Ryōgoku Kokugikan
- Explore Ryōgoku sumo town, sumo stables, sumo museum

DINNER OPTIONS
- Chanko Tomoegata: sumo wrestler hot pot in former stable
- Monjayaki in Monja Street (Tsukishima): Tokyo's griddle dish
- Kappo Yoshiba: chanko nabe in retired sumo ring

NIGHT
- Sumida River walk or Tokyo Skytree viewing deck
- Early night due to 5am arrival`,
  },
  {
    date: '2026-06-01',
    title: 'Tokyo – Yanaka + Ueno',
    notes: `MORNING
- Hakusan Shrine during Bunkyo Hydrangea Festival (typically early June)
- Subway from Asakusa to Hakusan (~30 min)
- Walk Yanaka shitamachi neighbourhood: old temples, craft shops, cemetery

LUNCH OPTIONS
- Yanaka Ginza street snacks: menchi-katsu, yakitori, taiyaki
- Kayaba Coffee: century-old merchant house, tamago sando, drip coffee
- Sasa-no-Yuki (Nezu): tofu kaiseki, operating since Edo period

AFTERNOON
- Ueno Park
- Tokyo National Museum (best in Japan for Japanese art) or pond and Benten-dō
- Short walk or subway back to Asakusa

DINNER OPTIONS
- Yakitori Hachibei: grilled chicken skewers on Meguro River canal, best at dusk
- Afuri Ramen (Nakameguro): yuzu-shio ramen with citrus broth
- Onigiri Bongo (Otsuka): hand-pressed onigiri with 50+ fillings

NIGHT
- Drinks in Nakameguro or Daikanyama`,
  },
  {
    date: '2026-06-02',
    title: 'Tokyo → Fukuoka',
    notes: `FLIGHT
HND → FUK: 1:45pm HND → 3:35pm FUK
JL321, Japan Airlines · Conf: BLSICW
1h 50m · Japan Airpass

MORNING
- Asakusa Kaminarimon & Nakamise-dōri for final stroll and omiyage
- Azuma Bridge riverside: great view of Skytree
- Keikyu Line from Asakusa to Haneda (~40 min) — depart by 11:30am

LUNCH OPTIONS
- Daikokuya: legendary tempura since 1887, sesame oil-fried prawns
- Asakusa Imahan: premium sukiyaki with wagyu
- Namiki Yabusoba: handmade seiro soba, century-old noodle shop

DINNER OPTIONS
- Ichiran Ramen: original Fukuoka tonkotsu location with private tasting booths
- Yatai stalls along Nakasu River: mentaiko and gyoza alongside ramen
- Shin Shin Ramen (Tenjin): rich, creamy tonkotsu with thin noodles

NIGHT
- Nakasu riverside yatai: Fukuoka's open-air food stall scene`,
  },
  {
    date: '2026-06-03',
    title: 'Fukuoka → Kagoshima',
    notes: `TRANSPORT
Flight: HKG → FUK: 11:45am HKG → 4:10pm FUK · UO606, HK Express · Essential fare, 20kg checked bag
Then Shinkansen from Hakata to Kagoshima-Chūō (~1.5 hrs)

MORNING
- Final morning in Fukuoka: checkout and store luggage
- Optional: Canal City Hakata or Kushida Shrine

LUNCH
- Gahojin omakase: Fukuoka's celebrated tonkotsu counter (book in advance)

AFTERNOON
- Shinkansen to Kagoshima-Chūō
- Check-in Kagoshima Airbnb
- Explore Tenmonkan covered arcade

DINNER OPTIONS
- Kurobuta shabu-shabu: Berkshire pork in dashi
- Shiroguma shaved ice at Tenmonkan Mujaki: fruit-topped kakigori
- Kurobuta tonkatsu at Tonkatsu Maru: thick-cut panko Berkshire pork

NIGHT
- Shiroyama Observatory: night views of Sakurajima volcano`,
  },
  {
    date: '2026-06-04',
    title: 'Kagoshima – Sakurajima + Sengan-en',
    notes: `MORNING
- Ferry to Sakurajima from Kagoshima Port (15 min, every 15–20 min)
- Yunohira Observatory: highest accessible viewpoint with caldera views
- Arimura Lava Observatory: walk through hardened lava from 1914 eruption

LUNCH OPTIONS
- On Sakurajima: Sakurajima daikon in local set meal
- Sakurajima Visitor Centre café: light lunch with Sakurajima komikan citrus
- Back in Kagoshima: kibinago sashimi, world's largest radish specialty

AFTERNOON
- Ferry back to Kagoshima (15 min)
- Sengan-en garden: feudal estate with Sakurajima backdrop, built 1658
- Shōko Shūseikan museum: Japan's first Western-style factory, UNESCO site

DINNER OPTIONS
- Satsuma-age: signature fried fishcake near Tenmonkan
- Kibinago sashimi and kurobuta pork izakaya with Kagoshima imo-jochu
- Torisashi: lightly seared chicken sashimi, regional speciality

NIGHT
- Tenmonkan area drinks: shochu bars and izakayas
- Try Kagoshima imo-jochu (sweet potato shochu)`,
  },
  {
    date: '2026-06-05',
    title: 'Kagoshima → Kirishima',
    notes: `TRANSPORT
- Pick up rental car in Kagoshima city centre
- Drive to Kirishima (~1 hr via Route 10)

MORNING
- Kirishima Jingū: atmospheric shrine in cedar forest on volcanic highlands

LUNCH OPTIONS
- Satsuma-jidori charcoal-grilled set meal near shrine
- Kirishima tea soba: buckwheat noodles with local green tea
- Kurozu restaurant in Fukuyama: Kagoshima's aged black vinegar

AFTERNOON
- Ebino Kogen volcanic plateau: colour-coded crater lake trail
- Fudo-ike, Rokkannon-ike, Byakushi-ike
- Views of Mt. Karakuni on clear days

DINNER OPTIONS
- Satsuma-jidori chicken hot pot
- Jidori charcoal yakitori over binchotan charcoal
- Kirishima onsen tamago set: soft-boiled eggs in spring water

NIGHT
- Onsen at accommodation: sodium bicarbonate waters
- Long soak recommended before next day's long drive`,
  },
  {
    date: '2026-06-06',
    title: 'Kirishima → Takachiho → Kumamoto',
    notes: `MORNING
- Early departure by 7:30am
- Drive to Takachiho Gorge (~2.5 hrs via Miyazaki Expressway)
- Rent rowboat through gorge, open from 8:30am (reserve online)

LUNCH OPTIONS
- Nagashi somen: catch cold noodles down bamboo flume
- Takachiho beef set meal: premium highland plateau wagyu
- Chikurin-no-Sato: mountain vegetable tempura and soba

AFTERNOON
- Amano Iwato Shrine (10 min from gorge): mythology of sun goddess Amaterasu
- Drive to Kumamoto (~1.5 hrs via Route 218 and Kyushu Expressway)
- Check-in Kumamoto Airbnb, rest before dinner

DINNER OPTIONS
- Basashi: horse sashimi with ginger and sweet soy, futaego cuts
- Taipien: Kumamoto noodle soup with glass noodles and egg
- Ikinari dango: sweet potato and red bean dumpling

NIGHT
- Walk through Shimotori covered arcade and Shinshigai
- Relaxed nightcap at izakaya`,
  },
  {
    date: '2026-06-07',
    title: 'Kumamoto – Castle + Suizenji Garden',
    notes: `MORNING
- Kumamoto Castle: one of Japan's three great castles
- Partially restored after 2016 earthquake
- Jōsaien garden within castle grounds

LUNCH OPTIONS
- Kumamoto ramen: lighter tonkotsu with mayu (fried garlic oil) and cabbage
- Taipien at Kōrantei: restaurant credited with inventing the dish
- Depachika at Tsuruya: curated bento, wagyu croquettes

AFTERNOON
- Suizenji Jōjuen garden: 400-year-old strolling garden
- Designed to miniaturise 53 stations of Tōkaidō
- Mt. Fuji-shaped hill and miniature Lake Biwa
- Izumi Shrine at northern end

DINNER OPTIONS
- Basashi izakaya platter
- Karashi renkon: lotus root stuffed with hot mustard miso
- Akami wagyu yakiniku: Kumamoto akaushi (Japanese Brown)

NIGHT
- Drinks in Shimotori or Shinshigai bar district
- Last proper night-out before quieter ryokan and onsen days`,
  },
  {
    date: '2026-06-08',
    title: 'Kumamoto → Aso → Yufuin',
    notes: `MORNING
- Check out of Airbnb
- Drive to Mt. Aso via Aso Choyo Road (~1 hr)
- Kusasenri meadow: volcanic plain with grazing horses

LUNCH OPTIONS
- Aso akaushi beef steak set: Japanese Brown cattle
- Takamori dengaku no sato: grilled tofu and vegetables over irori hearth
- Aso milk soft serve at Aso Volcano Museum café

AFTERNOON
- Mt. Aso Nakadake active crater: access depends on volcanic activity
- Drive to Yufuin via Yamanami Highway (~1.5 hrs)
- Check-in Yufuin Onsen Toshoan, change into yukata

DINNER
- Kaiseki dinner at Yufuin Onsen Toshoan
- Multi-course with seasonal Oita prefecture ingredients
- Served in-room or private dining area

NIGHT
- Evening stroll along Yunotsubo-kaido Street: lantern-lit boutiques and cafes
- Private in-room rotenburo (outdoor hot spring bath)`,
  },
  {
    date: '2026-06-09',
    title: 'Yufuin → Beppu → Hiroshima',
    notes: `MORNING
- Ryokan breakfast included: traditional Japanese spread
- Morning walk around Kinrin Lake (金鱗湖) — warm spring water creates mist at early hours
- Browse Yunotsubo-kaido boutiques before checkout

LUNCH OPTIONS
- Yufuin roll cake or crème brûlée at B-Speak
- Yufuin pudding (pu-rin) and light soba set
- Bungo-gyu (Oita wagyu) burger at Yufuin café

AFTERNOON
- Drive to Beppu (~30 min)
- Optional stop at Beppu Jigoku "hell" pools — Umi Jigoku: cobalt-blue pool, most striking
- Drop rental car at Beppu Station
- Sonic limited express to Kokura, then Shinkansen to Hiroshima (~2 hrs total)
- Check-in Hiroshima Airbnb

DINNER OPTIONS
- Hiroshima-style okonomiyaki at Okonomi-mura
- Hiroshima tsukemen: cold dipping ramen
- Momiji manju: warm fresh maple-leaf cake

NIGHT
- Evening walk along Motoyasu River near Peace Memorial Park
- Atomic Bomb Dome lit up at night`,
  },
  {
    date: '2026-06-10',
    title: 'Hiroshima – Peace Park + Miyajima',
    notes: `MORNING
- Peace Memorial Museum: allow 2 hours, go early
- Peace Memorial Park
- Cenotaph, Atomic Bomb Dome (Genbaku Dōmu), Children's Peace Monument

LUNCH OPTIONS
- Grilled Hiroshima oysters on Miyajima
- Kaki-fry: breaded fried oyster set
- Anago-meshi: conger eel on rice

AFTERNOON
- JR ferry to Miyajima Island from Miyajimaguchi (~10 min, included on JR Pass)
- Itsukushima Shrine and floating torii gate at high tide
- Senjokaku (Toyotomi Hideyoshi's pavilion) and five-storey pagoda
- Free-roaming deer on island
- Ferry back to Hiroshima in early evening

DINNER OPTIONS
- Okonomiyaki at Hassei near Hatchōbori
- Oyster izakaya: kaki no dote-nabe (oyster hot pot)
- Hiroshima craft beer at Raku Beer

NIGHT
- Nagarekawa entertainment district
- Final nightcap before Seoul flight`,
  },
  {
    date: '2026-06-11',
    title: 'Hiroshima → Fukuoka',
    notes: `MORNING
- Shukkeien garden near city centre
- Or final Peace Park stroll before crowds

LUNCH OPTIONS
- Hiroshima-style okonomiyaki one last time
- Momiji manju to go: maple leaf cakes
- Anago-meshi bento: station lunch box

AFTERNOON
- Shinkansen from Hiroshima to Hakata (Fukuoka) — ~1 hr on Nozomi or Sakura
- Check-in Fukuoka Airbnb between Tenjin and Nakasu
- Afternoon free: optional Canal City Hakata browse

DINNER OPTIONS
- Motsunabe: beef tripe hot pot in miso or soy broth
- Mentaiko izakaya: spicy cod roe grilled or on rice
- Hakata gyoza at Temusu: thin-skinned, crispy pan-fried

NIGHT
- Nakasu riverside yatai stalls
- Ramen, skewers, cold beer before Seoul flight`,
  },
  {
    date: '2026-06-12',
    title: 'Fukuoka → Seoul',
    notes: `FLIGHT
FUK → ICN: 10:35am FUK → 12:00pm ICN
KE788, Korean Air · Conf: BLPEC2
1h 25m · Economy Saver

Note: Also listed — FUK → HKG: 12:55pm FUK → 3:35pm HKG · UO601, HK Express (verify which flight is correct)

MORNING
- Head to airport, check in and depart

LUNCH
- Airport or in-flight

AFTERNOON
- Arrive ICN, subway or AREX train to Hongdae
- Check-in Hongdae Airbnb
- Seomyeon area: shopping, cafes, skin care (JRYN, Renewme?)

DINNER OPTIONS
- Korean BBQ: galbi (short rib) or samgyeopsal (pork belly)
- Korean fried chicken and beer (chimaek)
- Tteokbokki and odeng at Seomyeon street stall

NIGHT
- Explore Hongdae at night: lively street performances, good bar scene`,
  },
  {
    date: '2026-06-13',
    title: 'Seoul – TBD',
    notes: `TBD`,
  },
  {
    date: '2026-06-14',
    title: 'Seoul – Nami Island',
    notes: `MORNING
- Depart for Nami Island: direct bus from Hongdae — book in advance (~1.5 hrs)
- Arrive and explore: tree-lined paths, bicycle rentals

LUNCH OPTIONS
- Dakgalbi (spicy stir-fried chicken) in Chuncheon
- On-island restaurant: bibimbap and Korean set meals
- Makguksu: buckwheat noodles, Gangwon Province specialty

AFTERNOON
- Continue exploring Nami Island
- Optional: zip line across river
- Bus back to Seoul

DINNER
- TBD

NIGHT
- TBD`,
  },
  {
    date: '2026-06-15',
    title: 'Seoul – TBD',
    notes: `TBD`,
  },
  {
    date: '2026-06-16',
    title: 'Seoul – TBD',
    notes: `TBD`,
  },
  {
    date: '2026-06-17',
    title: 'Seoul → Osaka',
    notes: `FLIGHT
ICN → KIX: 3:05pm ICN → 5:05pm KIX
KE725, Korean Air · Conf: BLPEC2
2h · Economy Saver

MORNING
- TBD: sit-down or Dotonbori street food

AFTERNOON
- 3:05pm Flight to KIX
- Arrive KIX: Nankai Rapi:t or subway to Namba
- Check-in Caption by Hyatt Namba

DINNER OPTIONS
- Takoyaki at Wanaka or Kukuru on Dōtonbori strip
- Kushikatsu in Shinsekai or Namba
- Kani Dōraku: giant mechanical crab sign, crab kaiseki

NIGHT
- Dōtonbori walk: neon-lit canal, Glico running man sign`,
  },
  {
    date: '2026-06-18',
    title: 'Osaka – Tenjinbashisuji + Castle',
    notes: `MORNING
- Tenjinbashisuji shopping street: Japan's longest arcade (2.6km)
- Nakazakichō: quiet vintage and café neighbourhood

LUNCH OPTIONS
- Tenjinbashisuji arcade: ikayaki (grilled squid pancake)
- Cafe in Nakazakichō: lunch plates and specialty coffee
- Okonomiyaki at Chibo (Dōtonbori)

AFTERNOON
- Osaka Castle: grounds and exterior
- Kuromon Ichiba market: Osaka's "kitchen," street food snacking

DINNER OPTIONS
- Kushikatsu at Daruma in Shinsekai
- Doteyaki: slow-simmered beef tendon in sweet miso
- Horumon yakiniku in Tsuruhashi: grilled offal

NIGHT
- Amerika-mura or Shinsaibashi for drinks`,
  },
  {
    date: '2026-06-19',
    title: 'Osaka → Kyoto – Kimono + Nishiki',
    notes: `TRANSPORT
- Train to Kyoto (Shinkansen or Hankyu, ~15–30 min)

MORNING
- Ringram kimono rental (book in advance)
- Photo spots in Shinsekai or Hozenji Yokocho if renting in Osaka

LUNCH OPTIONS
- Okonomiyaki at Fukutaro near Namba
- 551 Horai butaman (steamed pork bun), Namba
- Rikuro's cheesecake: soufflé cheesecake fresh from the shop

AFTERNOON
- Train to Kyoto
- Check-in Ace Hotel Kyoto at Karasuma-Oike Station
- Walk Nishiki Market: "Kyoto's kitchen"

DINNER OPTIONS
- Pontocho alley dinner: lantern-lit street, riverside seating
- Kyoto-style yudofu at machiya restaurant
- Nishiki Market evening snacks

NIGHT
- Kamo River bank (Sōjō-ōhashi bridge area)
- Locals sit along river in summer`,
  },
  {
    date: '2026-06-20',
    title: 'Kyoto – Fushimi Inari + Gion + Kiyomizudera',
    notes: `MORNING
- Fushimi Inari Taisha: hike torii gate trail early (before 8am)
- JR Nara Line from Kyoto Station (~5 min to Inari)

LUNCH OPTIONS
- Inari-sushi near Fushimi Inari
- Kitsune udon at Omen
- Matcha parfait at Uji-cha teahouse

AFTERNOON
- Gion district: Hanamikoji street, Yasaka Shrine
- Chance of spotting geiko/maiko in late afternoon
- Kiyomizudera temple: hillside wooden stage with city views

DINNER OPTIONS
- Kaiseki in Gion: multi-course in machiya
- Tempura Yoshikawa: elegant counter-style tempura
- Gion izakaya with obanzai and local sake

NIGHT
- Gion Corner or evening walk through Ninenzaka by lantern light`,
  },
  {
    date: '2026-06-21',
    title: 'Kyoto – Arashiyama + Kinkaku-ji',
    notes: `MORNING
- Arashiyama bamboo grove: go early (before 8am)
- Tenryu-ji garden adjacent
- JR Sagano Line from Kyoto Station (~15 min)

LUNCH OPTIONS
- Yudofu at Sagano or Yoshimura
- Warabi mochi and matcha at Arashiyama Yoshimura
- Unagi at Hirokawa

AFTERNOON
- Kinkaku-ji (Golden Pavilion): go mid-afternoon
- Ryoan-ji rock garden: 15 min walk from Kinkaku-ji
- Check-in Hyatt Place Kyoto (near Marutamachi Station)

DINNER OPTIONS
- Kyoto obanzai at counter restaurant
- Nishiki Market evening walk and sake tasting
- Ramen at Ippudo or Takabashi

NIGHT
- Nijo Castle illuminated exterior at night`,
  },
  {
    date: '2026-06-22',
    title: 'Kyoto → Hakone',
    notes: `TRANSPORT
- Check out of Hyatt Place
- Shinkansen from Kyoto to Odawara (~2.5 hrs)
- Hakone Tozan Railway to Gora (~40 min)
- Alternative: Romancecar limited express from Shinjuku

MORNING
- Depart by Shinkansen or Romancecar

LUNCH OPTIONS
- Handmade soba in Hakone-Yumoto
- Tofu kaiseki at Hakone ryokan-style restaurant
- Gyu-nabe at Yumoto inn

AFTERNOON
- Check-in Gora Hanaougi ryokan
- Private open-air bath in room, views of Hakone highlands
- Hakone Open-Air Museum: 5-min walk from Gora Station

DINNER
- Kaiseki dinner at Gora Hanaougi (included with stay)

NIGHT
- Private onsen in room`,
  },
  {
    date: '2026-06-23',
    title: 'Hakone – Ropeway + Lake Ashi',
    notes: `MORNING
- Ryokan breakfast (included), take your time
- Hakone Ropeway to Owakudani: active volcanic valley
- Lake Ashi: sightseeing boat across lake

LUNCH OPTIONS
- Kuro-tamago (black sulphur eggs) at Owakudani
- Lakeside curry or tonkatsu at Hakone-machi port
- Amazake-chaya on Old Tokaido Road: 400-year-old teahouse

AFTERNOON
- Hakone Shrine on lakeshore: torii gate in water
- Return to ryokan: afternoon soak

DINNER
- Kaiseki dinner at Gora Hanaougi (included)

NIGHT
- Private onsen before bed`,
  },
  {
    date: '2026-06-24',
    title: 'Hakone → Hokkaido (New Chitose)',
    notes: `FLIGHT
HND → CTS: 4:00pm HND → 5:40pm CTS
NH071, ANA · Conf: D6PMTP
1h 40m · Economy

MORNING
- Ryokan breakfast (included), checkout by 11:00am
- Train back to Shinjuku/HND (Odakyu Romancecar or Shinkansen)

LUNCH OPTIONS
- Rokurinsha tsukemen at Haneda Airport
- Sushi no Midori (Haneda Terminal 2)
- Tendon Tenya

AFTERNOON
- 4:00pm Flight to CTS (New Chitose)
- Check-in Minn Chitose: short rest

DINNER OPTIONS
- Hokkaido miso ramen at New Chitose Airport Ramen Alley
- Jingisukan at Matsuo: dome-shaped skillet lamb BBQ
- Kaisen-don at airport

NIGHT
- Pick up rental car at New Chitose Airport
- Nissan KICKS e-POWER · Conf: 26020201569
- Early night before long Shiretoko drive (~4 hrs)`,
  },
  {
    date: '2026-06-25',
    title: 'Hokkaido – Drive to Shiretoko',
    notes: `TRANSPORT
- Drive to Shiretoko (~4 hrs) via Akan National Park

MORNING
- Drive begins

LUNCH OPTIONS
- Abashiri seafood: kinki (thornyhead rockfish)
- Abashiri Prison Museum café: themed lunch inside restored prison
- Roadside soft serve: melon, lavender, rich milk

AFTERNOON
- Arrive Utoro (Shiretoko)
- Check-in Shiretoko Daiichi Hotel
- Oronko Rock at dusk: climb 60m coastal rock

DINNER
- Marusukoi buffet at Shiretoko Daiichi Hotel (included with half board)
- 80+ dishes, fresh Hokkaido seafood, hairy crab in season

NIGHT
- Hotel onsen: large public baths overlooking Sea of Okhotsk`,
  },
  {
    date: '2026-06-26',
    title: 'Shiretoko – Five Lakes + Furepe Waterfall',
    notes: `MORNING
- Shiretoko Five Lakes (Shiretoko Goko)
- Elevated wooden boardwalk trail through virgin forest
- Book guided ground-level trail in advance (required Jun–Jul, bear activity)
- Good chance of spotting Ezo deer and Hokkaido brown bears

LUNCH OPTIONS
- Uni-don (sea urchin rice bowl) in Utoro
- Shiretoko salmon and ikura (salmon roe) bowl
- Rausu kombu (kelp) soup or soba

AFTERNOON
- Furepe Waterfall (Maiden's Tears): 30-min walk
- Shiretoko Pass (Shiretoko Tōge): highest point panoramic views

DINNER OPTIONS
- Hotel Marusukoi buffet (included with half board)
- Utoro restaurant for Shiretoko salmon and kegani
- Venison (ezo-shika) steak at local izakaya

NIGHT
- Stargazing from hotel grounds or Shiretoko Pass`,
  },
  {
    date: '2026-06-27',
    title: 'Shiretoko – Cruise + Kamuiwakka',
    notes: `MORNING
- Shiretoko sightseeing cruise from Utoro port
- Boat tours along cliffs to Kamuiwakka Falls (book in advance)

LUNCH OPTIONS
- Utoro seafood set meal
- Onigiri and miso soup from convenience store
- Shiretoko venison curry at roadside café

AFTERNOON
- Kamuiwakka Yu-no-taki: volcanic hot spring waterfall — wade up through warm water (check trail access status)
- Yuhidai Hot Spring viewpoint: roadside foot bath over ocean

DINNER OPTIONS
- Hotel buffet (included with half board)
- Robatayaki at local Utoro izakaya
- Utoro craft beer and grilled hotate (scallops)

NIGHT
- Drive to Hirashikimokoto viewpoint by sunset
- Watch sun set over Sea of Okhotsk`,
  },
  {
    date: '2026-06-28',
    title: 'Shiretoko → Sapporo',
    notes: `MORNING
- Check out of Shiretoko Daiichi Hotel, early start
- Drive to Sapporo (~4.5–5 hrs) via Hokkaido Expressway

AFTERNOON
- Arrive Sapporo
- Check-in Grand Mercure Sapporo Odori Park
- Odori Park: green spine of central Sapporo, relaxed walk

DINNER OPTIONS
- Sapporo miso ramen (butter corn style)
- Genghis Khan (Jingisukan) lamb BBQ
- Sushi near Nijo Market

NIGHT
- Susukino nightlife district`,
  },
  {
    date: '2026-06-29',
    title: 'Sapporo – Beer Museum + Hokkaido University',
    notes: `MORNING
- Odori Park: pleasant morning walk
- Sapporo Clock Tower: historically significant
- Sapporo Beer Museum: free entry, tasting bar available

LUNCH OPTIONS
- Soup curry at Garaku or Suage
- Sapporo miso ramen at Ramen Alley (Ramen Yokocho, Susukino)
- Kaisen-don at Nijo Market

AFTERNOON
- Hokkaido University campus: Poplar Alley
- Former Hokkaido Government Building (Aka-renga)

DINNER OPTIONS
- Genghis Khan at Daruma in Susukino
- Zangi (Hokkaido fried chicken) and Sapporo beer at Susukino izakaya
- Sapporo night parfait (shime parfait): late-night dessert

NIGHT
- Susukino bar district`,
  },
  {
    date: '2026-06-30',
    title: 'Sapporo → Lake Toya → Hakodate',
    notes: `TRANSPORT
- Drive to Hakodate via Lake Toya (~3.5 hrs from Sapporo with stops)

MORNING
- Drive begins, stop at Lake Toya
- Showa Shinzan volcanic dome
- Usu-zan cable car for crater views
- Lakeside walk

LUNCH OPTIONS
- Lake Toya: white corn tempura or Hokkaido milk korokke
- Noboribetsu jigoku ramen
- Muroran curry ramen: unique Hokkaido fusion

AFTERNOON
- Arrive Hakodate
- Check-in JR Inn Hakodate
- Motomachi district: Western-style 19th-century buildings
- Mt. Hakodate ropeway at dusk

DINNER OPTIONS
- Hakodate squid (ika) sashimi: "dancing squid"
- Hakodate shio ramen at Ajisai
- Lucky Pierrot: beloved local burger chain, Chinese chicken burger

NIGHT
- Kanemori Red Brick Warehouse area`,
  },
  {
    date: '2026-07-01',
    title: 'Hakodate → Tokyo (Ginza)',
    notes: `FLIGHT
HKD → HND: 11:55am HKD → 1:25pm HND
NH554, ANA · Conf: D6PMTP
1h 30m · Economy

MORNING
- Hakodate Asaichi morning market: opens 5am
- Ikura don or fresh hairy crab before flight
- Hotel directly adjacent to market

AFTERNOON
- 11:55am Flight to HND from HKD
- Check-in The Strings by InterContinental
- Upper floors, good city views

DINNER OPTIONS
- Kyubey sushi (Ginza): legendary omakase counter
- Teppanyaki in Ginza: wagyu beef grilled on steel plate
- Ginza Kagari: rich chicken broth ramen

NIGHT
- Ginza evening stroll on Chuo-dori (closed to traffic weekends)
- Tsukiji Outer Market night snacks`,
  },
  {
    date: '2026-07-02',
    title: 'Tokyo – Harajuku + Shibuya + Shinjuku',
    notes: `MORNING
- Harajuku: Takeshita Street, Omotesando
- Meiji Jingu shrine: forest walk

LUNCH OPTIONS
- Fuunji tsukemen (Shinjuku)
- Harajuku crêpe from Marion Crêpes on Takeshita Street
- Bills (Omotesando): ricotta hotcakes

AFTERNOON
- Shibuya: Shibuya Scramble crossing
- Shibuya Sky observation deck (optional)
- Daikanyama T-Site: bookshop complex

DINNER OPTIONS
- Tsunahachi tempura (Shinjuku): since 1924
- Omoide Yokocho yakitori
- Fuunji tsukemen or Ichiran (Shinjuku)

NIGHT
- Shinjuku: Golden Gai, Kabukicho, Omoide Yokocho`,
  },
  {
    date: '2026-07-03',
    title: 'Tokyo → Home',
    notes: `FLIGHT
HND → JFK: 10:45pm HND → 10:55pm JFK (same date, time zones)
UA 7924, operated by All Nippon Airways
Boeing 777-300ER · 13h 10m
Basic Economy · Checked bags included · No carry-on

MORNING
- Tsukiji Outer Market: breakfast (fresh sushi, tamagoyaki, tuna skewers)
- Final omiyage run: Ecute Shinagawa

LUNCH OPTIONS
- Tsukiji Outer Market: sushi breakfast bowl
- Ecute Shinagawa ekiben: beautifully packaged station bento
- Tokyo Banana or Shiroihito: signature omiyage sweets

AFTERNOON
- Head to airport, allow extra time for final shopping

NIGHT
- Depart HND 10:45pm → Arrive JFK 10:55pm`,
  },
]

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if trip already exists
  const { data: existing } = await supabase
    .from('trips')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', TRIP.name)
    .single()

  let tripId: string

  if (existing) {
    tripId = existing.id
  } else {
    const { data: newTrip, error } = await supabase
      .from('trips')
      .insert({ ...TRIP, user_id: user.id })
      .select()
      .single()

    if (error || !newTrip) {
      return NextResponse.json({ error: error?.message ?? 'Failed to create trip' }, { status: 500 })
    }
    tripId = newTrip.id
  }

  // Upsert all days
  const rows = DAYS.map(d => ({
    trip_id: tripId,
    user_id: user.id,
    date: d.date,
    title: d.title,
    notes: d.notes,
  }))

  const { error: daysError } = await supabase
    .from('trip_days')
    .upsert(rows, { onConflict: 'trip_id,date' })

  if (daysError) {
    return NextResponse.json({ error: daysError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tripId, days: rows.length })
}
