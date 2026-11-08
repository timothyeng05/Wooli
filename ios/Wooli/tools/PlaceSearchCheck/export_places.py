"""Turns Wooli's trips.json / eats.json into PlaceSearchCheck cases.

Copy the files off a phone running a development build of Wooli:

    xcrun devicectl device copy from --device <udid> --domain-type appDataContainer \
        --domain-identifier com.timothyeng.wooli \
        --source "Library/Application Support/Trips/trips.json" --destination trips.json
    (same for "Library/Application Support/Eats/eats.json")

Then:  python3 export_places.py trips.json eats.json > my-places.json
Keep my-places.json out of git: it's your own places.
"""
import json
import sys

cases, seen = [], set()
for path in sys.argv[1:]:
    data = json.load(open(path))
    if "items" in data:  # trips.json
        trips = {t["id"]: t.get("name", "") for t in data.get("trips", [])}
        places = [(i["place"], trips.get(i.get("tripID"), "")) for i in data["items"] if i.get("place")]
    else:  # eats.json
        places = [(p, "Eats") for p in data.get("mine", []) + data.get("wishlist", [])]
    for place, area in places:
        name, lat, lng = place.get("name", "").strip(), place.get("latitude"), place.get("longitude")
        if not name or lat is None or lng is None:
            continue
        key = (name.lower(), round(lat, 3), round(lng, 3))
        if key in seen:
            continue
        seen.add(key)
        cases.append({"name": name, "latitude": lat, "longitude": lng,
                      "address": place.get("address", ""), "area": area})
json.dump(cases, sys.stdout, ensure_ascii=False, indent=1)
