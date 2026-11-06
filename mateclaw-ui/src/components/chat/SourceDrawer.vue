<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SourceRef } from '@/types'

const props = defineProps<{
  sources: SourceRef[]
  visible: boolean
}>()

const emit = defineEmits<{
  'hide': []
}>()

const detailSource = ref<SourceRef | null>(null)
const showDetail = ref(false)

function openDetail(source: SourceRef) {
  detailSource.value = source
  showDetail.value = true
}

function backToList() {
  showDetail.value = false
  detailSource.value = null
}

const sortedSources = computed(() => {
  return [...props.sources].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
})

const iconByType: Record<string, string> = {
  web: '\u{1F310}',
  mcp: '\u{1F50C}',
  knowledge: '\u{1F4DA}',
}

const typeLabel: Record<string, string> = {
  web: '\u7F51\u9875',
  mcp: '\u8FDE\u63A5\u5668',
  knowledge: '\u77E5\u8BC6\u5E93',
}

function sourceTypeIcon(type: string) {
  return iconByType[type] || '\u{1F4CE}'
}

function sourceTypeLabel(type: string) {
  return typeLabel[type] || type
}

function handleSourceClick(source: SourceRef) {
  if (source.type === 'web' && source.url) {
    window.open(source.url, '_blank')
  } else {
    openDetail(source)
  }
}
</script>

<template>
  <aside
    v-if="visible"
    class="source-drawer"
  >
    <!-- List view -->
    <template v-if="!showDetail">
      <header class="source-drawer__header">
        <span class="source-drawer__title">参考来源</span>
        <button
          class="source-drawer__close"
          type="button"
          aria-label="关闭来源面板"
          @click="$emit('hide')"
        >×</button>
      </header>

      <div v-if="sortedSources.length === 0" class="source-drawer__empty">
        暂无来源引用
      </div>

      <ul v-else class="source-drawer__list">
        <li
          v-for="source in sortedSources"
          :key="source.index"
          class="source-drawer__item"
          @click="handleSourceClick(source)"
        >
          <span class="source-drawer__item-index">{{ source.index }}</span>
          <span class="source-drawer__item-icon">{{ sourceTypeIcon(source.type) }}</span>
          <div class="source-drawer__item-body">
            <div class="source-drawer__item-title">{{ source.title }}</div>
            <div class="source-drawer__item-meta">
              <span v-if="source.type === 'web' && source.source" class="source-drawer__item-domain">{{ source.source }}</span>
              <span v-else-if="source.type === 'mcp' && source.mcpName" class="source-drawer__item-domain">{{ source.mcpName }} · {{ source.toolName }}</span>
              <span v-else-if="source.type === 'knowledge' && source.fileName" class="source-drawer__item-domain">{{ source.fileName }}</span>
              <span class="source-drawer__item-type">{{ sourceTypeLabel(source.type) }}</span>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <!-- Detail view -->
    <template v-else-if="detailSource">
      <header class="source-drawer__header">
        <button
          class="source-drawer__back"
          type="button"
          aria-label="返回来源列表"
          @click="backToList"
        >← 返回列表</button>
        <button
          class="source-drawer__close"
          type="button"
          aria-label="关闭来源面板"
          @click="$emit('hide')"
        >×</button>
      </header>

      <div class="source-drawer__detail">
        <div class="source-drawer__detail-header">
          <span class="source-drawer__detail-icon">{{ sourceTypeIcon(detailSource.type) }}</span>
          <span class="source-drawer__detail-type">{{ sourceTypeLabel(detailSource.type) }}</span>
        </div>

        <h3 class="source-drawer__detail-title">{{ detailSource.title }}</h3>

        <div v-if="detailSource.type === 'web' && detailSource.url" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">链接</span>
          <a :href="detailSource.url" target="_blank" class="source-drawer__detail-link">{{ detailSource.url }}</a>
        </div>

        <div v-if="detailSource.source" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">来源</span>
          <span class="source-drawer__detail-value">{{ detailSource.source }}</span>
        </div>

        <div v-if="detailSource.date" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">日期</span>
          <span class="source-drawer__detail-value">{{ detailSource.date }}</span>
        </div>

        <div v-if="detailSource.type === 'mcp' && detailSource.mcpName" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">连接器</span>
          <span class="source-drawer__detail-value">{{ detailSource.mcpName }}</span>
        </div>

        <div v-if="detailSource.type === 'mcp' && detailSource.toolName" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">工具</span>
          <span class="source-drawer__detail-value">{{ detailSource.toolName }}</span>
        </div>

        <div v-if="detailSource.type === 'knowledge' && detailSource.fileName" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">文件</span>
          <span class="source-drawer__detail-value">{{ detailSource.fileName }}</span>
        </div>

        <div v-if="detailSource.snippet" class="source-drawer__detail-field">
          <span class="source-drawer__detail-label">摘要</span>
          <p class="source-drawer__detail-snippet">{{ detailSource.snippet }}</p>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.source-drawer {
  width: 320px;
  border-left: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.source-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.source-drawer__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.source-drawer__close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.source-drawer__close:hover {
  color: var(--el-text-color-primary);
}

.source-drawer__back {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
  padding: 0;
}

.source-drawer__back:hover {
  text-decoration: underline;
}

.source-drawer__empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.source-drawer__list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.source-drawer__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.source-drawer__item:hover {
  background: var(--el-fill-color-light);
}

.source-drawer__item-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 2px;
}

.source-drawer__item-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.source-drawer__item-body {
  flex: 1;
  min-width: 0;
}

.source-drawer__item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-drawer__item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.source-drawer__item-domain {
  font-size: 11px;
  color: var(--el-color-success);
}

.source-drawer__item-type {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  padding: 0 6px;
  background: var(--el-fill-color);
  border-radius: 3px;
}

.source-drawer__detail {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.source-drawer__detail-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.source-drawer__detail-icon {
  font-size: 20px;
}

.source-drawer__detail-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 2px 8px;
  background: var(--el-fill-color);
  border-radius: 4px;
}

.source-drawer__detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 16px 0;
  line-height: 1.4;
}

.source-drawer__detail-field {
  margin-bottom: 12px;
}

.source-drawer__detail-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.source-drawer__detail-value {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.source-drawer__detail-link {
  font-size: 13px;
  color: var(--el-color-primary);
  word-break: break-all;
}

.source-drawer__detail-snippet {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}
</style>