<script setup lang="ts">
import { ref } from 'vue'
import SettingsHome from './SettingsHome.vue'
import ApiKeysView from './views/ApiKeysView.vue'
import FallbackAiView from './views/FallbackAiView.vue'
import GeneralView from './views/GeneralView.vue'
import AppearanceView from './views/AppearanceView.vue'

const view = ref<'home' | 'api-keys' | 'fallback-ai' | 'general' | 'appearance'>('home')

function backToHome(): void {
  view.value = 'home'
}
</script>

<template>
  <SettingsHome v-if="view === 'home'" @select="(v) => (view = v)" />
  <ApiKeysView v-else-if="view === 'api-keys'" @back="backToHome" />
  <FallbackAiView v-else-if="view === 'fallback-ai'" @back="backToHome" />
  <GeneralView v-else-if="view === 'general'" @back="backToHome" />
  <AppearanceView v-else-if="view === 'appearance'" @back="backToHome" />
</template>
