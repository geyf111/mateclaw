export type FileSource = 'attachment' | 'generated-link'
export type PreviewMode = 'markdown' | 'code' | 'text' | 'pdf' | 'html'
export type FileTabStatus = 'idle' | 'loading' | 'ready' | 'too-large' | 'expired' | 'forbidden' | 'not-found' | 'error'
  | 'unsupported'

export interface FileOpenRequest {
  url: string
  name?: string
  contentType?: string
  size?: number
  source: FileSource
  conversationId?: string
  messageId?: string | number
}

export interface FileTab {
  id: string
  conversationId: string
  source: FileSource
  url: string
  canonicalUrl: string
  name: string
  contentType: string
  size?: number
  mode?: PreviewMode
  language?: string
  status: FileTabStatus
  text?: string
  blob?: Blob
  objectUrl?: string
  errorMessage?: string
}

export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024
export const MAX_PDF_PREVIEW_BYTES = 25 * 1024 * 1024
export const MAX_DOCUMENT_PREVIEW_BYTES = 20 * 1024 * 1024
export const MAX_OPEN_TABS = 8

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])
const TEXT_EXTENSIONS = new Set(['txt', 'log', 'csv', 'tsv', 'ini', 'cfg', 'conf', 'env', 'gitignore', 'gitattributes', 'editorconfig'])
const DOCUMENT_EXTENSIONS = new Set(['docx', 'xlsx', 'xls'])
const CODE_EXTENSION_TO_LANGUAGE: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', vue: 'vue',
  py: 'python', java: 'java', kt: 'kotlin', go: 'go', rs: 'rust', c: 'c', h: 'c',
  cpp: 'cpp', hpp: 'cpp', cs: 'csharp', sh: 'bash', bash: 'bash', ps1: 'powershell',
  bat: 'dos', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', xml: 'xml',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', sql: 'sql', svg: 'xml',
}
const CODE_BASENAMES: Record<string, string> = { Dockerfile: 'dockerfile', Makefile: 'makefile' }

function baseName(name: string): string {
  return name.replace(/[?#].*$/, '').split('/').pop() || ''
}

function extension(name: string): string {
  const base = baseName(name)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

/** Only server-owned chat files and short-lived generated files may be fetched. */
export function canonicalFileUrl(href: string): string | null {
  try {
    const url = new URL(href, window.location.origin)
    if (url.origin !== window.location.origin || url.search) return null
    url.hash = ''
    const attachment = /^\/api\/v1\/chat\/files\/[^/]+\/[^/]+\/?$/.test(url.pathname)
    const generated = /^\/api\/v1\/files\/generated\/[A-Za-z0-9-]+\/?$/.test(url.pathname)
    return attachment || generated ? `${url.pathname}` : null
  } catch {
    return null
  }
}

export function isGeneratedFileUrl(href: string): boolean {
  const canonical = canonicalFileUrl(href)
  return !!canonical && /^\/api\/v1\/files\/generated\//.test(canonical)
}

export function classifyFile(name = '', contentType = ''): { mode?: PreviewMode; language?: string } {
  const type = contentType.split(';', 1)[0].trim().toLowerCase()
  const ext = extension(name)
  const base = baseName(name)
  if (type === 'application/pdf' || ext === 'pdf') return { mode: 'pdf' }
  if (type === 'text/markdown' || MARKDOWN_EXTENSIONS.has(ext)) return { mode: 'markdown' }
  const language = CODE_EXTENSION_TO_LANGUAGE[ext] || CODE_BASENAMES[base]
  if (language) return { mode: 'code', language }
  if (TEXT_EXTENSIONS.has(ext) || (type.startsWith('text/') && !['text/html', 'text/xml'].includes(type))) return { mode: 'text' }
  if (DOCUMENT_EXTENSIONS.has(ext) || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || type === 'application/vnd.ms-excel') return { mode: 'html' }
  return {}
}

export function displayFileSize(size?: number): string {
  if (!Number.isFinite(size) || !size || size < 0) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function safeFileName(name?: string): string {
  return baseName(name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'download'
}

export interface GeneratedFileEntry {
  id: string
  url: string
  name: string
}

/**
 * Scan message contents for generated file links and return unique entries.
 * Deduplicates by canonical URL, preserving the first occurrence's link text as display name.
 */
export function extractGeneratedFiles(messages: { content: string }[]): GeneratedFileEntry[] {
  const seen = new Set<string>()
  const result: GeneratedFileEntry[] = []
  const mdLinkRe = /\[([^\]]*)\]\(([^)]+)\)/g
  for (const msg of messages) {
    if (!msg.content) continue
    mdLinkRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = mdLinkRe.exec(msg.content)) !== null) {
      const linkText = m[1]?.trim() || ''
      const href = m[2]
      const canonical = canonicalFileUrl(href)
      if (!canonical || !isGeneratedFileUrl(href) || seen.has(canonical)) continue
      seen.add(canonical)
      const id = canonical.split('/').pop() || ''
      result.push({ id, url: canonical, name: linkText || id })
    }
  }
  return result
}