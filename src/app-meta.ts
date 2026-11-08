/**
 * MCP Apps hosts read a tool's UI resource from one of two places: `_meta.ui.resourceUri`, the
 * current form, or the flat `_meta['ui/resourceUri']` that earlier hosts read. This fills in
 * whichever one the tool left out, so both kinds of host find the resource. Any other `_meta` is
 * returned unchanged.
 */
export function normalizeToolMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const ui =
        typeof meta.ui === 'object' && meta.ui !== null
            ? (meta.ui as Record<string, unknown>)
            : undefined
    const resourceUri = ui?.resourceUri
    const legacyResourceUri = meta['ui/resourceUri']

    if (typeof resourceUri === 'string' && typeof legacyResourceUri !== 'string') {
        return { ...meta, 'ui/resourceUri': resourceUri }
    }

    if (typeof legacyResourceUri === 'string' && typeof resourceUri !== 'string') {
        return { ...meta, ui: { ...ui, resourceUri: legacyResourceUri } }
    }

    return meta
}
