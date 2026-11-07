/** ~180 words/min + ~6 images/min (~10s each) for listicle/photo posts. */
export function estimateReadingMinutes(content?: string | null): number {
  const raw = String(content || '');
  const images = (raw.match(/!\[[^\]]*]\([^)]*\)/g) || []).length;

  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = text ? text.split(' ').filter(Boolean).length : 0;
  const minutes = words / 180 + images / 6;
  return Math.max(1, Math.round(minutes) || 1);
}
