<script setup lang="ts">
import { ref } from 'vue'
import HomeView from './views/HomeView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsModal from './components/SettingsModal.vue'

const currentScreen = ref<'home' | 'history'>('home')
const showSettings = ref(false)
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">🎬</span>
        <span class="brand-name">Mediacript</span>
      </div>

      <nav class="tabs">
        <button
          class="tab"
          :class="{ active: currentScreen === 'home' }"
          @click="currentScreen = 'home'"
        >
          Início
        </button>
        <button
          class="tab"
          :class="{ active: currentScreen === 'history' }"
          @click="currentScreen = 'history'"
        >
          Histórico
        </button>
      </nav>

      <button class="btn btn-ghost icon-btn" title="Configurações" @click="showSettings = true">
        ⚙️
      </button>
    </header>

    <main class="content">
      <HomeView v-if="currentScreen === 'home'" />
      <HistoryView v-else @retry="currentScreen = 'home'" />
    </main>

    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
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

.tabs {
  display: flex;
  gap: 4px;
  margin-left: 12px;
  -webkit-app-region: no-drag;
}

.tab {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 8px;
}

.tab:hover {
  background: var(--border);
}

.tab.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.icon-btn {
  margin-left: auto;
  font-size: 16px;
  padding: 7px 10px;
  -webkit-app-region: no-drag;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>
