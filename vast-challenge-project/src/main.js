import { createApp } from 'vue'
//import './style.css' // (O il tuo file CSS se diverso)
import App from './App.vue'

// 1. IMPORTA IL ROUTER CHE HAI CREATO
import router from './router' 

const app = createApp(App)

// 2. DILLI ALL'APP DI USARE IL ROUTER
app.use(router)

app.mount('#app')