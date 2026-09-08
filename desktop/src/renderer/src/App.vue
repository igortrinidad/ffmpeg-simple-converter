<script setup lang="ts">
import AppShell from './shell/AppShell.vue'
import ScreencastControlWidget from './modules/screencast/ScreencastControlWidget.vue'
import MeetingControlWidget from './modules/meetings/MeetingControlWidget.vue'

const isScreencastControl = window.location.hash.startsWith('#/screencast-control')
const isMeetingControl = window.location.hash.startsWith('#/meeting-control')

if (isScreencastControl || isMeetingControl) {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}
</script>

<template>
  <ScreencastControlWidget v-if="isScreencastControl" />
  <MeetingControlWidget v-else-if="isMeetingControl" />
  <AppShell v-else />
</template>
