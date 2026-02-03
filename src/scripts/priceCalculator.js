// Preisrechner für Fahrradkurier-Kollektiv
import mapboxgl from 'mapbox-gl'

import 'mapbox-gl/dist/mapbox-gl.css'

// WICHTIG: Mapbox Access Token hier eintragen
mapboxgl.accessToken =
    'pk.eyJ1IjoibWFydG9ub3MiLCJhIjoiY21qZThiZW5oMGRoMjNlczUza3ljY3F5dSJ9.4c-7Y2VEmPxqpe8MBFXYiA'

// Standalone Delivery Area Map (kann überall platziert werden)
const initDeliveryAreaMap = async () => {
    const mapContainer = document.getElementById('delivery-area-map')
    if (!mapContainer) return

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
            container: 'delivery-area-map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [12.13, 54.09], // Rostock
            zoom: 11,
        })

        map.on('load', () => {
            let bounds = null

            // Für jede Area ein Layer hinzufügen
            Object.entries(geoJSONData).forEach(([areaKey, geoJSON]) => {
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

document.addEventListener('DOMContentLoaded', async () => {
    // Standalone Delivery Area Map initialisieren
    initDeliveryAreaMap()

    const container = document.getElementById('calculator-content')
    if (!container) return

    // Preisdaten
    let pricing = null
    let packages = []
    let pickupMap = null
    let deliveryMap = null
    let selectedPickupArea = 'standard'
    let selectedDeliveryArea = 'standard'

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

    // Cent zu Euro formatieren (deutsche Schreibweise)
    const formatPrice = (cents) => {
        const euros = cents / 100
        return (
            euros.toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }) + ' €'
        )
    }

    // GeoJSON für alle Areas laden
    const loadGeoJSON = async () => {
        try {
            const response = await fetch('/data/areas.json')
            const fullGeoJSON = await response.json()

            console.log(
                'GeoJSON geladen, Anzahl Features:',
                fullGeoJSON.features.length
            )

            // Features nach delivery_area gruppieren
            const geoJSONData = {}

            // Für jede Area eine FeatureCollection erstellen
            Object.keys(pricing.areas).forEach((areaKey) => {
                const areaLabel = pricing.areas[areaKey].label

                // Features filtern, die zu dieser Area gehören
                const features = fullGeoJSON.features.filter((feature) => {
                    const deliveryArea = feature.properties.delivery_area
                    // Case-insensitive Vergleich mit Label
                    return (
                        deliveryArea &&
                        deliveryArea.toLowerCase() === areaLabel.toLowerCase()
                    )
                })

                console.log(
                    `Area "${areaKey}" (Label: "${areaLabel}"): ${features.length} Features gefunden`
                )

                // FeatureCollection für diese Area erstellen
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
            center: [12.13, 54.09], // Rostock
            zoom: 11,
        })

        map.on('load', () => {
            let bounds = null

            // Für jede Area ein Layer hinzufügen
            Object.entries(geoJSONData).forEach(([areaKey, geoJSON]) => {
                // Bounds berechnen für Auto-Zoom
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
                const areaData = pricing.areas[areaKey]

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
                                ? '#ff1493' // Pinker (Deep Pink)
                                : areaKey === 'stadtrand'
                                  ? '#68c3cd' // Mint
                                  : '#6b7db3', // Helleres Navy
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

                // Click-Handler
                map.on('click', `area-${areaKey}-fill`, () => {
                    onAreaSelect(areaKey, areaData.label)
                    highlightArea(map, areaKey)
                })

                // Cursor-Pointer beim Hover
                map.on('mouseenter', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = 'pointer'
                })

                map.on('mouseleave', `area-${areaKey}-fill`, () => {
                    map.getCanvas().style.cursor = ''
                })
            })

            // Karte auf alle Features zoomen
            if (bounds) {
                map.fitBounds(bounds, { padding: 40 })
            }
        })

        return map
    }

    // Area visuell hervorheben
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

    // Formular aufbauen
    const buildForm = () => {
        // Zustellzeit-Optionen
        const deliveryTimeOptions = Object.entries(pricing.delivery)
            .map(([key, data], index) => {
                const priceText =
                    data.surcharge > 0
                        ? ` (+${formatPrice(data.surcharge)})`
                        : ''
                const checked = index === 0 ? 'checked' : ''
                return `
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="delivery-time" value="${key}" ${checked} class="w-4 h-4 text-pink focus:ring-pink">
                        <span class="text-sm text-white">${data.label}${priceText}</span>
                    </label>
                `
            })
            .join('')

        container.innerHTML = `
            <form id="calculator-form" class="space-y-6">
                <div class="grid lg:grid-cols-[1fr_1fr] gap-6">
                    <!-- Linke Spalte: Tabs mit Karten -->
                    <div>
                        <!-- Tab Header -->
                        <div class="flex gap-2">
                            <button type="button" class="tab-button active flex-1 px-6 py-3 text-base font-bold text-white bg-pink rounded-t-lg transition-all cursor-pointer" data-tab="pickup-tab" data-color="pink">
                                Abholgebiet
                            </button>
                            <button type="button" class="tab-button flex-1 px-6 py-3 text-base font-bold text-white bg-white/10 rounded-t-lg transition-all hover:bg-white/20 hover:text-white cursor-pointer" data-tab="delivery-tab" data-color="mint">
                                Liefergebiet
                            </button>
                        </div>

                        <!-- Tab Content -->
                        <div class="tab-content-container">
                            <!-- Abholgebiet Tab -->
                            <div id="pickup-tab" class="tab-content active relative">
                                <div id="pickup-map" class="w-full aspect-[3/4] rounded-b-lg border-4 border-pink"></div>
                                <!-- Hinweise auf der Karte -->
                                <div id="pickup-hint-initial" class="absolute top-4 left-4 right-4 bg-white text-pink p-3 rounded-lg text-center font-bold text-sm shadow-lg">
                                    📍 Abholgebiet auf der Karte wählen
                                </div>
                                <div id="pickup-hint-success" class="absolute top-4 left-4 right-4 bg-pink text-white p-3 rounded-lg text-center font-bold text-sm shadow-lg cursor-pointer hover:bg-pink/80 hover:text-white transition-all hidden">
                                    ✓ Prima, jetzt Liefergebiet auswählen →
                                </div>
                            </div>

                            <!-- Liefergebiet Tab -->
                            <div id="delivery-tab" class="tab-content hidden relative">
                                <div id="delivery-map" class="w-full aspect-[3/4] rounded-b-lg border-4 border-mint"></div>
                                <!-- Hinweis auf der Karte -->
                                <div id="delivery-hint-initial" class="absolute top-4 left-4 right-4 bg-mint/95 text-navy p-3 rounded-lg text-center font-bold text-sm shadow-lg">
                                    📦 Liefergebiet auf der Karte wählen
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rechte Spalte: Andere Daten -->
                    <div class="space-y-4">
                        <!-- Ausgewählte Gebiete -->
                        <div class="bg-white/10 p-5 rounded-lg border-2 border-white">
                            <h3 class="text-base font-bold text-white mb-4">Ausgewählte Gebiete</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-white">📍 Abholgebiet:</span>
                                    <span id="pickup-area-display" class="text-base font-bold text-pink">Standard</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-white">📦 Liefergebiet:</span>
                                    <span id="delivery-area-display" class="text-base font-bold text-mint">Standard</span>
                                </div>
                            </div>
                        </div>

                        <!-- Zustellzeit -->
                        <div class="bg-white/10 p-5 rounded-lg border-2 border-white">
                            <h3 class="text-base font-bold text-white mb-3">Zustellzeit</h3>
                            <div class="flex flex-col gap-2">
                                ${deliveryTimeOptions}
                            </div>
                        </div>

                        <!-- Pakete -->
                        <div class="bg-white/10 p-5 rounded-lg border-2 border-white">
                            <h3 class="text-base font-bold text-white mb-3">Pakete</h3>
                            <div id="packages-container" class="space-y-2 mb-3"></div>
                            <button type="button" id="add-package" class="w-full bg-pink text-white px-4 py-2 rounded-lg hover:bg-pink/80 transition-colors text-sm font-bold">
                                + Paket hinzufügen
                            </button>
                            <div id="total-weight" class="mt-4 pt-4 border-t border-white/30 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-white">Gesamtgewicht:</span>
                                    <span class="text-base font-bold text-white"><span id="weight-total">0</span> kg</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-white">Gewichtsklasse:</span>
                                    <span id="weight-class" class="text-base font-bold text-pink">-</span>
                                </div>
                            </div>
                        </div>

                        <!-- Preis -->
                        <div class="bg-pink p-5 rounded-lg border-2 border-pink">
                            <h3 class="text-xl font-bold text-white mb-4">Preis</h3>
                            <div class="space-y-2 divide-y divide-white/30">
                                <div class="flex justify-between items-center py-2">
                                    <span class="text-base">Netto</span>
                                    <span id="price-netto" class="text-xl font-bold">0,00 €</span>
                                </div>
                                <div class="flex justify-between items-center py-2">
                                    <span class="text-base ">inkl. ${pricing.vat}% MwSt.:</span>
                                    <span id="price-brutto" class="text-base ">0,00 €</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        `

        initializeEventListeners()
        initializeTabs()
    }

    // Tab-Funktionalität
    const initializeTabs = () => {
        const tabButtons = document.querySelectorAll('.tab-button')

        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab')
                switchTab(targetTab)
            })
        })
    }

    // Tab wechseln
    const switchTab = (targetTabId) => {
        // Alle Tab-Buttons und Contents zurücksetzen
        document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.classList.remove('active', 'bg-pink', 'bg-mint')
            btn.classList.add('bg-white/10', 'text-white')
        })

        document.querySelectorAll('.tab-content').forEach((content) => {
            content.classList.remove('active')
            content.classList.add('hidden')
        })

        // Aktiven Tab setzen
        const activeButton = document.querySelector(
            `[data-tab="${targetTabId}"]`
        )
        const activeContent = document.getElementById(targetTabId)

        if (activeButton && activeContent) {
            const tabColor = activeButton.getAttribute('data-color')
            const bgClass = tabColor === 'pink' ? 'bg-pink' : 'bg-mint'

            activeButton.classList.add('active', bgClass)
            activeButton.classList.remove('bg-white/10')
            activeContent.classList.add('active')
            activeContent.classList.remove('hidden')

            // Mapbox Karte neu berechnen nach Tab-Wechsel und Zoom synchronisieren
            setTimeout(() => {
                if (targetTabId === 'pickup-tab' && pickupMap) {
                    pickupMap.resize()
                } else if (targetTabId === 'delivery-tab' && deliveryMap) {
                    deliveryMap.resize()
                    // Zoom von Pickup-Karte übernehmen, falls vorhanden
                    if (pickupMap) {
                        const center = pickupMap.getCenter()
                        const zoom = pickupMap.getZoom()
                        deliveryMap.setCenter(center)
                        deliveryMap.setZoom(zoom)
                    }
                }
            }, 100)
        }
    }

    // Gesamtgewicht berechnen
    const calculateTotalWeight = () => {
        return packages.reduce(
            (sum, weight) => sum + parseFloat(weight || 0),
            0
        )
    }

    // Gewichtsklasse ermitteln
    const getWeightClass = (totalWeight) => {
        for (const weightClass of pricing.weightClasses) {
            if (
                totalWeight >= weightClass.min &&
                totalWeight <= weightClass.max
            ) {
                return {
                    ...weightClass,
                    displayLabel: `${weightClass.label} (${weightClass.min}-${weightClass.max} kg)`,
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

        // Gebühren ermitteln (aus ausgewählten Karten-Areas)
        const pickupAreaFee = pricing.areas[selectedPickupArea].surcharge
        const deliveryAreaFee = pricing.areas[selectedDeliveryArea].surcharge

        // Nur der höchste Gebietsaufschlag wird berechnet (einmalig)
        const areaFee = Math.max(pickupAreaFee, deliveryAreaFee)

        const deliveryTimeFee = pricing.delivery[deliveryTimeKey].surcharge

        // Gewichtsklassen-Aufschlag basierend auf Zustellzeit
        const weightClassFee = weightClass.surcharges[deliveryTimeKey]

        // Netto berechnen
        const netto =
            pricing.basePrice * 2 + // 2 Stops
            areaFee + // Gebietsaufschlag (einmalig, der höchste)
            weightClassFee + // Gewichtsklassen-Aufschlag (abhängig von Zustellzeit)
            deliveryTimeFee // Zeitaufschlag (einmalig)

        // Brutto berechnen
        const brutto = Math.round(netto * (1 + pricing.vat / 100))

        // Anzeige aktualisieren
        weightTotalEl.textContent = totalWeight.toFixed(1)
        weightClassEl.textContent = weightClass.displayLabel
        priceNettoEl.textContent = formatPrice(netto)
        priceBruttoEl.textContent = formatPrice(brutto)
    }

    // Paket hinzufügen
    const addPackage = () => {
        const packagesContainer = document.getElementById('packages-container')
        const index = packages.length
        packages.push(0)

        const packageEl = document.createElement('div')
        packageEl.className = 'flex items-center gap-3'

        // Remove-Button nur anzeigen, wenn mehr als 1 Paket vorhanden ist
        const showRemoveBtn = packages.length > 1

        packageEl.innerHTML = `
            <label class="flex-1">
                <span class="sr-only">Paket ${index + 1} Gewicht in kg</span>
                <div class="flex items-center gap-2">
                    <span class="text-sm text-white font-bold min-w-[70px]">Paket ${index + 1}:</span>
                    <input
                        type="number"
                        data-package-index="${index}"
                        min="0"
                        max="100"
                        step="0.1"
                        value="5"
                        placeholder="kg"
                        class="flex-1 p-2 text-sm border-2 border-navy rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-pink"
                    >
                    <span class="text-sm text-white">kg</span>
                </div>
            </label>
            ${
                showRemoveBtn
                    ? `
                <button
                    type="button"
                    data-remove-package="${index}"
                    class="bg-white text-navy p-2 rounded-lg hover:bg-pink hover:text-navy transition-colors"
                    aria-label="Paket ${index + 1} entfernen"
                >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            `
                    : '<div class="w-8"></div>'
            }
        `

        packagesContainer.appendChild(packageEl)

        // Event Listener für Gewichts-Input
        const input = packageEl.querySelector('input')
        input.addEventListener('input', (e) => {
            packages[index] = parseFloat(e.target.value) || 0
            calculatePrice()
        })

        // Event Listener für Remove-Button (falls vorhanden)
        if (showRemoveBtn) {
            const removeBtn = packageEl.querySelector('[data-remove-package]')
            removeBtn.addEventListener('click', () =>
                removePackage(index, packageEl)
            )
        }

        // Initial mit 5kg befüllen
        packages[index] = 5
        calculatePrice()
        updateRemoveButtons()
    }

    // Paket entfernen
    const removePackage = (index, element) => {
        // Mindestens ein Paket muss vorhanden bleiben
        if (packages.length <= 1) {
            return
        }

        packages.splice(index, 1)
        element.remove()

        // Paketnummern aktualisieren
        const packagesContainer = document.getElementById('packages-container')
        const allPackages = packagesContainer.querySelectorAll(
            '[data-package-index]'
        )
        allPackages.forEach((input, newIndex) => {
            input.dataset.packageIndex = newIndex
            const label = input.closest('label')
            const span = label.querySelector('span.text-white')
            span.textContent = `Paket ${newIndex + 1}:`
        })

        calculatePrice()
        updateRemoveButtons()
    }

    // Remove-Buttons aktualisieren (nur bei mehr als 1 Paket anzeigen)
    const updateRemoveButtons = () => {
        const packagesContainer = document.getElementById('packages-container')
        if (!packagesContainer) return

        const allPackageElements = packagesContainer.querySelectorAll(
            '.flex.items-center.gap-3'
        )

        allPackageElements.forEach((packageEl, index) => {
            const removeBtn = packageEl.querySelector('[data-remove-package]')
            const placeholder = packageEl.querySelector('.w-8')

            if (packages.length <= 1) {
                // Bei nur einem Paket: Remove-Button ausblenden, Platzhalter anzeigen
                if (removeBtn) {
                    removeBtn.style.display = 'none'
                }
                if (!placeholder && removeBtn) {
                    const placeholderDiv = document.createElement('div')
                    placeholderDiv.className = 'w-8'
                    removeBtn.parentNode.replaceChild(placeholderDiv, removeBtn)
                }
            } else {
                // Bei mehreren Paketen: Remove-Button anzeigen
                if (placeholder) {
                    const newRemoveBtn = document.createElement('button')
                    newRemoveBtn.type = 'button'
                    newRemoveBtn.setAttribute('data-remove-package', index)
                    newRemoveBtn.className =
                        'bg-white text-navy p-2 rounded-lg hover:bg-pink hover:text-navy transition-colors'
                    newRemoveBtn.setAttribute(
                        'aria-label',
                        `Paket ${index + 1} entfernen`
                    )
                    newRemoveBtn.innerHTML = `
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    `
                    newRemoveBtn.addEventListener('click', () =>
                        removePackage(index, packageEl)
                    )
                    placeholder.parentNode.replaceChild(
                        newRemoveBtn,
                        placeholder
                    )
                }
            }
        })
    }

    // Event Listeners initialisieren
    const initializeEventListeners = async () => {
        const deliveryTimeRadios = document.querySelectorAll(
            'input[name="delivery-time"]'
        )
        const addPackageBtn = document.getElementById('add-package')

        deliveryTimeRadios.forEach((radio) => {
            radio.addEventListener('change', calculatePrice)
        })
        addPackageBtn.addEventListener('click', addPackage)

        // GeoJSON laden
        const geoJSONData = await loadGeoJSON()

        // Abholkarte initialisieren
        pickupMap = initMap('pickup-map', geoJSONData, (areaKey, areaLabel) => {
            selectedPickupArea = areaKey
            document.getElementById('pickup-area-display').textContent =
                areaLabel
            calculatePrice()

            // Zoom und Center synchronisieren
            if (pickupMap && deliveryMap) {
                const center = pickupMap.getCenter()
                const zoom = pickupMap.getZoom()
                deliveryMap.setCenter(center)
                deliveryMap.setZoom(zoom)
            }

            // Hinweise umschalten
            const initialHint = document.getElementById('pickup-hint-initial')
            const successHint = document.getElementById('pickup-hint-success')
            if (initialHint) initialHint.classList.add('hidden')
            if (successHint) successHint.classList.remove('hidden')
        })

        // Success-Hinweis klickbar machen
        const successHint = document.getElementById('pickup-hint-success')
        if (successHint) {
            successHint.addEventListener('click', () => {
                switchTab('delivery-tab')
            })
        }

        // Lieferkarte initialisieren
        deliveryMap = initMap(
            'delivery-map',
            geoJSONData,
            (areaKey, areaLabel) => {
                selectedDeliveryArea = areaKey
                document.getElementById('delivery-area-display').textContent =
                    areaLabel
                calculatePrice()

                // Hinweis ausblenden nach Auswahl
                const hint = document.getElementById('delivery-hint-initial')
                if (hint) {
                    hint.classList.add('hidden')
                }
            }
        )

        // Initial ein Paket hinzufügen
        addPackage()
    }

    // Formular aufbauen
    buildForm()
})
