# Builds Wooli/Trips/airports.tsv: airports with scheduled passenger service.
# Inputs: OurAirports airports.csv (public domain,
#   https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv)
# and mwgg/Airports airports.json (MIT, for time zones,
#   https://raw.githubusercontent.com/mwgg/Airports/master/airports.json).
# Usage: python3 build_airports.py airports.csv airports.json ../Wooli/Trips/airports.tsv
import csv, json, sys
oa, mw, out = sys.argv[1:4]
tz_by = {}
for k, a in json.load(open(mw)).items():
    if a.get("tz"):
        tz_by[a["icao"]] = a["tz"]
        if a.get("iata"): tz_by.setdefault("IATA:" + a["iata"], a["tz"])
rows, missing = [], 0
for r in csv.DictReader(open(oa, encoding="utf-8")):
    code = r["iata_code"].strip()
    if r["type"] not in ("large_airport", "medium_airport") or r["scheduled_service"] != "yes" or len(code) != 3:
        continue
    tz = tz_by.get(r["icao_code"]) or tz_by.get(r["ident"]) or tz_by.get(r["gps_code"]) or tz_by.get("IATA:" + code)
    if not tz: missing += 1; continue
    clean = lambda s: s.replace("\t", " ").replace("\n", " ").strip()
    rows.append((code, clean(r["name"]), clean(r["municipality"]), r["iso_country"],
                 "%.4f" % float(r["latitude_deg"]), "%.4f" % float(r["longitude_deg"]), tz,
                 "L" if r["type"] == "large_airport" else "M", clean(r["keywords"]).replace(",", " ")))
rows.sort()
seen = set(); final = []
for row in rows:
    if row[0] in seen: continue
    seen.add(row[0]); final.append(row)
with open(out, "w", encoding="utf-8") as f:
    for row in final: f.write("\t".join(row) + "\n")
print(len(final), "airports;", missing, "skipped without tz", file=sys.stderr)
