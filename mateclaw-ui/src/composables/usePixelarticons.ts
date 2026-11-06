/**
 * pixelarticons (npm `pixelarticons`) — SVG icon loader.
 *
 * The package ships ~400 icons each with a "sharp" twin variant (~800
 * SVGs total). We surface the regular set only — the sharp variants are
 * a stylistic alternative that doubles bundle size for marginal value
 * in our context. Each SVG is ~150B, so the regular set lands around
 * 60KB raw / ~15KB gzipped — small enough to bundle eagerly so the
 * picker can search/grid without lazy-loading round trips.
 *
 * Icon scheme: we encode a chosen pixelart icon as the string `pi:name`
 * (kebab-case). The {@link SkillIcon} renderer detects this prefix and
 * inlines the SVG at render time.
 */

// Eager glob into node_modules — Vite resolves `?raw` text imports for
// SVGs the same as any other asset. We exclude the `*-sharp.svg` files
// at the glob level so they never enter the bundle.
const modules = import.meta.glob<string>(
  '../../node_modules/pixelarticons/svg/!(*-sharp).svg',
  { query: '?raw', import: 'default', eager: true },
)

/**
 * Map from kebab-case icon name → raw SVG markup.
 * Built once at module load; ~400 entries.
 */
export const pixelartIcons: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [path, raw] of Object.entries(modules)) {
    const name = path.split('/').pop()!.replace(/\.svg$/, '')
    out[name] = raw
  }
  return out
})()

/**
 * Sorted list of icon names — drives the picker grid. Cached because the
 * picker reads it on every keystroke (search filter).
 */
export const pixelartIconNames: string[] = Object.keys(pixelartIcons).sort()

/**
 * Encode a pixelart icon name into the persisted icon string.
 * Symmetric with {@link parseIconValue}.
 */
export function encodePixelartIcon(name: string): string {
  return `pi:${name}`
}

export type ParsedIcon =
  | { kind: 'pixelart'; name: string; svg: string | null }
  | { kind: 'url'; url: string }
  | { kind: 'base64'; data: string }
  | { kind: 'emoji'; value: string }
  | { kind: 'empty' }

/**
 * Plain-text icon glyph for hosts that can't render components — chiefly
 * `<select><option>`. Returns the emoji as-is, falls back for `pi:` /
 * URL icons (which would otherwise render as literal `pi:robot` text).
 */
export function plainTextIcon(value: string | null | undefined, fallback = '🤖'): string {
  const parsed = parseIconValue(value)
  return parsed.kind === 'emoji' ? parsed.value : fallback
}

/**
 * Decode a stored icon string into a renderable shape. Returns
 * {@code kind: 'empty'} for null/blank so callers can branch on a
 * single discriminator.
 */
/**
 * Resolve the actual display icon from an item that may carry the newer
 * {@code iconType} / {@code customIcon} shape. When {@code iconType} is
 * {@code 'custom'} the base64 data lives in {@code customIcon}; otherwise
 * the legacy {@code icon} field is used as-is.
 */
export function getDisplayIcon(
  item: { icon?: string | null; iconType?: string | null; customIcon?: string | null } | null | undefined,
): string {
  if (!item) return ''
  if (item.iconType === 'custom' && item.customIcon) return item.customIcon
  return item.icon || ''
}

export function parseIconValue(value: string | null | undefined): ParsedIcon {
  if (!value || !value.trim()) return { kind: 'empty' }
  const v = value.trim()
  if (v.startsWith('pi:')) {
    const name = v.slice(3)
    return { kind: 'pixelart', name, svg: pixelartIcons[name] ?? null }
  }
  if (v.startsWith('http://') || v.startsWith('https://')) {
    return { kind: 'url', url: v }
  }
  // Data URI (e.g. data:image/png;base64,iVBOR...). Treated as a URL
  // so the browser handles decoding natively via <img>.
  if (v.startsWith('data:')) {
    return { kind: 'url', url: v }
  }
  // Site-absolute path (e.g. /skill-assets/<skill>/assets/<file>.png served
  // by the WebMvcConfig resource handler) — treat as a URL the browser will
  // resolve against the current host, so deployments don't need to hardcode
  // their public origin in SKILL.md.
  if (v.startsWith('/')) {
    return { kind: 'url', url: v }
  }
  // Custom uploaded image (raw base64 string without data: prefix).
  // Heuristic: only base64 characters, and long enough to be image data.
  const base64Pattern = /^[A-Za-z0-9+/=]+$/
  if (base64Pattern.test(v) && v.length > 50) {
    return { kind: 'base64', data: v }
  }
  // Anything else falls through as an emoji / text glyph. We don't
  // validate "is this really an emoji" — letting the user pick any
  // unicode glyph is intentionally flexible.
  return { kind: 'emoji', value: v }
}