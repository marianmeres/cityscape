#!/usr/bin/env bash
# Rasterise icon.svg → the PNGs the manifest + iOS reference. Requires `rsvg-convert`
# (brew install librsvg). The artwork keeps its focal content in the central safe zone,
# so the same source doubles as the maskable icon.
set -euo pipefail
cd "$(dirname "$0")"
rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-maskable-512.png
rsvg-convert -w 180 -h 180 icon.svg -o apple-touch-180.png
echo "Wrote icon-192.png icon-512.png icon-maskable-512.png apple-touch-180.png"
