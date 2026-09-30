<template>
  <Teleport to="body" :disabled="!isOverlay">
    <aside
      v-if="tabs.length || visible"
      ref="panelRef"
      class="file-preview-panel"
      :class="{ 'is-hidden': !visible, 'is-overlay': isOverlay, 'is-compact': compactViewport, 'is-mobile': isMobile }"
      :role="isOverlay ? 'dialog' : undefined"
      :aria-modal="isOverlay || undefined"
      aria-label="文件预览"
      tabindex="-1"
      @keydown="handleKeydown"
    >
      <header class="file-preview-panel__header">
        <div
          v-if="generatedFiles && generatedFiles.length"
          class="file-preview-panel__header-icon-wrap"
          @mouseenter="showDropdown"
          @mouseleave="hideDropdown"
        >
          <button type="button" class="file-preview-panel__header-icon" :class="{ 'is-active': dropdownOpen }">
            <el-icon><Histogram /></el-icon>
          </button>
          <div v-show="dropdownOpen" class="file-preview-panel__artifact-dropdown">
            <div class="file-preview-panel__artifact-dropdown-title">产物</div>
            <ul class="file-preview-panel__artifact-dropdown-list">
              <li v-for="file in generatedFiles" :key="file.id">
                <button type="button" @click="openArtifact(file.url)">
                  <Icon :icon="fileIconId(file.name)" width="18" class="file-preview-panel__artifact-icon" />
                  {{ file.name }}
                </button>
              </li>
            </ul>
          </div>
        </div>
        <button v-else type="button" class="file-preview-panel__header-icon">
          <el-icon><Histogram /></el-icon>
        </button>
        <div class="file-preview-panel__tabs" role="tablist" aria-label="已打开文件">
          <button
            v-for="tab in tabs"
            :id="`file-tab-${tab.id}`"
            :key="tab.id"
            class="file-preview-panel__tab"
            :class="{ 'is-active': tab.id === activeId }"
            role="tab"
            :aria-selected="tab.id === activeId"
            :aria-controls="`file-panel-${tab.id}`"
            :title="tab.name"
            type="button"
            @click="$emit('activate', tab.id)"
          >
            <Icon :icon="fileIconId(tab.name)" width="14" class="file-preview-panel__tab-icon" />
            <span class="file-preview-panel__tab-name">{{ tab.name }}</span>
            <span class="file-preview-panel__tab-close" :aria-label="`关闭 ${tab.name}`" @click.stop="$emit('close', tab.id)">×</span>
          </button>
        </div>
        <div class="file-preview-panel__actions">
          <button
            v-if="!isMobile"
            type="button"
            :title="fullscreen ? '退出全屏' : '进入全屏'"
            :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
            @click="$emit('toggle-fullscreen')"
          ><el-icon><FullScreen /></el-icon></button>
          <button v-if="!isMobile && !fullscreen" type="button" title="收起预览" aria-label="收起预览" @click="$emit('hide')"><el-icon><Expand /></el-icon></button>
          <button v-if="isMobile" type="button" title="关闭预览" aria-label="关闭预览" @click="$emit('hide')">×</button>
        </div>
      </header>

      <main v-if="!activeTab" class="file-preview-panel__content file-preview-panel__artifacts-view">
        <div class="file-preview-panel__artifacts-header">
          <button class="file-preview-panel__artifacts-toggle" type="button" :aria-expanded="artifactsOpen" @click="artifactsOpen = !artifactsOpen">
            <span class="file-preview-panel__artifacts-title">产物</span>
            <el-icon class="file-preview-panel__artifacts-chevron" v-if="artifactsOpen"><ArrowDownBold /></el-icon>
            <el-icon class="file-preview-panel__artifacts-chevron" v-else><ArrowRightBold /></el-icon>
            <span class="file-preview-panel__artifacts-count">{{ generatedFiles?.length || 0 }}</span>
          </button>
        </div>
        <div v-show="artifactsOpen" class="file-preview-panel__artifacts-body">
          <ul v-if="generatedFiles && generatedFiles.length" class="file-preview-panel__artifacts-list" role="list">
            <li v-for="file in generatedFiles" :key="file.id" class="file-preview-panel__artifact-item" role="listitem">
              <button type="button" :title="file.url" @click="$emit('open-generated', file.url)">
                <Icon :icon="fileIconId(file.name)" width="18" class="file-preview-panel__artifact-icon" />
                <span class="file-preview-panel__artifact-name">{{ file.name }}</span>
              </button>
            </li>
          </ul>
          <div v-else class="file-preview-panel__artifacts-empty">暂无产物</div>
        </div>
      </main>

      <main v-else :id="`file-panel-${activeTab.id}`" class="file-preview-panel__content" role="tabpanel" :aria-labelledby="`file-tab-${activeTab.id}`">
        <div v-if="activeTab.status === 'loading'" class="file-preview-panel__state" aria-live="polite">
          <span class="file-preview-panel__spinner"></span><span>正在加载 {{ activeTab.name }}</span>
        </div>
        <div v-else-if="activeTab.status === 'ready'" ref="markdownRoot" class="file-preview-panel__document" @click="handleDocumentClick">
          <div v-if="activeTab.mode === 'markdown'" class="markdown-body" v-html="renderMarkdown(activeTab.text || '')"></div>
          <CodePreviewer v-else-if="activeTab.mode === 'code'" :source="activeTab.text || ''" :filename="activeTab.name" />
          <pre v-else-if="activeTab.mode === 'text'" class="file-preview-panel__source">{{ activeTab.text }}</pre>
          <iframe v-else-if="activeTab.mode === 'pdf' && activeTab.objectUrl" class="file-preview-panel__pdf" :src="activeTab.objectUrl" :title="activeTab.name"></iframe>
          <div v-else-if="activeTab.mode === 'html'" class="file-preview-panel__document-html" v-html="sanitizeHtml(activeTab.text || '')"></div>
        </div>
        <div v-else class="file-preview-panel__state file-preview-panel__state--error" aria-live="polite">
          <strong>{{ stateTitle(activeTab.status) }}</strong>
          <p>{{ activeTab.errorMessage || '此文件暂时无法在此处预览。' }}</p>
          <div class="file-preview-panel__state-actions">
            <button v-if="activeTab.status === 'error' || activeTab.status === 'not-found'" type="button" @click="$emit('retry', activeTab.id)">重试</button>
            <!-- <button v-if="activeTab.status !== 'expired' && activeTab.status !== 'forbidden'" type="button" @click="$emit('download', activeTab.id)">下载文件</button> -->
          </div>
        </div>
      </main>

      <footer v-if="activeTab" class="file-preview-panel__footer">
        <span :title="activeTab.contentType">{{ displayFileSize(activeTab.size) }} · {{ activeTab.contentType || '未知类型' }}</span>
        <div>
          <button v-if="activeTab.mode !== 'pdf' && activeTab.mode !== 'html' && activeTab.text" type="button" @click="copyAll(activeTab.text)">复制全文</button>
          <button type="button" @click="$emit('download', activeTab.id)">下载</button>
        </div>
      </footer>
    </aside>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Expand, FullScreen } from '@element-plus/icons-vue'
import { getIconForFile } from '@yutengjing/vscode-icons'
import { mcToast } from '@/composables/useMcToast'
import { BREAKPOINTS, useIsMobile, useMediaQuery } from '@/composables/useBreakpoint'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useEChartsRenderer } from '@/composables/useEChartsRenderer'
import { useKatexRenderer } from '@/composables/useKatexRenderer'
import { handleMermaidDownload, useMermaidRenderer } from '@/composables/useMermaidRenderer'
import DOMPurify from 'dompurify'
import CodePreviewer from './CodePreviewer.vue'
import { copyToClipboard } from '@/utils/clipboard'
import { displayFileSize, type FileTab, type FileTabStatus, type GeneratedFileEntry } from '@/utils/filePreview'

const props = defineProps<{
  tabs: FileTab[]
  activeId: string
  visible: boolean
  fullscreen: boolean
  generatedFiles?: GeneratedFileEntry[]
}>()
const emit = defineEmits<{
  activate: [id: string]
  close: [id: string]
  hide: []
  retry: [id: string]
  download: [id: string]
  'toggle-fullscreen': []
  'open-generated': [url: string]
}>()
const { t } = useI18n()
const isMobile = useIsMobile()
const compactViewport = useMediaQuery(BREAKPOINTS.compact)
const panelRef = ref<HTMLElement | null>(null)
const markdownRoot = ref<HTMLElement | null>(null)
const artifactsOpen = ref(true)
const dropdownOpen = ref(false)
let dropdownTimer: ReturnType<typeof setTimeout> | null = null
function showDropdown() {
  if (!activeTab.value) {
    return
  }
  if (dropdownTimer) { 
    clearTimeout(dropdownTimer);
  }
  dropdownOpen.value = true
}
function hideDropdown() { dropdownTimer = setTimeout(() => dropdownOpen.value = false, 150) }
function openArtifact(url: string) { dropdownOpen.value = false; emit('open-generated', url) }
function fileIconId(name: string) {
  const svgName = getIconForFile(name)
  if (!svgName) return 'vscode-icons:default-file'
  const base = svgName.replace(/\.svg$/, '').replace(/_/g, '-')
  return `vscode-icons:${base}`
}
const { renderMarkdown } = useMarkdownRenderer()
const charts = useEChartsRenderer(markdownRoot)
const katex = useKatexRenderer(markdownRoot)
const mermaid = useMermaidRenderer(markdownRoot)
const activeTab = computed(() => props.tabs.find(tab => tab.id === props.activeId))
const isOverlay = computed(() => props.fullscreen || compactViewport.value)
let previousFocus: HTMLElement | null = null

function stateTitle(status: FileTabStatus) {
  return ({ 'too-large': '文件过大', unsupported: '该文件暂不支持预览', expired: '临时文件已过期', forbidden: '没有访问权限', 'not-found': '未找到文件', error: '无法加载文件' } as Partial<Record<FileTabStatus, string>>)[status] || '文件预览'
}
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['colspan', 'rowspan'] })
}
function copyAll(text: string) {
  copyToClipboard(text).then(() => mcToast.success(t('chat.copied'))).catch(() => mcToast.error(t('chat.copyFailed')))
}
function handleDocumentClick(event: MouseEvent) {
  if (handleMermaidDownload(event)) return
  const button = (event.target as HTMLElement).closest<HTMLElement>('.code-block__copy')
  const encoded = button?.dataset.code
  if (!encoded) return
  event.preventDefault()
  void copyAll(decodeURIComponent(encoded))
}
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (props.fullscreen) emit('toggle-fullscreen')
    else emit('hide')
    return
  }
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || props.tabs.length < 2) return
  event.preventDefault()
  const index = props.tabs.findIndex(tab => tab.id === props.activeId)
  const next = event.key === 'ArrowRight' ? (index + 1) % props.tabs.length : (index - 1 + props.tabs.length) % props.tabs.length
  emit('activate', props.tabs[next].id)
}
function lockBody(lock: boolean) {
  document.body.classList.toggle('mc-file-preview-lock', lock)
}
watch(isOverlay, async (overlay) => {
  lockBody(overlay && props.visible)
  if (overlay && props.visible) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    panelRef.value?.focus()
  } else if (!overlay) previousFocus?.focus()
})
watch(() => props.visible, async visible => {
  lockBody(isOverlay.value && visible)
  if (visible) { await nextTick(); charts.startObserving(); katex.startObserving(); mermaid.startObserving() }
  else if (isOverlay.value) previousFocus?.focus()
})
watch(() => activeTab.value?.id, async () => {
  await nextTick()
  charts.scanAndMount(); katex.scanAndMount(); mermaid.scanAndMount()
})
onMounted(() => { charts.startObserving(); katex.startObserving(); mermaid.startObserving() })
onBeforeUnmount(() => { lockBody(false); charts.dispose(); katex.dispose(); mermaid.dispose() })
</script>

<style scoped>
.file-preview-panel { width: clamp(200px, 28vw, 680px); min-width: 0; height: 100%; display: flex; flex-direction: column; background: var(--mc-bg-elevated, #fff); border-left: 1px solid var(--mc-border, #e2e8f0); color: var(--mc-text-primary, #1e293b); z-index: 1; }
.file-preview-panel.is-hidden { display: none; }
.file-preview-panel.is-overlay { position: fixed; inset: 0; z-index: 1200; width: auto; border: 0; background: var(--mc-bg-elevated, #fff); }
.file-preview-panel.is-overlay.is-compact:not(.is-mobile) { left: auto; width: min(560px, 72vw); box-shadow: -12px 0 36px rgba(0,0,0,.16); }
.file-preview-panel__header, .file-preview-panel__footer { display:flex; align-items:center; flex-shrink:0; border-bottom:1px solid var(--mc-border, #e2e8f0); }
.file-preview-panel__header { min-height: 72px; }
.file-preview-panel__header-icon { margin-left: 8px; transform: rotate(90deg) scaleX(-1); }
.file-preview-panel__header-icon-wrap { position: relative; }
.file-preview-panel__artifact-dropdown { position: absolute; top: 100%; left: 4px; z-index: 10; min-width: 200px; max-height: 280px; background: var(--mc-bg-elevated, #fff); border: 1px solid var(--mc-border, #e2e8f0); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.12); overflow: hidden; display: flex; flex-direction: column; }
.file-preview-panel__artifact-dropdown-title { flex-shrink: 0; padding: 8px 14px; font-size: 11px; color: var(--mc-text-tertiary, #94a3b8); border-bottom: 1px solid var(--mc-border, #e2e8f0); }
.file-preview-panel__artifact-dropdown-list { flex: 1; overflow-y: auto; list-style: none; margin: 0; padding: 4px 0; }
.file-preview-panel__artifact-dropdown-list button { display: flex; align-items: center; width: 100%; border: 0; background: transparent; color: var(--mc-text-primary, #1e293b); font: inherit; font-size: 13px; padding: 6px 14px; cursor: pointer; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-preview-panel__artifact-dropdown-list button:hover { background: var(--mc-primary-bg, #fff1eb); color: var(--mc-primary, #d97757); }
.file-preview-panel__artifact-icon { flex-shrink: 0; margin-right: 6px; }
.file-preview-panel__tabs { display:flex; align-items:stretch; gap:2px; min-width:0; overflow:hidden; flex:1; padding-left:8px; }
.file-preview-panel__tab { min-width:0; display:flex; align-items:center; gap:6px; border:0; border-radius:6px; background:transparent; color:var(--mc-text-secondary, #64748b); padding:0 9px; cursor:pointer; }
.file-preview-panel__tab.is-active { color:var(--mc-primary, #d97757); background:var(--mc-primary-bg, #fff1eb); }
.file-preview-panel__tab-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.file-preview-panel__tab-icon { flex-shrink:0; }
.file-preview-panel__tab-close { flex:0 0 auto; font-size:17px; line-height:1; opacity:.65; }
.file-preview-panel__actions { display:flex; gap:4px; padding:0 8px; }
/* .file-preview-panel button { font:inherit; } */
.file-preview-panel__actions button, .file-preview-panel__footer button, .file-preview-panel__state-actions button, .file-preview-panel__header-icon { border:0; border-radius:6px; padding:6px 9px; background:transparent; color:var(--mc-text-secondary, #64748b); cursor:pointer; }
.file-preview-panel__actions button, .file-preview-panel__header-icon { display:flex; align-items:center; justify-content:center; width:32px; height:32px; padding:0; line-height:1; }
.file-preview-panel__actions :deep(.el-icon), .file-preview-panel__header-icon :deep(.el-icon) { display:flex; align-items:center; justify-content:center; }
.file-preview-panel__actions button:hover, .file-preview-panel__footer button:hover, .file-preview-panel__state-actions button:hover, .file-preview-panel__header-icon:hover { background:var(--mc-primary-bg, #fff1eb); color:var(--mc-primary, #d97757); }
.file-preview-panel__content { flex:1; min-height:0; overflow:auto; }
.file-preview-panel__document { min-height:100%; padding:18px 20px; box-sizing:border-box; display:flex; flex-direction:column; }
.file-preview-panel__source { margin:0; white-space:pre; tab-size:2; font:13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow:auto; }
.file-preview-panel__pdf { display:block; width:100%; height:100%; min-height:520px; border:0; }
.file-preview-panel__document-html { min-height:100%; padding:18px 20px; box-sizing:border-box; overflow:auto; }
.file-preview-panel__document-html :deep(table) { border-collapse:collapse; width:100%; font-size:13px; }
.file-preview-panel__document-html :deep(th), .file-preview-panel__document-html :deep(td) { border:1px solid var(--mc-border, #e2e8f0); padding:6px 10px; text-align:left; }
.file-preview-panel__document-html :deep(th) { background:var(--mc-bg-subtle, #f1f5f9); font-weight:600; }
.file-preview-panel__state { min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px; text-align:center; color:var(--mc-text-secondary, #64748b); gap:10px; }
.file-preview-panel__state p { max-width:360px; margin:0; }
.file-preview-panel__state-actions { display:flex; gap:8px; }
.file-preview-panel__spinner { width:22px; height:22px; border:2px solid var(--mc-border, #ddd); border-top-color:var(--mc-primary, #d97757); border-radius:50%; animation:file-preview-spin .8s linear infinite; }
@keyframes file-preview-spin { to { transform:rotate(360deg); } }
.file-preview-panel__footer { justify-content:space-between; gap:8px; min-height:44px; padding:0 12px; border-top:1px solid var(--mc-border, #e2e8f0); border-bottom:0; color:var(--mc-text-tertiary, #94a3b8); font-size:12px; }
.file-preview-panel__footer > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.file-preview-panel__footer > div { display:flex; flex-shrink:0; }
:global(body.mc-file-preview-lock) { overflow:hidden; }
.file-preview-panel__artifacts-view { display: flex; flex-direction: column; }
.file-preview-panel__artifacts-header { flex-shrink: 0; }
.file-preview-panel__artifacts-toggle { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: transparent; color: var(--mc-text-secondary, #64748b); font: inherit; font-size: 13px; padding: 10px 16px; cursor: pointer; text-align: left; }
/* .file-preview-panel__artifacts-toggle:hover { background: var(--mc-primary-bg, #fff1eb); } */
.file-preview-panel__artifacts-title { font-weight: bold; font-size: 14px; }
.file-preview-panel__artifacts-chevron { display: inline-block; transition: transform .2s ease; font-size: 10px; width: 12px; text-align: center; }
.file-preview-panel__artifacts-count { font-size: 11px; color: var(--mc-text-tertiary, #94a3b8); background: var(--mc-bg-subtle, #f1f5f9); border-radius: 8px; padding: 1px 7px; margin-left: auto; }
.file-preview-panel__artifacts-body { flex: 1; overflow-y: auto; }
.file-preview-panel__artifacts-list { list-style: none; margin: 0; padding: 8px 0; }
.file-preview-panel__artifacts-empty { display: flex; align-items: center; justify-content: center; height: 100%; min-height: 120px; color: var(--mc-text-tertiary, #94a3b8); font-size: 13px; }
.file-preview-panel__artifact-item button { display: flex; align-items: center; width: 100%; border: 0; background: transparent; color: var(--mc-text-primary, #1e293b); font: inherit; font-size: 13px; padding: 7px 16px 7px 20px; cursor: pointer; text-align: left; }
.file-preview-panel__artifact-item button:hover { background: var(--mc-primary-bg, #fff1eb); color: var(--mc-primary, #d97757); }
.file-preview-panel__artifact-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 768px) { .file-preview-panel__header { min-height:56px; } .file-preview-panel__document { padding:14px; } .file-preview-panel__footer { padding-bottom:max(0px, env(safe-area-inset-bottom)); } }
</style>