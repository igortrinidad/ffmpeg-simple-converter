<script setup lang="ts">
import BottomNav from './BottomNav.vue'
import { useNavigation } from '../composables/useNavigation'
import ChatFlow from '../modules/chat/ChatFlow.vue'
import AgentsFlow from '../modules/agents/AgentsFlow.vue'
import ConvertFlow from '../modules/convert/ConvertFlow.vue'
import CompressFlow from '../modules/compress/CompressFlow.vue'
import ScreencastFlow from '../modules/screencast/ScreencastFlow.vue'
import HistoryFlow from '../modules/history/HistoryFlow.vue'
import SettingsFlow from '../modules/settings/SettingsFlow.vue'
import { useSettings } from '../composables/useSettings'
import { onMounted } from 'vue'

const nav = useNavigation()
const { load: loadSettings } = useSettings()

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">🎬</span>
        <span class="brand-name">Mediacript</span>
      </div>
    </header>

    <main class="content">
      <ChatFlow v-show="nav.state.active === 'chat'" />
      <AgentsFlow v-if="nav.state.active === 'agents'" />
      <ConvertFlow v-if="nav.state.active === 'convert'" />
      <CompressFlow v-if="nav.state.active === 'compress'" />
      <ScreencastFlow v-if="nav.state.active === 'screencast'" />
      <HistoryFlow v-if="nav.state.active === 'history'" />
      <SettingsFlow v-if="nav.state.active === 'settings'" />
    </main>

    <BottomNav :active="nav.state.active" @select="nav.go" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.topbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  -webkit-app-region: drag;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
}

.brand-mark {
  font-size: 18px;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 24px 140px;
}
</style>
