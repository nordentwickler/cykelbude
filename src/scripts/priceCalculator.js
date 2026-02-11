// Preisrechner für Fahrradkurier-Kollektiv
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken =
    'pk.eyJ1IjoibWFydG9ub3MiLCJhIjoiY21qZThiZW5oMGRoMjNlczUza3ljY3F5dSJ9.4c-7Y2VEmPxqpe8MBFXYiA'

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('calculator-content')
    if (!container) return

    let pricing = null
    let pickupMap = null
    let deliveryMap = null
    let selectedPickupArea = null
    let selectedDeliveryArea = null
    let pickupSelected = false

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

    // Cent zu Euro formatieren
    const formatPrice = (cents) => {
        const euros = cents / 100
        return (
            euros.toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }) + ' €'
        )
    }

    // Dynamische Teile aus pricing.json ins DOM schreiben
    const renderDynamicParts = () => {
        // Zustellzeit-Optionen
        const optionsContainer = document.getElementById('delivery-time-options')
        if (optionsContainer) {
            optionsContainer.innerHTML = Object.entries(pricing.delivery)
                .map(([key, data], index) => {
                    const priceText =
                        data.surcharge > 0 ? ` (+${formatPrice(data.surcharge)})` : ''
                    const checked = index === 0 ? 'checked' : ''
                    return `
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="delivery-time" value="${key}" ${checked} class="w-4 h-4 text-pink focus:ring-pink">
                            <span class="text-base text-navy">${data.label}${priceText}</span>
                        </label>
                    `
                })
                .join('')
        }

        // MwSt.-Label
        const vatLabel = document.getElementById('vat-label')
        if (vatLabel) {
            vatLabel.textContent = `inkl. ${pricing.vat}% MwSt.:`
        }
    }

    // GeoJSON laden
    const loadGeoJSON = async () => {
        try {
            const response = await fetch('/data/areas.json')
            const fullGeoJSON = await response.json()
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

            return geoJSONData
        } catch (error) {
            console.error('GeoJSON konnte nicht geladen werden:', error)
            return {}
        }
    }

    // Mapbox-Karte initialisieren
    const initMap = (containerId, geoJSONData, onAreaSelect) => {
        const map = new mapboxgl.Map({
            container: containerId,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [12.13, 54.09],
            zoom: 11,
        })

        map.on('load', () => {
            let bounds = null

            Object.entries(geoJSONData).forEach(([areaKey, geoJSON]) => {
                if (geoJSON.features && geoJSON.features.length > 0) {
                    geoJSON.features.forEach((feature) => {
                        if (feature.geometry && feature.geometry.coordinates) {
                            feature.geometry.coordinates[0].forEach((coord) => {
                                if (!bounds) {
                                    bounds = new mapboxgl.LngLatBounds(coord, coord)
                                } else {
                                    bounds.extend(coord)
                                }
                            })
                        }
                    })
                }

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
                                ? '#ff1493'
                                : areaKey === 'stadtrand'
                                  ? '#68c3cd'
                                  : '#6b7db3',
                        'fill-opacity': 0.4,
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

                map.on('click', `area-${areaKey}-fill`, () => {
                    onAreaSelect(areaKey, pricing.areas[areaKey].label)
                    highlightArea(map, areaKey)
                })

                map.on('mouseenter', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = 'pointer'
                })

                map.on('mouseleave', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = ''
                })
            })

            if (bounds) {
                map.fitBounds(bounds, { padding: 40 })
            }
        })

        return map
    }

    // Area hervorheben
    const highlightArea = (map, selectedAreaKey) => {
        Object.keys(pricing.areas).forEach((areaKey) => {
            const isSelected = areaKey === selectedAreaKey
            map.setPaintProperty(
                `area-${areaKey}-fill`,
                'fill-opacity',
                isSelected ? 0.8 : 0.2
            )
            map.setPaintProperty(
                `area-${areaKey}-outline`,
                'line-width',
                isSelected ? 4 : 2
            )
        })
    }

    // Lieferkarte aktivieren/deaktivieren
    const setDeliveryMapEnabled = (enabled) => {
        const overlay = document.getElementById('delivery-map-overlay')
        if (enabled) {
            overlay.classList.add('hidden')
            if (deliveryMap) {
                deliveryMap.resize()
                if (pickupMap) {
                    deliveryMap.setCenter(pickupMap.getCenter())
                    deliveryMap.setZoom(pickupMap.getZoom())
                }
            }
        } else {
            overlay.classList.remove('hidden')
        }
    }

    // Gesamtgewicht direkt aus DOM lesen
    const calculateTotalWeight = () => {
        const inputs = document.querySelectorAll('#packages-container input[type="number"]')
        let total = 0
        inputs.forEach((input) => {
            total += parseFloat(input.value) || 0
        })
        return total
    }

    // Paketnummern im DOM neu durchnummerieren
    const renumberPackages = () => {
        const packagesContainer = document.getElementById('packages-container')
        if (!packagesContainer) return
        const rows = packagesContainer.querySelectorAll('.package-row')
        rows.forEach((row, i) => {
            const label = row.querySelector('.package-label')
            if (label) label.textContent = `Paket ${i + 1}:`
            const removeBtn = row.querySelector('[data-remove-package]')
            if (removeBtn) removeBtn.setAttribute('aria-label', `Paket ${i + 1} entfernen`)
        })
    }

    // Gewichtsklasse
    const getWeightClass = (totalWeight) => {
        if (totalWeight <= 0) {
            const first = pricing.weightClasses[0]
            return { ...first, displayLabel: `${first.label} (${first.min}–${first.max} kg)` }
        }
        for (const weightClass of pricing.weightClasses) {
            if (totalWeight >= weightClass.min && totalWeight <= weightClass.max) {
                return {
                    ...weightClass,
                    displayLabel: `${weightClass.label} (${weightClass.min}–${weightClass.max} kg)`,
                }
            }
        }
        return pricing.weightClasses[pricing.weightClasses.length - 1]
    }

    // Preis berechnen
    const calculatePrice = () => {
        const deliveryTimeRadio = document.querySelector(
            'input[name="delivery-time"]:checked'
        )
        const weightTotalEl = document.getElementById('weight-total')
        const weightClassEl = document.getElementById('weight-class')
        const priceNettoEl = document.getElementById('price-netto')
        const priceBruttoEl = document.getElementById('price-brutto')

        if (!deliveryTimeRadio) return

        const totalWeight = calculateTotalWeight()
        const weightClass = getWeightClass(totalWeight)
        const deliveryTimeKey = deliveryTimeRadio.value

        const pickupAreaFee = selectedPickupArea
            ? pricing.areas[selectedPickupArea].surcharge
            : 0
        const deliveryAreaFee = selectedDeliveryArea
            ? pricing.areas[selectedDeliveryArea].surcharge
            : 0
        const areaFee = Math.max(pickupAreaFee, deliveryAreaFee)
        const deliveryTimeFee = pricing.delivery[deliveryTimeKey].surcharge
        const weightClassFee = weightClass.surcharges[deliveryTimeKey]

        const netto =
            pricing.basePrice * 2 + areaFee + weightClassFee + deliveryTimeFee
        const brutto = Math.round(netto * (1 + pricing.vat / 100))

        weightTotalEl.textContent = totalWeight.toFixed(1)
        weightClassEl.textContent = weightClass.displayLabel
        priceNettoEl.textContent = formatPrice(netto)
        priceBruttoEl.textContent = formatPrice(brutto)
    }

    // Paket hinzufügen
    const addPackage = () => {
        const packagesContainer = document.getElementById('packages-container')
        const count = packagesContainer.querySelectorAll('.package-row').length

        const packageEl = document.createElement('div')
        packageEl.className = 'package-row flex items-center gap-3'

        packageEl.innerHTML = `
            <label class="flex-1">
                <span class="sr-only">Paket Gewicht in kg</span>
                <div class="flex items-center gap-2">
                    <span class="package-label text-base text-navy font-bold min-w-[70px]">Paket ${count + 1}:</span>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value="5"
                        placeholder="kg"
                        class="flex-1 p-2 text-base border-2 border-navy rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-pink"
                    >
                    <span class="text-base text-navy">kg</span>
                </div>
            </label>
            <button
                type="button"
                data-remove-package
                class="bg-white text-navy p-2 rounded-lg hover:bg-pink hover:text-navy transition-colors"
                aria-label="Paket ${count + 1} entfernen"
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </button>
        `

        packagesContainer.appendChild(packageEl)

        packageEl.querySelector('input').addEventListener('input', calculatePrice)
        packageEl.querySelector('[data-remove-package]').addEventListener('click', () => {
            packageEl.remove()
            renumberPackages()
            calculatePrice()
        })

        calculatePrice()
    }

    // Dynamische Teile rendern
    renderDynamicParts()

    // Event Listeners
    document.querySelectorAll('input[name="delivery-time"]').forEach((radio) => {
        radio.addEventListener('change', calculatePrice)
    })
    document.getElementById('add-package').addEventListener('click', addPackage)

    // GeoJSON laden & Karten initialisieren
    const geoJSONData = await loadGeoJSON()

    pickupMap = initMap('pickup-map', geoJSONData, (areaKey, areaLabel) => {
        selectedPickupArea = areaKey
        pickupSelected = true
        document.getElementById('pickup-area-display').textContent = areaLabel
        document.getElementById('pickup-hint').classList.add('hidden')

        setDeliveryMapEnabled(true)
        document.getElementById('delivery-hint').classList.remove('hidden')

        calculatePrice()
    })

    deliveryMap = initMap('delivery-map', geoJSONData, (areaKey, areaLabel) => {
        if (!pickupSelected) return
        selectedDeliveryArea = areaKey
        document.getElementById('delivery-area-display').textContent = areaLabel
        document.getElementById('delivery-hint').classList.add('hidden')
        calculatePrice()
    })

    // Erstes Paket hinzufügen
    addPackage()
})
