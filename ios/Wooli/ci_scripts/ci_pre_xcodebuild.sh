#!/bin/sh
# Xcode Cloud runs this before each build. Config/Secrets.xcconfig is
# git-ignored, so Xcode Cloud's checkout doesn't have it: write it from the
# workflow's secret environment variables (App Store Connect → Xcode Cloud →
# workflow → Environment → TMDB_API_KEY, GOOGLE_PLACES_API_KEY, both marked Secret).
# A missing variable leaves that feature off, as in a local build without it.
set -eu

secrets="$(cd "$(dirname "$0")/.." && pwd)/Config/Secrets.xcconfig"

# Never overwrite a Mac's own file if this is run locally.
if [ -f "$secrets" ]; then
    echo "Secrets.xcconfig already exists; leaving it alone."
    exit 0
fi

: > "$secrets"
for name in TMDB_API_KEY GOOGLE_PLACES_API_KEY; do
    value="$(printenv "$name" || true)"
    if [ -n "$value" ]; then
        printf '%s = %s\n' "$name" "$value" >> "$secrets"
        echo "Wrote $name."
    else
        echo "warning: $name isn't set; that feature will be off in this build."
    fi
done
