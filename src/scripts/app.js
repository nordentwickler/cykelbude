import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AOS from 'aos'
import 'aos/dist/aos.css'

import '@styles/app.css'
import './navigation.js'
import './heroSlideshow.js'

// Karten-Code (MapLibre GL, ~290 KB JS + CSS) nur auf Seiten laden, die eine
// Karte enthalten. Dynamisches import() lagert MapLibre in einen eigenen
// Chunk aus, der auf allen anderen Seiten nicht geladen wird.
if (document.getElementById('calculator-content')) {
    import('./priceCalculator.js').then((m) => m.initPriceCalculator())
}
if (document.getElementById('delivery-areas-map')) {
    import('./deliveryAreaMap.js').then((m) => m.initDeliveryAreaMap())
}

const app = createApp({
    components: {},
});

const pinia = createPinia()
app.use(pinia)

app.mount('#app')

AOS.init()
