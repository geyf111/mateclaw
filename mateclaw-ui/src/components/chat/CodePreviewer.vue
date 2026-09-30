<template>
  <div ref="containerRef" class="code-previewer">
    <VueMonacoEditor
      :value="source"
      :language="monacoLang"
      :theme="isDark ? 'vs-dark' : 'vs'"
      :options="editorOptions"
      :path="fileUri"
      class="code-previewer__editor"
      :style="{ minHeight: containerHeight + 'px' }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js'
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/less/less.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { useThemeStore } from '@/stores/useThemeStore'

loader.config({ monaco })

if (typeof window !== 'undefined' && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'json') {
        return import('monaco-editor/esm/vs/language/json/json.worker?worker').then(
          (m) => new m.default()
        ) as unknown as Worker
      }
      return new EditorWorker()
    },
  }
}

const props = defineProps<{
  source: string
  filename: string
}>()

const themeStore = useThemeStore()
const isDark = computed(() => themeStore.isDark)

const EXT_TO_MONACO: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'html',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  go: 'go',
  rs: 'rust',
  c: 'cpp',
  h: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  bat: 'bat',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  xml: 'xml',
  svg: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  dockerfile: 'dockerfile',
  makefile: 'plaintext',
}

const monacoLang = computed(() => {
  const ext = props.filename.split('.').pop()?.toLowerCase() || ''
  const base = props.filename.toLowerCase()
  if (base === 'dockerfile') return 'dockerfile'
  if (base === 'makefile') return 'plaintext'
  return EXT_TO_MONACO[ext] || 'plaintext'
})

const fileUri = computed(() => `inmemory://preview/${props.filename}`)

const containerRef = ref<HTMLElement | null>(null)
const containerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!containerRef.value) return
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerHeight.value = entry.contentRect.height
    }
  })
  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

const editorOptions = {
  readOnly: true,
  automaticLayout: true,
  fontSize: 13,
  fontFamily: 'JetBrains Mono, Consolas, monospace',
  // minimap: {
  //   enabled: true,
  //   size: 'proportional',
  //   autohide: true
  // },
  scrollBeyondLastLine: false,
  lineNumbers: 'on' as const,
  renderLineHighlight: 'line' as const,
  wordWrap: 'on' as const,
  tabSize: 2,
  folding: true,
  renderWhitespace: 'selection' as const,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 4,
  padding: { top: 12, bottom: 12 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  scrollbar: {
    vertical: 'auto' as const,
    horizontal: 'auto' as const,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    alwaysConsumeMouseWheel: false,
  },
  contextmenu: false,
  quickSuggestions: false,
  suggest: { showWords: false },
  parameterHints: { enabled: false },
  hover: { enabled: false },
  links: false,
}
</script>

<style scoped>
.code-previewer {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.code-previewer__editor {
  width: 100%;
  height: 100%;
}
</style>