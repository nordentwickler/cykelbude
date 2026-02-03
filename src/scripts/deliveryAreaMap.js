// Standalone Liefergebietskarte
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Mapbox Access Token
mapboxgl.accessToken =
    'pk.eyJ1IjoibWFydG9ub3MiLCJhIjoiY21qZThiZW5oMGRoMjNlczUza3ljY3F5dSJ9.4c-7Y2VEmPxqpe8MBFXYiA'

// Popup für Gebietsanzeige
let activePopup = null

const initDeliveryAreaMap = async () => {
    const mapContainer = document.getElementById('delivery-areas-map')
    if (!mapContainer) return

    // Styling für Popup Close Button hinzufügen
    if (!document.getElementById('delivery-area-map-styles')) {
        const style = document.createElement('style')
        style.id = 'delivery-area-map-styles'
        style.textContent = `
            .mapboxgl-popup-close-button {
                padding: 3px !important;
            }
        `
        document.head.appendChild(style)
    }

    try {
        // Pricing-Daten laden für Area-Definitionen
        const pricingResponse = await fetch('/data/pricing.json')
        const pricing = await pricingResponse.json()

        // GeoJSON laden
        const geoResponse = await fetch('/data/areas.json')
        const fullGeoJSON = await geoResponse.json()

        // Features nach delivery_area gruppieren
        const geoJSONData = {}
        Object.keys(pricing.areas).forEach((areaKey) => {
            const areaLabel = pricing.areas[areaKey].label
            const features = fullGeoJSON.features.filter((feature) => {
                const deliveryArea = feature.properties.delivery_area
                return (
                    deliveryArea &&
                    deliveryArea.toLowerCase() === areaLabel.toLowerCase()
                )
            })
            geoJSONData[areaKey] = {
                type: 'FeatureCollection',
                features: features,
            }
        })

        // Karte initialisieren
        const map = new mapboxgl.Map({
            container: 'delivery-areas-map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [12.13, 54.09], // Rostock
            zoom: 11,
        })

        map.on('load', () => {
            let bounds = null

            // Für jede Area ein Layer hinzufügen
            Object.entries(geoJSONData).forEach(([areaKey, geoJSON]) => {
                const areaData = pricing.areas[areaKey]

                // Bounds berechnen
                if (geoJSON.features && geoJSON.features.length > 0) {
                    geoJSON.features.forEach((feature) => {
                        if (feature.geometry && feature.geometry.coordinates) {
                            feature.geometry.coordinates[0].forEach((coord) => {
                                if (!bounds) {
                                    bounds = new mapboxgl.LngLatBounds(
                                        coord,
                                        coord
                                    )
                                } else {
                                    bounds.extend(coord)
                                }
                            })
                        }
                    })
                }

                // Polygon-Layer
                map.addSource(`area-${areaKey}`, {
                    type: 'geojson',
                    data: geoJSON,
                })

                map.addLayer({
                    id: `area-${areaKey}-fill`,
                    type: 'fill',
                    source: `area-${areaKey}`,
                    paint: {
                        'fill-color':
                            areaKey === 'standard'
                                ? '#ff1493' // Pink
                                : areaKey === 'stadtrand'
                                  ? '#68c3cd' // Mint
                                  : '#6b7db3', // Helleres Navy
                        'fill-opacity': 0.5,
                    },
                })

                map.addLayer({
                    id: `area-${areaKey}-outline`,
                    type: 'line',
                    source: `area-${areaKey}`,
                    paint: {
                        'line-color': '#FFFFFF',
                        'line-width': 2,
                    },
                })

                // Click-Handler für Gebietsanzeige
                map.on('click', `area-${areaKey}-fill`, (e) => {
                    // Vorheriges Popup entfernen
                    if (activePopup) {
                        activePopup.remove()
                    }

                    // Neues Popup erstellen
                    const coordinates = e.lngLat
                    const areaName = areaData.label

                    activePopup = new mapboxgl.Popup({
                        closeButton: true,
                        closeOnClick: false,
                    })
                        .setLngLat(coordinates)
                        .setHTML(
                            `<div style="padding: 8px; font-weight: bold; color: #1e3a5f;">${areaName}</div>`
                        )
                        .addTo(map)
                })

                // Cursor-Pointer beim Hover
                map.on('mouseenter', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = 'pointer'
                })

                map.on('mouseleave', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = ''
                })
            })

            // Auf alle Features zoomen
            if (bounds) {
                map.fitBounds(bounds, { padding: 40 })
            }
        })

        // Resize bei summary/details open
        const details = mapContainer.closest('details')
        if (details) {
            details.addEventListener('toggle', () => {
                if (details.open) {
                    setTimeout(() => map.resize(), 100)
                }
            })
        }
    } catch (error) {
        console.error('Fehler beim Laden der Delivery Area Map:', error)
    }
}

// Map initialisieren wenn DOM bereit ist
document.addEventListener('DOMContentLoaded', initDeliveryAreaMap)
