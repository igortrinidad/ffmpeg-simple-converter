<script setup lang="ts">
import AppShell from './shell/AppShell.vue'
import ScreencastControlWidget from './modules/screencast/ScreencastControlWidget.vue'

const isControlWindow = window.location.hash === '#/screencast-control'
if (isControlWindow) {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}
</script>

<template>
  <ScreencastControlWidget v-if="isControlWindow" />
  <AppShell v-else />
</template>
