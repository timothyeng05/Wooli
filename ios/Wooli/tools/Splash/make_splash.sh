#!/usr/bin/env bash
# Rebuilds the launch splash from a square sheep video (e.g. 960x960, rounded
# white corners): Wooli/Shared/Splash/WooliSplash.heics and the LaunchSheep
# launch image (its first frame). Needs ffmpeg and Xcode's swiftc.
#   tools/Splash/make_splash.sh path/to/video.mp4 [seconds=1.75]
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=$1; DUR=${2:-1.75}; TMP=$(mktemp -d)
# Mask the rounded corners with a soft edge onto flat #003E8F (LaunchBackground).
ffmpeg -v error -y -t "$DUR" -i "$SRC" -f lavfi -t "$DUR" -i "color=c=0x003E8F:s=960x960:r=24" -filter_complex \
  "[0:v]scale=960:960,format=rgb24,split[v][m];[m]geq=lum='255*clip((200-hypot(max(abs(X-479.5)-268\,0)\,max(abs(Y-479.5)-268\,0)))/36\,0\,1)',format=gray[mask];[v][mask]alphamerge[va];[1:v][va]overlay=0:0:format=auto" \
  -r 24 "$TMP/f%03d.png"
swiftc -O tools/Splash/heics.swift -o "$TMP/heics"
"$TMP/heics" "$TMP" Wooli/Shared/Splash/WooliSplash.heics 0.7
cp "$TMP/f001.png" Wooli/Assets.xcassets/LaunchSheep.imageset/launch-sheep@3x.png
sips -z 640 640 "$TMP/f001.png" --out Wooli/Assets.xcassets/LaunchSheep.imageset/launch-sheep@2x.png >/dev/null
rm -rf "$TMP"
echo "Done. Background must stay #003E8F to match LaunchBackground."
