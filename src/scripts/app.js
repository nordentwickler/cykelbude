import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AOS from 'aos'
import 'aos/dist/aos.css'

import '@styles/app.css'
import './navigation.js'
import './priceCalculator.js'
import './deliveryAreaMap.js'

const app = createApp({
    components: {},
});

const pinia = createPinia()
app.use(pinia)

app.mount('#app')

AOS.init()
