#!/usr/bin/env bash
#
# Builds public/cms/map.pmtiles by extracting a regional slice from the
# latest daily Protomaps world build. Reads MAP_BBOX and MAP_MAX_ZOOM
# from .env and installs the pmtiles CLI into ~/.local/bin on first run.
#
# Usage:
#
#   ./scripts/build-tiles.sh

set -euo pipefail

cd "$(dirname "$0")/.."

OUTPUT="public/cms/map.pmtiles"
ENV_FILE=".env"
PMTILES_BIN="$HOME/.local/bin/pmtiles"

read_env() {
    local key="$1"
    local default="$2"
    local value=""
    if [ -f "$ENV_FILE" ]; then
        value=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null \
            | head -1 \
            | cut -d'=' -f2- \
            | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
                  -e 's/^"\(.*\)"$/\1/' -e "s/^'\\(.*\\)'\$/\\1/")
    fi
    echo "${value:-$default}"
}

BBOX=$(read_env MAP_BBOX "11.85,53.98,12.40,54.22")
MAX_ZOOM=$(read_env MAP_MAX_ZOOM "17")

if ! [ -x "$PMTILES_BIN" ]; then
    echo "Installing pmtiles CLI..."

    mkdir -p "$(dirname "$PMTILES_BIN")"

    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)  ARCH_STR="Linux_x86_64" ;;
        aarch64|arm64) ARCH_STR="Linux_arm64"  ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    VERSION=$(curl -fsSL "https://api.github.com/repos/protomaps/go-pmtiles/releases/latest" \
        | grep '"tag_name"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/')

    if [ -z "$VERSION" ]; then
        echo "Could not determine pmtiles version."
        exit 1
    fi

    echo "Version: ${VERSION}, architecture: ${ARCH_STR}"

    curl -fsSL \
        "https://github.com/protomaps/go-pmtiles/releases/download/v${VERSION}/go-pmtiles_${VERSION}_${ARCH_STR}.tar.gz" \
        -o /tmp/pmtiles.tar.gz

    tar -xzf /tmp/pmtiles.tar.gz -C "$(dirname "$PMTILES_BIN")" pmtiles
    rm /tmp/pmtiles.tar.gz
    chmod +x "$PMTILES_BIN"

    echo "pmtiles ${VERSION} installed at ${PMTILES_BIN}."
fi

mkdir -p "$(dirname "$OUTPUT")"

echo ""
echo "Looking up latest Protomaps build..."

URL=""
DATE=""
for i in 0 1 2 3; do
    DATE=$(date -u -d "${i} days ago" +%Y%m%d 2>/dev/null \
        || date -u -v-${i}d +%Y%m%d)
    URL="https://build.protomaps.com/${DATE}.pmtiles"

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --head "$URL")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "206" ]; then
        echo "Using build from ${DATE}"
        break
    fi
    echo "  ${DATE}: not available (HTTP ${STATUS})"
    DATE=""
done

if [ -z "$DATE" ]; then
    echo "No Protomaps build found in the last 4 days."
    exit 1
fi

echo "Extracting bbox: ${BBOX} (maxzoom=${MAX_ZOOM})..."
echo "Source: ${URL}"
echo "Target: ${OUTPUT}"
echo ""

"$PMTILES_BIN" extract "$URL" "$OUTPUT" \
    --bbox="$BBOX" \
    --maxzoom="$MAX_ZOOM"

echo ""
echo "Done."
ls -lh "$OUTPUT"
