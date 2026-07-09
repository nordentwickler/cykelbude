// Shared MapLibre + PMTiles basemap setup.
//
// The vector basemap is served from a self-built PMTiles archive
// (see scripts/build-tiles.sh -> public/cms/map.pmtiles). Fonts (glyphs) and
// POI sprites are self-hosted too (see scripts/build-map-assets.sh); nothing
// is loaded from an external CDN at runtime.
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'

// All served by the webserver from public/cms/, not through Vite.
// MapLibre accepts a relative glyphs URL but requires an absolute sprite URL,
// so the sprite path is prefixed with the current origin at runtime.
const PMTILES_URL = '/cms/map.pmtiles'
const GLYPHS_URL = '/cms/fonts/{fontstack}/{range}.pbf'
const SPRITE_URL = `${window.location.origin}/cms/sprites/light`

// Default map view (Rostock).
export const DEFAULT_CENTER = [12.13, 54.09]
export const DEFAULT_ZOOM = 11

// Keep the view on Rostock and surroundings: don't allow zooming out to the
// whole world and don't allow panning past the tiled region - otherwise the
// map shows grey where no tiles exist.
//
// IMPORTANT: MAX_BOUNDS must stay within the PMTiles extract bbox
// (MAP_BBOX in .env, currently 11.85,53.98,12.40,54.22). Panning beyond the
// tiled area is what produced the grey. Keep these two in sync.
export const DEFAULT_MIN_ZOOM = 10
// Die Quell-Tiles (Protomaps Daily) reichen nur bis Zoom 15. Weiter reinzoomen
// überzoomt nur und wird matschig - daher hier begrenzen.
export const DEFAULT_MAX_ZOOM = 16
export const MAX_BOUNDS = [
    [11.85, 53.98], // southwest
    [12.4, 54.22], // northeast
]

let protocolRegistered = false

// Register the pmtiles:// protocol on MapLibre exactly once.
const registerPmtilesProtocol = () => {
    if (protocolRegistered) return
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    protocolRegistered = true
}

// Build a MapLibre style object backed by the local PMTiles basemap.
export const createBaseStyle = () => {
    registerPmtilesProtocol()

    return {
        version: 8,
        glyphs: GLYPHS_URL,
        sprite: SPRITE_URL,
        sources: {
            protomaps: {
                type: 'vector',
                url: `pmtiles://${PMTILES_URL}`,
                attribution:
                    '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
            },
        },
        layers: layers('protomaps', namedFlavor('light'), { lang: 'de' }),
    }
}

export { maplibregl }
