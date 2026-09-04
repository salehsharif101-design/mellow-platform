// Renders a minimal HTML document carrying per-page Open Graph / Twitter
// Card tags for link-preview crawlers (WhatsApp, LinkedIn, Twitter/X,
// Slack, iMessage, Facebook). This app is client-side-rendered with no
// SSR, so a crawler that doesn't execute JS would otherwise only ever see
// index.html's one static, generic card — see vercel.json, which routes
// only requests whose User-Agent matches a known crawler to the functions
// that use this, leaving every real browser on the normal SPA shell
// untouched. The body is a same-URL meta-refresh purely as a defensive
// fallback (a browser should never reach this in practice, since the
// vercel.json rewrite only matches crawler user agents) so a human who
// somehow lands here still ends up in the real app rather than on a blank
// page.

import { escapeHtml } from './html.js'

export function renderOgHtml({ title, description, image, url }) {
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  const safeImage = escapeHtml(image)
  const safeUrl = escapeHtml(url)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="refresh" content="0;url=${safeUrl}" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}" />
<link rel="canonical" href="${safeUrl}" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDescription}" />
<meta property="og:image" content="${safeImage}" />
<meta property="og:url" content="${safeUrl}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDescription}" />
<meta name="twitter:image" content="${safeImage}" />
</head>
<body>
<a href="${safeUrl}">${safeTitle}</a>
</body>
</html>`
}

export function truncate(text, max) {
  const value = (text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}
