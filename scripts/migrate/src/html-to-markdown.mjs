import TurndownService from 'turndown';

// After flatten-wp-content, media lives flat under /uploads/
const MEDIA_PUBLIC_PREFIX = process.env.MEDIA_PUBLIC_PREFIX || '/uploads';

/**
 * Clean WP HTML junk (inline styles, empty spacer paragraphs, nbsp spam)
 * then convert to Markdown for Strapi richtext.
 */
export function cleanHtml(html) {
  if (!html) return '';

  let out = String(html);

  // Media URL rewrites (same as migrate)
  out = out
    .replace(/https?:\/\/(?:www\.)?topovik\.com\/wp-content\/uploads/gi, MEDIA_PUBLIC_PREFIX)
    .replace(/(src=["'])\/wp-content\/uploads/gi, `$1${MEDIA_PUBLIC_PREFIX}`)
    .replace(/(href=["'])\/wp-content\/uploads/gi, `$1${MEDIA_PUBLIC_PREFIX}`);

  // Shortcodes / noise
  out = out
    .replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, '$1')
    .replace(/\[\/?gallery[^\]]*\]/gi, '')
    .replace(/\[email-subscribers[^\]]*\]/gi, '')
    .replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  // Strip presentation attributes that create huge gaps / justify / colors
  out = out
    .replace(/\s*style\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/\s*(?:class|id|dir|lang|align|border|hspace|vspace|clear)\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/\s*data-[\w:-]+\s*=\s*(["'])[\s\S]*?\1/gi, '');

  // Empty / spacer paragraphs and lone nbsp lines
  out = out
    .replace(/<p\b[^>]*>\s*(?:&nbsp;|\u00a0|\s|<br\s*\/?>)*\s*<\/p>/gi, '')
    .replace(/<(div|span)\b[^>]*>\s*(?:&nbsp;|\u00a0|\s|<br\s*\/?>)*\s*<\/\1>/gi, '')
    .replace(/(?:&nbsp;|\u00a0){2,}/g, ' ')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

function createTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    hr: '---',
  });

  td.keep(['iframe', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);

  // WP often wraps heading text in <strong>; keep semantic heading without nested bold.
  td.addRule('headingWithoutStrong', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement(content, node) {
      const level = Number(node.nodeName.charAt(1));
      const text = String(content || '')
        .replace(/^\s*\*\*([\s\S]*?)\*\*\s*$/, '$1')
        .replace(/^\s*__([\s\S]*?)__\s*$/, '$1')
        .replace(/^\s+|\s+$/g, '');
      return `\n\n${'#'.repeat(level)} ${text}\n\n`;
    },
  });

  // Prefer bare image markdown when the link only wraps the image
  td.addRule('linkedImage', {
    filter(node) {
      return (
        node.nodeName === 'A' &&
        node.childNodes.length === 1 &&
        node.firstChild.nodeName === 'IMG'
      );
    },
    replacement(_content, node) {
      const img = node.firstChild;
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const title = img.getAttribute('title');
      const titlePart = title ? ` "${title}"` : '';
      return src ? `\n\n![${alt}](${src}${titlePart})\n\n` : '';
    },
  });

  // WP galleries often wrap lone images in <ul>/<li> — emit bare images, not a list
  td.addRule('imageOnlyList', {
    filter(node) {
      if (node.nodeName !== 'UL' && node.nodeName !== 'OL') return false;
      const items = [...node.children].filter((c) => c.nodeName === 'LI');
      if (!items.length) return false;
      return items.every((li) => {
        const meaningful = [...li.childNodes].filter((c) => {
          if (c.nodeType === 3) return String(c.textContent || '').trim().length > 0;
          if (c.nodeType !== 1) return false;
          const name = c.nodeName;
          return name !== 'BR' && name !== 'P';
        });
        if (meaningful.length !== 1) {
          // allow <li><a><img></a></li> or <li><p><img></p></li>
          const imgs = li.querySelectorAll('img');
          const text = String(li.textContent || '').trim();
          return imgs.length === 1 && !text;
        }
        const only = meaningful[0];
        if (only.nodeName === 'IMG') return true;
        if (
          only.nodeName === 'A' &&
          only.childNodes.length === 1 &&
          only.firstChild?.nodeName === 'IMG'
        ) {
          return true;
        }
        if (only.nodeName === 'P') {
          const imgs = only.querySelectorAll('img');
          return imgs.length === 1 && !String(only.textContent || '').trim();
        }
        return false;
      });
    },
    replacement(content) {
      // child rules already emit image markdown; flatten as paragraphs
      return `\n\n${String(content || '').trim()}\n\n`;
    },
  });

  // Drop empty anchors leftover from WP
  td.addRule('emptyAnchor', {
    filter(node) {
      return node.nodeName === 'A' && !node.textContent?.trim() && !node.querySelector('img');
    },
    replacement() {
      return '';
    },
  });

  return td;
}

const turndown = createTurndown();

export function htmlToMarkdown(html) {
  if (!html) return '';
  const cleaned = cleanHtml(html);
  if (!cleaned) return '';

  // Already looks like markdown (no HTML tags)
  if (!/<[a-z][\s\S]*>/i.test(cleaned)) {
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  let md = turndown.turndown(cleaned);

  md = md
    .replace(/[ \t]+\n/g, '\n')
    // Safety net: unwrap leftover image-only bullets from galleries
    .replace(/^[ \t]{0,3}[-*][ \t]+(!\[[^\]]*\]\([^\)]+\))[ \t]*$/gm, '$1')
    .replace(/^[ \t]{0,3}[-*][ \t]*\n+(?:[ \t]*\n)*(!\[[^\]]*\]\([^\)]+\))[ \t]*$/gm, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '')
    .trim();

  return md;
}
