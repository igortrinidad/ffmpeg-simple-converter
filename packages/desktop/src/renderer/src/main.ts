import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { useTheme } from './composables/useTheme'

// Applies the stored theme before mounting so the UI never flashes in the
// wrong palette while the config round-trip is in flight.
useTheme()
  .init()
  .finally(() => {
    createApp(App).mount('#app')
  })
