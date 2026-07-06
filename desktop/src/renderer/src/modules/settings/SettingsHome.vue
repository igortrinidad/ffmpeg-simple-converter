<script setup lang="ts">
const emit = defineEmits<{
  select: [view: 'api-keys' | 'fallback-ai' | 'general']
}>()

const ROWS = [
  { id: 'api-keys' as const, icon: '🔑', label: 'Chaves de API', description: 'Transcrição e IA de destaques' },
  { id: 'fallback-ai' as const, icon: '🤖', label: 'IA de destaques (fallback)', description: 'Ordem de modelos alternativos' },
  { id: 'general' as const, icon: '📁', label: 'Geral', description: 'Pasta de saída padrão' }
]
</script>

<template>
  <div class="settings-home">
    <h2>Settings</h2>
    <ul class="settings-list">
      <li v-for="row in ROWS" :key="row.id" class="settings-row card" @click="emit('select', row.id)">
        <span class="row-icon">{{ row.icon }}</span>
        <div class="row-text">
          <div class="row-label">{{ row.label }}</div>
          <div class="row-description">{{ row.description }}</div>
        </div>
        <span class="row-chevron">›</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.settings-home {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-home h2 {
  font-size: 18px;
  margin: 0;
}

.settings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.settings-row:hover {
  border-color: var(--accent);
}

.row-icon {
  font-size: 20px;
}

.row-text {
  flex: 1;
}

.row-label {
  font-weight: 600;
  font-size: 14px;
}

.row-description {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.row-chevron {
  color: var(--text-muted);
  font-size: 18px;
}
</style>
