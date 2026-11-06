<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SourceRef } from '@/types'

const props = defineProps<{
  index: number
  source?: SourceRef | null
}>()

const emit = defineEmits<{
  'click-source': [source: SourceRef]
}>()

const hovered = ref(false)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const iconByType: Record<string, string> = {
  web: '\u{1F310}',
  mcp: '\u{1F50C}',
  knowledge: '\u{1F4DA}',
}

const sourceIcon = computed(() => {
  if (!props.source) return ''
  return iconByType[props.source.type] || '\u{1F4CE}'
})

const sourceTitle = computed(() => {
  if (!props.source) return `[${props.index}]`
  return props.source.title || `[${props.index}]`
})

const sourceDomain = computed(() => {
  if (!props.source) return ''
  if (props.source.type === 'web') return props.source.source || ''
  if (props.source.type === 'mcp') return props.source.mcpName || ''
  return ''
})

const sourceDate = computed(() => {
  if (!props.source || !props.source.date) return ''
  const d = new Date(props.source.date)
  if (Number.isNaN(d.getTime())) return props.source.date
  return d.toLocaleDateString()
})

function onMouseEnter() {
  hoverTimer = setTimeout(() => {
    hovered.value = true
  }, 1000)
}

function onMouseLeave() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  hovered.value = false
}

function onClick() {
  if (!props.source) return
  emit('click-source', props.source)
}
</script>

<template>
  <span
    class="source-badge-comp"
    :class="{ 'has-source': !!source }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click.stop="onClick"
  >
    <span class="source-badge-comp__index">[{{ index }}]</span>

    <!-- Hover tooltip -->
    <Transition name="source-tip-fade">
      <div v-if="hovered && source" class="source-badge-comp__tooltip">
        <div class="source-badge-comp__tooltip-header">
          <span class="source-badge-comp__tooltip-icon">{{ sourceIcon }}</span>
          <span class="source-badge-comp__tooltip-title">{{ sourceTitle }}</span>
        </div>
        <div v-if="sourceDomain" class="source-badge-comp__tooltip-domain">{{ sourceDomain }}</div>
        <div v-if="sourceDate" class="source-badge-comp__tooltip-date">{{ sourceDate }}</div>
        <div v-if="source.snippet" class="source-badge-comp__tooltip-snippet">{{ source.snippet }}</div>
      </div>
    </Transition>
  </span>
</template>

<style scoped>
.source-badge-comp {
  position: relative;
  display: inline;
  cursor: default;
}

.source-badge-comp.has-source {
  cursor: pointer;
}

.source-badge-comp__index {
  color: var(--el-color-primary);
  font-size: 0.75em;
  font-weight: 600;
  vertical-align: super;
  line-height: 1;
}

.source-badge-comp.has-source .source-badge-comp__index {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.source-badge-comp__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  padding: 10px 14px;
  min-width: 220px;
  max-width: 340px;
  z-index: 1000;
  pointer-events: none;
}

.source-badge-comp__tooltip-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.source-badge-comp__tooltip-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.source-badge-comp__tooltip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-badge-comp__tooltip-domain {
  font-size: 11px;
  color: var(--el-color-success);
  margin-bottom: 2px;
}

.source-badge-comp__tooltip-date {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.source-badge-comp__tooltip-snippet {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  max-height: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.source-tip-fade-enter-active,
.source-tip-fade-leave-active {
  transition: opacity 0.15s ease;
}

.source-tip-fade-enter-from,
.source-tip-fade-leave-to {
  opacity: 0;
}
</style>