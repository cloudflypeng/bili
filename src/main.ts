import { createApp } from 'vue'
import App from './App.vue'

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice'
import Aura from '@primevue/themes/aura';

import './style.css'
import './demos/ipc'
// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'
import { createPinia } from 'pinia'

const app = createApp(App);
const pinia = createPinia()

app.use(PrimeVue, {
  theme: {
    preset: Aura
  }
});
app.use(ToastService)
app.use(pinia)

app
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })




