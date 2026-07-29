import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import router from './router'
import { useSessionStore } from './stores/session'

// DEBUG TEMPORAL — quitar cuando se resuelva el issue de producción devolviendo datos mock.
// Cada flag usa el patrón `!== 'false'`: si la variable no está definida en el ambiente de build,
// el resultado es MOCK (datos falsos), no real. Este log confirma qué quedó "horneado" en este
// build específico.
console.log('[DEBUG env] MODE=', import.meta.env.MODE, 'DEV=', import.meta.env.DEV, 'PROD=', import.meta.env.PROD);
console.table({
  VITE_MOCK_AUTH: import.meta.env.VITE_MOCK_AUTH,
  VITE_MOCK_SECTORES: import.meta.env.VITE_MOCK_SECTORES,
  VITE_MOCK_PLANTILLAS: import.meta.env.VITE_MOCK_PLANTILLAS,
  VITE_MOCK_ARCHIVOS_EXCEL: import.meta.env.VITE_MOCK_ARCHIVOS_EXCEL,
  VITE_MOCK_EJEMPLOS: import.meta.env.VITE_MOCK_EJEMPLOS,
  VITE_MOCK_USUARIOS: import.meta.env.VITE_MOCK_USUARIOS,
  VITE_MOCK_MENTORIAS: import.meta.env.VITE_MOCK_MENTORIAS,
  VITE_MOCK_FACTURACION: import.meta.env.VITE_MOCK_FACTURACION,
  VITE_MOCK_HISTORIAL: import.meta.env.VITE_MOCK_HISTORIAL,
  VITE_MOCK_ACTIVIDAD: import.meta.env.VITE_MOCK_ACTIVIDAD,
  VITE_SHOW_ACCESO_RAPIDO: import.meta.env.VITE_SHOW_ACCESO_RAPIDO,
});
console.log('[DEBUG env] cada fila de arriba usa mock (datos falsos) salvo que el valor sea exactamente "false".');

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin)

// Resuelve la sesión antes de montar: el guard de rutas en router/index.ts lee session.sesion de
// forma síncrona en la primera navegación, así que debe estar listo antes de app.mount().
await useSessionStore().restaurar()

app.mount('#app')
