// Preisrechner für Fahrradkurier-Kollektiv
//
// Eine Karte: der erste gesetzte Marker ist die Abholung, alle weiteren sind
// Zielstopps. Zustellzeit + Preis stehen im Panel daneben (mobil darunter).
//
// Preismodell (Stopp-basiert):
//   - Ein Auftrag besteht aus 1 Abholung + N Zielstopps.
//   - Jeder Stopp kostet: basePrice + Gewichtsaufschlag der Sendung bei der
//     gewählten Zustellzeit (weightClass.surcharges[nextDay|sameDay]).
//     Die Abholung zählt als Standard-Sendung (kein Gewichtsaufschlag).
//   - Gebietsaufschlag: nur der höchste betroffene Tier, einmalig pro Auftrag.
import {
    createBaseStyle,
    DEFAULT_CENTER,
    DEFAULT_MAX_ZOOM,
    DEFAULT_MIN_ZOOM,
    DEFAULT_ZOOM,
    maplibregl,
    MAX_BOUNDS,
} from './lib/basemap.js'

const AREA_COLORS = {
    standard: '#ea4d65', // Brand-Pink
    stadtrand: '#68c3cd', // Mint
    umland: '#6b7db3',
}

// Klick näher als so viele Pixel an einem Marker-Zentrum setzt keinen neuen
// Stop. Klein halten (~ Marker-Radius): der Marker fängt Direkttreffer selbst
// ab, hier geht es nur um einen minimalen Saum gegen versehentliche Stops.
const NEAR_MARKER_PX = 18

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('calculator-content')
    if (!container) return

    let pricing = null
    let geoJSONData = {}
    let map = null

    // Zustand
    let deliveryTime = null // 'nextDay' | 'sameDay'
    let pickup = null // { areaKey, lngLat }
    let pickupMarker = null
    const deliveries = [] // [{ id, areaKey, weight, marker, badge }]
    let deliveryCounter = 0

    // Preise laden
    try {
        const response = await fetch('/data/pricing.json')
        pricing = await response.json()
    } catch (error) {
        console.error('Fehler beim Laden der Preise:', error)
        container.innerHTML =
            '<p class="text-red-600">Fehler beim Laden der Preisdaten.</p>'
        return
    }

    deliveryTime = Object.keys(pricing.delivery)[0]

    // Cent zu Euro formatieren
    const formatPrice = (cents) =>
        (cents / 100).toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + ' €'

    // Gewichtsklasse zu einem Gewicht ermitteln
    const getWeightClass = (weight) => {
        const w = weight > 0 ? weight : 0
        return (
            pricing.weightClasses.find((wc) => w >= wc.min && w <= wc.max) ||
            pricing.weightClasses[pricing.weightClasses.length - 1]
        )
    }

    // Preis eines einzelnen Stopps: Grundpreis + Gewichtsaufschlag (je Zustellzeit)
    const stopPrice = (weight) =>
        pricing.basePrice + getWeightClass(weight).surcharges[deliveryTime]

    // GeoJSON nach Gebiet gruppieren
    const loadGeoJSON = async () => {
        try {
            const response = await fetch('/data/areas.json')
            const fullGeoJSON = await response.json()
            const grouped = {}

            Object.keys(pricing.areas).forEach((areaKey) => {
                const areaLabel = pricing.areas[areaKey].label
                grouped[areaKey] = {
                    type: 'FeatureCollection',
                    features: fullGeoJSON.features.filter((feature) => {
                        const deliveryArea = feature.properties.delivery_area
                        return (
                            deliveryArea &&
                            deliveryArea.toLowerCase() ===
                                areaLabel.toLowerCase()
                        )
                    }),
                }
            })

            return grouped
        } catch (error) {
            console.error('GeoJSON konnte nicht geladen werden:', error)
            return {}
        }
    }

    // Gebiets-Layer auf die Karte legen und auf alle Features zoomen
    const addAreaLayers = () => {
        let bounds = null

        Object.entries(geoJSONData).forEach(([areaKey, geoJSON]) => {
            geoJSON.features.forEach((feature) => {
                feature.geometry?.coordinates?.[0]?.forEach((coord) => {
                    bounds = bounds
                        ? bounds.extend(coord)
                        : new maplibregl.LngLatBounds(coord, coord)
                })
            })

            map.addSource(`area-${areaKey}`, { type: 'geojson', data: geoJSON })

            map.addLayer({
                id: `area-${areaKey}-fill`,
                type: 'fill',
                source: `area-${areaKey}`,
                paint: {
                    'fill-color': AREA_COLORS[areaKey] ?? '#6b7db3',
                    // Niedrige Deckkraft, damit die Straßen darunter sichtbar bleiben
                    'fill-opacity': 0.25,
                },
            })

            map.addLayer({
                id: `area-${areaKey}-outline`,
                type: 'line',
                source: `area-${areaKey}`,
                paint: { 'line-color': '#FFFFFF', 'line-width': 2 },
            })
        })

        if (bounds) map.fitBounds(bounds, { padding: 40 })
    }

    // Route-Linie (Abholung -> Stop 1 -> Stop 2 ...) anlegen
    const addRouteLine = () => {
        map.addSource('route-line', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [] },
            },
        })
        map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': '#1d2133', // navy
                'line-width': 3,
                'line-opacity': 0.6,
                'line-dasharray': [1.5, 1.5],
            },
        })
    }

    // Route-Linie an die aktuellen Marker-Positionen anpassen
    const updateRouteLine = () => {
        if (!map || !map.getSource('route-line')) return
        const coordinates = []
        if (pickup) coordinates.push(pickup.lngLat.toArray())
        deliveries.forEach((d) => coordinates.push(d.lngLat.toArray()))
        map.getSource('route-line').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates },
        })
    }

    // Gebiet unter einem Kartenpunkt bestimmen
    const areaKeyAt = (lngLat) => {
        const point = map.project(lngLat)
        const layers = Object.keys(pricing.areas).map((k) => `area-${k}-fill`)
        const hit = map.queryRenderedFeatures(point, { layers })[0]
        return hit ? hit.layer.id.replace(/^area-|-fill$/g, '') : null
    }

    // Klick zu nah an einem bestehenden Marker? Dann keinen neuen Stop setzen,
    // damit ein knapp verfehlter Marker-Klick nicht versehentlich einen Stop
    // erzeugt.
    const isNearExistingMarker = (screenPoint) => {
        const markers = [
            pickupMarker,
            ...deliveries.map((d) => d.marker),
        ].filter(Boolean)
        return markers.some((marker) => {
            const p = map.project(marker.getLngLat())
            return (
                Math.hypot(p.x - screenPoint.x, p.y - screenPoint.y) <=
                NEAR_MARKER_PX
            )
        })
    }

    // Marker-Element (Abholung = pink „A", Stop = navy mit Nummer)
    const createMarkerElement = (variant = 'stop') => {
        const el = document.createElement('div')
        const isPickup = variant === 'pickup'
        // Kein transition-transform: MapLibre positioniert den Marker selbst per
        // CSS-transform - eine Transition darauf lässt ihn flackern.
        el.className = `flex h-8 w-8 cursor-grab items-center justify-center rounded-full ${isPickup ? 'bg-pink' : 'bg-navy'} text-white text-base font-bold border-2 border-white shadow-lg hover:ring-2 ${isPickup ? 'hover:ring-navy' : 'hover:ring-pink'} active:cursor-grabbing`
        el.title = isPickup
            ? 'Abholung - ziehen zum Verschieben'
            : 'Ziehen zum Verschieben, klicken zum Bearbeiten'
        if (isPickup) el.textContent = 'A'
        return el
    }

    // --- Abholung ---------------------------------------------------------

    const placePickup = (lngLat, areaKey) => {
        pickup = { areaKey, lngLat }

        const el = createMarkerElement('pickup')
        pickupMarker = new maplibregl.Marker({ element: el, draggable: true })
            .setLngLat(lngLat)
            .addTo(map)
        pickupMarker.on('dragend', () => {
            const pos = pickupMarker.getLngLat()
            const key = areaKeyAt(pos)
            if (key) {
                pickup = { areaKey: key, lngLat: pos }
                refresh()
            } else {
                pickupMarker.setLngLat(pickup.lngLat)
            }
        })

        refresh()
    }

    // --- Stops ------------------------------------------------------------

    // Popover-Inhalt eines Stops: Gewicht eintragen + Stop entfernen
    const buildStopPopup = (delivery) => {
        const wrap = document.createElement('div')
        wrap.className = 'min-w-[180px] p-1'
        wrap.innerHTML = `
            <label class="block text-sm font-bold text-navy mb-1">Gewicht</label>
            <div class="grid grid-cols-5 items-center gap-2 mb-3">
                <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value="${delivery.weight}"
                    aria-label="Gewicht in kg"
                    class="col-span-4 p-2 text-base border-2 border-navy rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-pink"
                >
                <span class="text-base text-navy/70">kg</span>
            </div>
            <button type="button" data-remove class="text-sm font-bold text-pink hover:underline">Stop entfernen</button>
        `
        wrap.querySelector('input').addEventListener('input', (event) => {
            delivery.weight = parseFloat(event.target.value) || 0
            refresh()
        })
        wrap.querySelector('[data-remove]').addEventListener('click', () =>
            removeDelivery(delivery.id)
        )
        return wrap
    }

    const addDelivery = (areaKey, lngLat) => {
        const id = ++deliveryCounter
        const el = createMarkerElement('stop')
        const marker = new maplibregl.Marker({ element: el, draggable: true })
            .setLngLat(lngLat)
            .addTo(map)

        const delivery = { id, areaKey, weight: 5, marker, badge: el, lngLat }
        deliveries.push(delivery)

        // Klick auf den Marker öffnet das Popover (Gewicht + Entfernen).
        const popup = new maplibregl.Popup({
            offset: 24,
            closeButton: true,
            maxWidth: 'none',
        }).setDOMContent(buildStopPopup(delivery))
        marker.setPopup(popup)

        popup.on('open', () => {
            // Immer nur ein Popover offen: beim Öffnen alle anderen schließen
            deliveries.forEach((other) => {
                const otherPopup = other.marker.getPopup()
                if (otherPopup && otherPopup !== popup && otherPopup.isOpen()) {
                    otherPopup.remove()
                }
            })
            // Marker zentrieren, damit das Popover Platz hat und nicht am
            // Kartenrand abgeschnitten wird (v. a. mobil).
            map.easeTo({ center: marker.getLngLat(), duration: 300 })
        })

        marker.on('dragend', () => {
            const pos = marker.getLngLat()
            const newAreaKey = areaKeyAt(pos)
            if (newAreaKey) {
                delivery.areaKey = newAreaKey
                delivery.lngLat = pos
                refresh()
            } else {
                marker.setLngLat(delivery.lngLat)
            }
        })

        refresh()
    }

    const removeDelivery = (id) => {
        const index = deliveries.findIndex((d) => d.id === id)
        if (index === -1) return
        deliveries[index].marker.remove()
        deliveries.splice(index, 1)
        refresh()
    }

    // Marker auf der Karte durchnummerieren (1, 2, 3, ...)
    const renumberMarkers = () => {
        deliveries.forEach((delivery, index) => {
            delivery.badge.textContent = String(index + 1)
        })
    }

    // Stop in der Zusammensetzung anklicken -> Popover togglen (auf/zu).
    // Das Zentrieren übernimmt der 'open'-Handler des Popovers.
    const openStop = (delivery) => {
        const popup = delivery.marker.getPopup()
        if (popup && popup.isOpen()) {
            popup.remove()
            return
        }
        delivery.marker.togglePopup()
    }

    // --- Preis ------------------------------------------------------------

    const calculatePrice = () => {
        const ready = pickup && deliveries.length > 0
        document.getElementById('price-empty').classList.toggle('hidden', ready)
        document
            .getElementById('price-section')
            .classList.toggle('hidden', !ready)
        if (!ready) return

        // Stopp-Preise: Abholung (Standard) + je Stop
        const pickupFee = stopPrice(0)
        const deliveryFees = deliveries.map((d) => stopPrice(d.weight))
        const stopsFee = pickupFee + deliveryFees.reduce((a, b) => a + b, 0)

        // Gebietsaufschlag: höchster betroffener Tier, einmalig
        const areaKeys = [pickup.areaKey, ...deliveries.map((d) => d.areaKey)]
        const topAreaKey = areaKeys.reduce((top, key) =>
            pricing.areas[key].surcharge > pricing.areas[top].surcharge
                ? key
                : top
        )
        const areaFee = pricing.areas[topAreaKey].surcharge

        const netto = stopsFee + areaFee
        const brutto = Math.round(netto * (1 + pricing.vat / 100))

        const breakdown = document.getElementById('price-breakdown')
        breakdown.innerHTML = ''

        // Posten (Abholung/Stop): Badge, Titel, Gebiet + Größe, Preis.
        // Stops sind anklickbar und öffnen ihren Marker.
        const item = ({ badge, badgeBg, title, sub, value, delivery }) => {
            const el = document.createElement(delivery ? 'button' : 'div')
            if (delivery) el.type = 'button'
            el.className =
                'flex w-full items-start gap-3 text-left' +
                (delivery ? ' group cursor-pointer' : '')
            el.innerHTML = `
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${badgeBg} text-white text-xs font-bold">${badge}</span>
                <span class="flex-1 min-w-0">
                    <span class="block font-bold text-navy ${delivery ? 'group-hover:text-pink transition-colors' : ''}">${title}</span>
                    <span class="block text-sm text-navy/60">${sub}</span>
                </span>
                <span class="font-bold text-navy whitespace-nowrap">${formatPrice(value)}</span>
            `
            if (delivery) el.addEventListener('click', () => openStop(delivery))
            breakdown.appendChild(el)
        }

        const areaTag = (label) =>
            `Gebiet: <span class="font-semibold text-navy">${label}</span>`
        const sizeTag = (weight, wc) =>
            `Größe: <span class="font-semibold text-navy">${weight} kg (${wc})</span>`

        item({
            badge: 'A',
            badgeBg: 'bg-pink',
            title: 'Abholung',
            sub: areaTag(pricing.areas[pickup.areaKey].label),
            value: pickupFee,
        })
        deliveries.forEach((d, i) => {
            const wc = getWeightClass(d.weight)
            item({
                badge: String(i + 1),
                badgeBg: 'bg-navy',
                title: `Stop ${i + 1}`,
                sub: `${areaTag(pricing.areas[d.areaKey].label)} · ${sizeTag(d.weight, wc.label)}`,
                value: deliveryFees[i],
                delivery: d,
            })
        })

        // Summenzeilen
        const sumRow = (label, value, cls = '') => {
            const el = document.createElement('div')
            el.className = 'flex items-center justify-between gap-4 ' + cls
            el.innerHTML = `<span>${label}</span><span class="font-bold whitespace-nowrap">${formatPrice(value)}</span>`
            breakdown.appendChild(el)
        }

        sumRow(
            `Zwischensumme - ${1 + deliveries.length} Stopps`,
            stopsFee,
            'border-t border-navy/10 pt-3 mt-3 font-bold text-navy'
        )
        if (areaFee > 0) {
            sumRow(
                `Gebietsaufschlag - ${pricing.areas[topAreaKey].label}`,
                areaFee,
                'text-navy'
            )
        }
        sumRow(
            'Netto gesamt',
            netto,
            'border-t border-navy/10 pt-3 mt-1 font-bold text-pink'
        )

        document.getElementById('price-vat').textContent = formatPrice(
            brutto - netto
        )
        document.getElementById('price-brutto').textContent =
            formatPrice(brutto)
    }

    // --- Hinweis auf der Karte -------------------------------------------

    const updateMapHint = () => {
        const hint = document.getElementById('map-hint')
        if (!pickup) {
            hint.textContent = 'Tippe zuerst deinen Abholort an'
            hint.classList.remove('hidden')
        } else if (deliveries.length === 0) {
            hint.textContent = 'Jetzt die Zielstopps antippen'
            hint.classList.remove('hidden')
        } else {
            hint.classList.add('hidden')
        }
    }

    // Alles neu zeichnen (Route, Preis, Hinweis)
    const refresh = () => {
        renumberMarkers()
        updateRouteLine()
        calculatePrice()
        updateMapHint()
    }

    // --- Zustellzeit ------------------------------------------------------

    const renderDeliveryTimeOptions = () => {
        const optionsContainer = document.getElementById(
            'delivery-time-options'
        )
        optionsContainer.innerHTML = Object.entries(pricing.delivery)
            .map(([key, data], index) => {
                const checked = index === 0 ? 'checked' : ''
                return `
                    <label class="flex-1 cursor-pointer px-4 py-2 text-center leading-tight text-navy transition-colors has-[:checked]:bg-pink has-[:checked]:text-white [&:not(:first-child)]:border-l-2 [&:not(:first-child)]:border-navy has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-pink">
                        <input type="radio" name="delivery-time" value="${key}" ${checked} class="sr-only">
                        <span class="block text-base md:text-lg font-bold">${data.label}</span>
                        <span class="block text-sm md:text-base opacity-80">${data.description ?? ''}</span>
                    </label>
                `
            })
            .join('')

        document.getElementById('vat-label').textContent =
            `inkl. ${pricing.vat}% MwSt.`

        optionsContainer
            .querySelectorAll('input[name="delivery-time"]')
            .forEach((radio) => {
                radio.addEventListener('change', () => {
                    deliveryTime = radio.value
                    calculatePrice()
                })
            })
    }

    // --- Karte ------------------------------------------------------------

    const initMap = () => {
        map = new maplibregl.Map({
            container: 'map',
            style: createBaseStyle(),
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            minZoom: DEFAULT_MIN_ZOOM,
            maxZoom: DEFAULT_MAX_ZOOM,
            maxBounds: MAX_BOUNDS,
        })
        map.addControl(
            new maplibregl.NavigationControl({ showCompass: false }),
            'bottom-left'
        )

        map.on('load', () => {
            addAreaLayers()
            addRouteLine()
            updateRouteLine()
            Object.keys(pricing.areas).forEach((areaKey) => {
                map.on('click', `area-${areaKey}-fill`, (e) => {
                    // Erster Punkt = Abholung, alle weiteren = Stops
                    if (!pickup) {
                        placePickup(e.lngLat, areaKey)
                        return
                    }
                    if (isNearExistingMarker(e.point)) return
                    addDelivery(areaKey, e.lngLat)
                })
                map.on('mouseenter', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = 'pointer'
                })
                map.on('mouseleave', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = ''
                })
            })
            map.resize()
        })
    }

    // --- Initialisierung --------------------------------------------------

    renderDeliveryTimeOptions()
    geoJSONData = await loadGeoJSON()
    refresh()
    requestAnimationFrame(initMap)
})
