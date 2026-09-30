import { computed, reactive, ref } from 'vue'
import { FileFetchError, fetchFileResource } from '@/api'
import {
  MAX_OPEN_TABS,
  MAX_DOCUMENT_PREVIEW_BYTES,
  MAX_PDF_PREVIEW_BYTES,
  MAX_TEXT_PREVIEW_BYTES,
  canonicalFileUrl,
  classifyFile,
  safeFileName,
  type FileOpenRequest,
  type FileTab,
} from '@/utils/filePreview'

async function convertDocumentToHtml(blob: Blob, name: string): Promise<string> {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
    return result.value
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const data = new Uint8Array(await blob.arrayBuffer())
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) return '<p>工作簿中没有工作表。</p>'
    return XLSX.utils.sheet_to_html(workbook.Sheets[firstSheet], { id: '', editable: false })
  }
  throw new Error(`Unsupported document extension: ${ext}`)
}

function downloadBlob(blob: Blob, name: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = safeFileName(name)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

async function readStrictText(blob: Blob): Promise<string> {
  const data = new Uint8Array(await blob.arrayBuffer())
  let encoding = 'utf-8'
  let start = 0
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) start = 3
  else if (data[0] === 0xff && data[1] === 0xfe) { encoding = 'utf-16le'; start = 2 }
  else if (data[0] === 0xfe && data[1] === 0xff) { encoding = 'utf-16be'; start = 2 }
  return new TextDecoder(encoding, { fatal: true }).decode(data.subarray(start))
}

function errorFor(error: unknown, source: FileTab['source']): { status: FileTab['status']; message: string } {
  if (error instanceof FileFetchError) {
    if (error.code === 'FILE_TOO_LARGE') return { status: 'too-large', message: '文件超过预览大小限制，可直接下载。' }
    if (error.status === 403) return { status: 'forbidden', message: '你没有查看此文件的权限。' }
    if (error.status === 404) return source === 'generated-link'
      ? { status: 'expired', message: '临时文件已过期，请让助手重新生成。' }
      : { status: 'not-found', message: '文件不存在或已被移除。' }
    if (error.status === 401) return { status: 'forbidden', message: '登录已失效，请重新登录后再试。' }
  }
  return { status: 'error', message: '加载文件失败，请重试。' }
}

/** Conversation-scoped file tabs. Request controllers and blob URLs never leave this composable. */
export function useFilePreviewPanel() {
  const fileTabs = ref<FileTab[]>([])
  const activeFileTabId = ref<string>('')
  const panelVisible = ref(false)
  const panelFullscreen = ref(false)
  const controllers = new Map<string, AbortController>()
  const versions = new Map<string, number>()
  let sessionVersion = 0

  const activeTab = computed(() => fileTabs.value.find(tab => tab.id === activeFileTabId.value))

  function releaseTab(tab: FileTab) {
    controllers.get(tab.id)?.abort()
    controllers.delete(tab.id)
    versions.delete(tab.id)
    if (tab.objectUrl) URL.revokeObjectURL(tab.objectUrl)
  }

function makeTab(request: FileOpenRequest, canonicalUrl: string, conversationId: string): FileTab {
  const guessed = classifyFile(request.name, request.contentType)
  // The loader retains this reference across awaits. It must therefore be a
  // reactive object itself — mutating a pre-push plain object would only show
  // up after an unrelated parent re-render (for example entering fullscreen).
  return reactive({
      id: `${conversationId}::${canonicalUrl}`,
      conversationId,
      source: request.source,
      url: request.url,
      canonicalUrl,
      name: safeFileName(request.name || canonicalUrl),
      contentType: request.contentType || '',
      size: request.size,
      mode: guessed.mode,
      language: guessed.language,
      status: 'loading',
  })
}

  function showTab(id: string) {
    activeFileTabId.value = id
    panelVisible.value = true
  }

  async function loadTab(tab: FileTab) {
    const currentSession = sessionVersion
    const version = (versions.get(tab.id) || 0) + 1
    versions.set(tab.id, version)
    controllers.get(tab.id)?.abort()
    const controller = new AbortController()
    controllers.set(tab.id, controller)
    tab.status = 'loading'
    tab.errorMessage = undefined
    tab.text = undefined
    tab.blob = undefined
    if (tab.objectUrl) { URL.revokeObjectURL(tab.objectUrl); tab.objectUrl = undefined }
    // A generated link often has generic text such as “download file”. Allow
    // the PDF ceiling until authoritative response headers identify its type.
    const anticipatedLimit = !tab.mode || tab.mode === 'pdf' || tab.mode === 'html' ? MAX_PDF_PREVIEW_BYTES : MAX_TEXT_PREVIEW_BYTES
    try {
      const resource = await fetchFileResource(tab.canonicalUrl, { signal: controller.signal, maxBytes: anticipatedLimit })
      if (sessionVersion !== currentSession || versions.get(tab.id) !== version || !fileTabs.value.includes(tab)) return
      tab.name = safeFileName(tab.source === 'attachment' ? tab.name : resource.dispositionFileName || tab.name)
      tab.contentType = resource.contentType || tab.contentType
      tab.size = resource.contentLength ?? resource.blob.size
      const classified = classifyFile(tab.name, tab.contentType)
      tab.mode = classified.mode
      tab.language = classified.language
      if (!classified.mode) {
        tab.blob = resource.blob
        tab.status = 'unsupported'
        tab.errorMessage = '该文件类型暂不支持在线预览，可下载后在本地打开。'
        return
      }
      const max = classified.mode === 'pdf' ? MAX_PDF_PREVIEW_BYTES : classified.mode === 'html' ? MAX_DOCUMENT_PREVIEW_BYTES : MAX_TEXT_PREVIEW_BYTES
      if (resource.blob.size > max) {
        tab.status = 'too-large'
        tab.blob = resource.blob
        return
      }
      tab.blob = resource.blob
      if (classified.mode === 'pdf') tab.objectUrl = URL.createObjectURL(resource.blob)
      else if (classified.mode === 'html') {
        try { tab.text = await convertDocumentToHtml(resource.blob, tab.name) }
        catch { tab.status = 'error'; tab.errorMessage = '文档解析失败，请下载后在本地打开。'; return }
      }
      else {
        try { tab.text = await readStrictText(resource.blob) }
        catch { tab.status = 'error'; tab.errorMessage = '文件编码暂不支持（仅支持 UTF-8 与带 BOM 的 UTF-16）。'; return }
      }
      tab.status = 'ready'
    } catch (error: any) {
      if (error?.name === 'AbortError' || controller.signal.aborted) return
      if (sessionVersion !== currentSession || versions.get(tab.id) !== version || !fileTabs.value.includes(tab)) return
      const mapped = errorFor(error, tab.source)
      tab.status = mapped.status
      tab.errorMessage = mapped.message
    } finally {
      if (controllers.get(tab.id) === controller) controllers.delete(tab.id)
    }
  }

  function openFile(request: FileOpenRequest): { accepted: boolean; reason?: string } {
    const conversationId = request.conversationId
    const canonicalUrl = canonicalFileUrl(request.url)
    if (!conversationId || !canonicalUrl) return { accepted: false, reason: '该链接不是可安全访问的会话文件。' }
    const id = `${conversationId}::${canonicalUrl}`
    const existing = fileTabs.value.find(tab => tab.id === id)
    if (existing) { showTab(id); return { accepted: true } }
    if (fileTabs.value.length >= MAX_OPEN_TABS) return { accepted: false, reason: `最多同时打开 ${MAX_OPEN_TABS} 个文件，请先关闭一个。` }
    const tab = makeTab(request, canonicalUrl, conversationId)
    const max = tab.mode === 'pdf' ? MAX_PDF_PREVIEW_BYTES : tab.mode === 'html' ? MAX_DOCUMENT_PREVIEW_BYTES : MAX_TEXT_PREVIEW_BYTES
    if (tab.size && tab.size > max && tab.mode) {
      tab.status = 'too-large'
    }
    fileTabs.value.push(tab)
    showTab(tab.id)
    if (tab.status === 'loading') void loadTab(tab)
    return { accepted: true }
  }

  function retry(id: string) {
    const tab = fileTabs.value.find(item => item.id === id)
    if (tab) void loadTab(tab)
  }

  function closeTab(id: string) {
    const index = fileTabs.value.findIndex(tab => tab.id === id)
    if (index < 0) return
    const [tab] = fileTabs.value.splice(index, 1)
    releaseTab(tab)
    if (activeFileTabId.value === id) {
      const neighbor = fileTabs.value[index] || fileTabs.value[index - 1]
      activeFileTabId.value = neighbor?.id || ''
    }
    if (!fileTabs.value.length) { panelFullscreen.value = false }
  }

  function download(id: string) {
    const tab = fileTabs.value.find(item => item.id === id)
    if (!tab) return
    if (tab.blob) { downloadBlob(tab.blob, tab.name); return }
    const controller = new AbortController()
    void fetchFileResource(tab.canonicalUrl, { signal: controller.signal })
      .then(resource => downloadBlob(resource.blob, resource.dispositionFileName || tab.name))
      .catch(() => { tab.status = 'error'; tab.errorMessage = '下载失败，请稍后重试。' })
  }

  function resetForConversation() {
    sessionVersion += 1
    fileTabs.value.forEach(releaseTab)
    fileTabs.value = []
    activeFileTabId.value = ''
    panelVisible.value = false
    panelFullscreen.value = false
  }

  /** Switch conversation without collapsing the panel — only clear stale tabs. */
  function switchConversation() {
    sessionVersion += 1
    fileTabs.value.forEach(releaseTab)
    fileTabs.value = []
    activeFileTabId.value = ''
  }

  return { fileTabs, activeFileTabId, activeTab, panelVisible, panelFullscreen, openFile, retry, closeTab, download, resetForConversation, switchConversation }
}