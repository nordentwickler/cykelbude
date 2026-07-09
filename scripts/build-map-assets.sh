#!/usr/bin/env bash
#
# Downloads the MapLibre glyphs (fonts) and sprites used by the Protomaps
# "light" basemap flavor into public/cms/, so the map does not depend on the
# Protomaps CDN at runtime. Fetched once from the Protomaps basemaps-assets
# GitHub Pages; the browser then loads everything from our own domain.
#
# Usage:
#
#   ./scripts/build-map-assets.sh

set -euo pipefail

cd "$(dirname "$0")/.."

SOURCE="https://protomaps.github.io/basemaps-assets"
FONTS_DIR="public/cms/fonts"
SPRITES_DIR="public/cms/sprites"

# Font stacks referenced by the "light" flavor (see @protomaps/basemaps).
FONTSTACKS=(
    "Noto Sans Regular"
    "Noto Sans Medium"
    "Noto Sans Italic"
)

# Unicode ranges covering Latin scripts (incl. German umlauts/ß) plus common
# punctuation. Enough for German place and street names in the Rostock region.
RANGES=(
    "0-255"
    "256-511"
    "512-767"
    "768-1023"
    "8192-8447"
)

echo "Downloading fonts into ${FONTS_DIR}..."
for stack in "${FONTSTACKS[@]}"; do
    mkdir -p "${FONTS_DIR}/${stack}"
    encoded="${stack// /%20}"
    for range in "${RANGES[@]}"; do
        curl -fsSL "${SOURCE}/fonts/${encoded}/${range}.pbf" \
            -o "${FONTS_DIR}/${stack}/${range}.pbf"
    done
    echo "  ${stack}: ${#RANGES[@]} ranges"
done

echo "Downloading sprites into ${SPRITES_DIR}..."
mkdir -p "${SPRITES_DIR}"
for file in light.json light.png light@2x.json light@2x.png; do
    curl -fsSL "${SOURCE}/sprites/v4/${file}" -o "${SPRITES_DIR}/${file}"
done
echo "  light + light@2x"

echo ""
echo "Done."
du -sh "${FONTS_DIR}" "${SPRITES_DIR}"
