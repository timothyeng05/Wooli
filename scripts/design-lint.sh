#!/usr/bin/env bash
# Counts design-system drift in the iOS views and fails if any count went up
# versus scripts/design-lint-baseline.txt. Lower the baseline as code is migrated:
#   scripts/design-lint.sh --update
# Excludes Theme.swift and Shared/DesignSystem/, where raw values belong.
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT=ios/Wooli/Wooli
BASELINE=scripts/design-lint-baseline.txt

files() {
  find "$ROOT" -name '*.swift' ! -name Theme.swift ! -path '*/Shared/DesignSystem/*' -print0
}
count() { files | xargs -0 cat | grep -cE "$1" || true; }

c_color_hex=$(count 'Color\(hex:')
c_corner_radius=$(count 'cornerRadius: *[0-9]')
c_font_system_size=$(count '\.font\(\.system\(size:')
c_padding_number=$(count '\.padding\([^)]*[0-9]')

get_count() {
  case "$1" in
    color_hex) echo "$c_color_hex" ;;
    corner_radius) echo "$c_corner_radius" ;;
    font_system_size) echo "$c_font_system_size" ;;
    padding_number) echo "$c_padding_number" ;;
  esac
}

keys=(color_hex corner_radius font_system_size padding_number)

if [[ "${1:-}" == "--update" ]]; then
  for k in "${keys[@]}"; do echo "$k $(get_count "$k")"; done > "$BASELINE"
  echo "Baseline updated:"; cat "$BASELINE"; exit 0
fi

fail=0
for k in "${keys[@]}"; do
  base=$(awk -v k="$k" '$1 == k {print $2}' "$BASELINE")
  now=$(get_count "$k")
  if (( now > base )); then
    echo "FAIL $k: $now (baseline $base)"; fail=1
  elif (( now < base )); then
    echo "ok   $k: $now (baseline $base — run scripts/design-lint.sh --update to lower it)"
  else
    echo "ok   $k: $now"
  fi
done

exit $fail
