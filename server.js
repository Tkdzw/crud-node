const http = require("node:http");
const { readFile, readdir } = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "posts");
const PUBLIC_DIR = path.join(ROOT, "public");

const SITE = {
  name: "Kuber Tech Blog",
  shortName: "Kuber",
  domain: "kuber.co.zw",
  baseUrl: process.env.SITE_URL || `http://localhost:${PORT}`,
  description: "Practical insights on websites, hosting, email, cloud tools, and digital growth for Zimbabwean businesses.",
  tagline: "Build smarter online systems for growing businesses.",
  heroKicker: "Kuber.co.zw Insights",
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugToTitle(slug) {
  return slug
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZW", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function estimateReadingTime(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function parseFrontMatter(markdown) {
  if (!markdown.startsWith("---\n")) return { meta: {}, body: markdown };
  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return { meta: {}, body: markdown };

  const rawMeta = markdown.slice(4, end).trim();
  const body = markdown.slice(end + "\n---\n".length);
  const meta = {};

  for (const line of rawMeta.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body };
}

function renderMarkdown(md) {
  const lines = md.replaceAll("\r\n", "\n").split("\n");
  const out = [];

  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let inList = false;

  function closeList() {
    if (!inList) return;
    out.push("</ul>");
    inList = false;
  }

  function closeCode() {
    if (!inCode) return;
    const code = escapeHtml(codeLines.join("\n"));
    const klass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
    out.push(`<pre><code${klass}>${code}</code></pre>`);
    inCode = false;
    codeLang = "";
    codeLines = [];
  }

  function inline(text) {
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safeLabel = escapeHtml(label);
      const safeHref = escapeHtml(href);
      const external = !safeHref.startsWith("/");
      const rel = external ? ' rel="noreferrer"' : "";
      const target = external ? ' target="_blank"' : "";
      return `<a href="${safeHref}"${target}${rel}>${safeLabel}</a>`;
    });
    return formatted;
  }

  for (const rawLine of lines) {
    const line = rawLine;
    const fence = line.match(/^```(\w+)?\s*$/);

    if (fence) {
      if (inCode) {
        closeCode();
      } else {
        closeList();
        inCode = true;
        codeLang = fence[1] || "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  closeCode();

  return out.join("\n");
}

function buildAbsoluteUrl(pathname) {
  return new URL(pathname, SITE.baseUrl).toString();
}

function renderTagLink(tag, activeTag, basePath = "/feed") {
  const tagSlug = slugify(tag);
  const activeClass = tagSlug === activeTag ? " active" : "";
  return `<a class="tag-chip${activeClass}" href="${basePath}?tag=${encodeURIComponent(tagSlug)}">${escapeHtml(tag)}</a>`;
}

function layout({ title, description, body, pathname = "/", ogType = "website" }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description || SITE.description);
  const absoluteUrl = buildAbsoluteUrl(pathname);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta name="theme-color" content="#0f172a" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:url" content="${escapeHtml(absoluteUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE.name)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="${escapeHtml(absoluteUrl)}" />
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE.name)} RSS Feed" href="/rss.xml" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/">
          <span class="brand-mark">K</span>
          <span>
            <strong>${escapeHtml(SITE.shortName)}</strong>
            <small>${escapeHtml(SITE.domain)}</small>
          </span>
        </a>
        <nav class="nav">
          <a href="/">Home</a>
          <a href="/feed">Feed</a>
          <a href="/about">About</a>
          <a href="/rss.xml">RSS</a>
        </nav>
      </div>
    </header>
    <main class="container">
      ${body}
    </main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div>
          <strong>${escapeHtml(SITE.name)}</strong>
          <p>${escapeHtml(SITE.description)}</p>
        </div>
        <div class="footer-links">
          <a href="/feed">Latest posts</a>
          <a href="/about">Work with Kuber</a>
          <a href="https://${escapeHtml(SITE.domain)}" target="_blank" rel="noreferrer">Visit ${escapeHtml(SITE.domain)}</a>
        </div>
      </div>
    </footer>
  </body>
</html>`;
}

async function loadPostFromFile(fileName) {
  const filePath = path.join(POSTS_DIR, fileName);
  const raw = await readFile(filePath, "utf8");
  const { meta, body } = parseFrontMatter(raw);
  const sourceSlug = fileName.replace(/\.md$/i, "");
  const title = meta.title || slugToTitle(sourceSlug);
  const tags = splitTags(meta.tags);
  const slug = meta.slug || slugify(title || sourceSlug);
  const summary = meta.summary || `${title} from ${SITE.name}.`;

  return {
    slug,
    sourceSlug,
    title,
    date: normalizeDate(meta.date),
    displayDate: formatDisplayDate(meta.date),
    summary,
    tags,
    readingTime: estimateReadingTime(body),
    html: renderMarkdown(body),
    body,
  };
}

async function listPosts() {
  let names;
  try {
    names = await readdir(POSTS_DIR);
  } catch {
    return [];
  }

  const posts = [];
  for (const name of names.filter((value) => value.toLowerCase().endsWith(".md"))) {
    try {
      posts.push(await loadPostFromFile(name));
    } catch {
      // Ignore unreadable posts.
    }
  }

  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return posts;
}

async function loadPost(slug) {
  const posts = await listPosts();
  const post = posts.find((entry) => entry.slug === slug);
  if (!post) throw new Error("Post not found");
  return post;
}

function send(res, status, contentType, body) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store",
  });
  res.end(buffer);
}

async function servePublic(reqUrl, res) {
  if (reqUrl.pathname !== "/styles.css") return false;
  try {
    const css = await readFile(path.join(PUBLIC_DIR, "styles.css"), "utf8");
    send(res, 200, "text/css; charset=utf-8", css);
  } catch {
    send(res, 404, "text/plain; charset=utf-8", "Not found");
  }
  return true;
}

function renderHero(filters, totalPosts) {
  const tagPills = ["Web Hosting", "Email", "Cloud", "Websites", "Security"]
    .map((tag) => renderTagLink(tag, filters.tag, "/feed"))
    .join("");

  const resultLabel = filters.query || filters.tag ? `${totalPosts} result${totalPosts === 1 ? "" : "s"}` : `${totalPosts} published article${totalPosts === 1 ? "" : "s"}`;

  return `<section class="hero">
  <div class="hero-copy">
    <span class="eyebrow">${escapeHtml(SITE.heroKicker)}</span>
    <h1>${escapeHtml(SITE.tagline)}</h1>
    <p>${escapeHtml(SITE.description)}</p>
    <div class="hero-actions">
      <a class="button primary" href="https://${escapeHtml(SITE.domain)}" target="_blank" rel="noreferrer">Visit ${escapeHtml(SITE.domain)}</a>
      <a class="button secondary" href="/rss.xml">Subscribe via RSS</a>
    </div>
  </div>
  <aside class="hero-panel">
    <div class="stat-card">
      <strong>${escapeHtml(resultLabel)}</strong>
      <span>Guides, explainers, and practical business tech tips.</span>
    </div>
    <form class="search-card" method="GET" action="/feed">
      <label for="q">Search articles</label>
      <div class="search-row">
        <input id="q" name="q" type="search" placeholder="Search hosting, websites, email..." value="${escapeHtml(filters.query)}" />
        <button type="submit">Search</button>
      </div>
      ${filters.tag ? `<input type="hidden" name="tag" value="${escapeHtml(filters.tag)}" />` : ""}
    </form>
  </aside>
  <div class="topic-row">${tagPills}</div>
</section>`;
}

function renderHomePage(posts) {
  const latestPost = posts[0];
  const recentPosts = posts.slice(1, 4);

  const spotlight = latestPost
    ? `<article class="homepage-feature">
  <span class="eyebrow">Latest Feature</span>
  <h2><a href="/post/${encodeURIComponent(latestPost.slug)}">${escapeHtml(latestPost.title)}</a></h2>
  <p class="summary">${escapeHtml(latestPost.summary)}</p>
  <div class="meta-row">
    <span class="meta">${escapeHtml([latestPost.displayDate, `${latestPost.readingTime} min read`].filter(Boolean).join(" • "))}</span>
    <a class="read-more" href="/post/${encodeURIComponent(latestPost.slug)}">Read featured post</a>
  </div>
</article>`
    : `<article class="empty-state">
  <h2>No posts yet</h2>
  <p>Add markdown files in <code>posts/</code> to start publishing.</p>
</article>`;

  const recentCards = recentPosts
    .map(
      (post) => `<article class="mini-post-card">
  <span class="meta">${escapeHtml(post.displayDate || `${post.readingTime} min read`)}</span>
  <h3><a href="/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
  <p>${escapeHtml(post.summary)}</p>
</article>`
    )
    .join("");

  const body = `<section class="hero home-hero">
  <div class="hero-copy">
    <span class="eyebrow">${escapeHtml(SITE.heroKicker)}</span>
    <h1>${escapeHtml(SITE.tagline)}</h1>
    <p>${escapeHtml(SITE.description)}</p>
    <div class="hero-actions">
      <a class="button primary" href="/feed">Open the feed</a>
      <a class="button secondary" href="https://${escapeHtml(SITE.domain)}" target="_blank" rel="noreferrer">Visit ${escapeHtml(SITE.domain)}</a>
    </div>
  </div>
  <aside class="hero-panel home-panel">
    <div class="stat-card">
      <strong>${posts.length} published article${posts.length === 1 ? "" : "s"}</strong>
      <span>Fresh insights on hosting, email, websites, and digital growth.</span>
    </div>
    <div class="quick-links">
      <a class="quick-link" href="/feed">Browse the feed</a>
      <a class="quick-link" href="/rss.xml">Subscribe via RSS</a>
      <a class="quick-link" href="/about">About Kuber</a>
    </div>
  </aside>
</section>
<section class="homepage-grid">
  ${spotlight}
  <div class="homepage-side">
    <article class="info-card">
      <h3>What you’ll find here</h3>
      <p>Clear, business-friendly articles that help teams choose better tools and build a stronger online presence.</p>
    </article>
    ${recentCards || ""}
  </div>
</section>
<section class="feature-strip">
  <article>
    <h3>Hosting that performs</h3>
    <p>Learn how speed, uptime, and the right infrastructure affect business outcomes.</p>
  </article>
  <article>
    <h3>Email that builds trust</h3>
    <p>See why custom domain email matters for credibility, deliverability, and team workflows.</p>
  </article>
  <article>
    <h3>Digital systems that scale</h3>
    <p>Understand the practical setup decisions that help growing companies stay reliable online.</p>
  </article>
</section>`;

  return layout({
    title: `${SITE.name} • Home`,
    description: SITE.description,
    body,
    pathname: "/",
  });
}

function renderFeed(posts, filters) {
  const [featuredPost, ...restPosts] = posts;
  const featured = featuredPost
    ? `<article class="featured-feed-card">
  <div class="featured-label">Featured</div>
  <span class="meta">${escapeHtml([featuredPost.displayDate, `${featuredPost.readingTime} min read`].filter(Boolean).join(" • "))}</span>
  <h2><a href="/post/${encodeURIComponent(featuredPost.slug)}">${escapeHtml(featuredPost.title)}</a></h2>
  <p class="summary">${escapeHtml(featuredPost.summary)}</p>
  <div class="tag-list">${featuredPost.tags.map((tag) => renderTagLink(tag, filters.tag, "/feed")).join("")}</div>
  <a class="read-more" href="/post/${encodeURIComponent(featuredPost.slug)}">Open article</a>
</article>`
    : "";

  const items = restPosts
    .map((post) => {
      const meta = [post.displayDate, `${post.readingTime} min read`].filter(Boolean).join(" • ");
      const tagList = post.tags.map((tag) => renderTagLink(tag, filters.tag, "/feed")).join("");

      return `<article class="feed-card">
  <div class="feed-card-header">
    <div class="feed-avatar">K</div>
    <div>
      <strong>${escapeHtml(SITE.name)}</strong>
      <div class="meta">${meta ? escapeHtml(meta) : "Latest update"}</div>
    </div>
  </div>
  <h2><a href="/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
  <p class="summary">${escapeHtml(post.summary)}</p>
  <div class="tag-list">${tagList}</div>
  <div class="feed-actions">
    <span>💬 Discuss</span>
    <span>🔁 Share</span>
    <a class="read-more" href="/post/${encodeURIComponent(post.slug)}">Read more</a>
  </div>
</article>`;
    })
    .join("\n");

  const emptyState = `<article class="empty-state">
  <h2>No matching posts yet</h2>
  <p>Try a different keyword or remove the tag filter to browse everything.</p>
  <a class="button secondary" href="/feed">Clear filters</a>
</article>`;

  const body = `${renderHero(filters, posts.length)}
<section class="feed-layout">
  <div class="feed-main">
    ${featured || emptyState}
    <section class="feed-list">
      ${items}
    </section>
  </div>
  <aside class="feed-sidebar">
    <article class="info-card">
      <h3>About the feed</h3>
      <p>This page is styled like a professional social platform so new content feels active, timely, and easy to scan.</p>
    </article>
    <article class="info-card">
      <h3>Popular topics</h3>
      <div class="tag-list">${["Web Hosting", "Email", "Cloud", "Websites", "Security"].map((tag) => renderTagLink(tag, filters.tag, "/feed")).join("")}</div>
    </article>
  </aside>
</section>`;

  return layout({
    title: `${SITE.name} • Feed`,
    description: SITE.description,
    body,
    pathname: filters.query || filters.tag ? `/feed?q=${encodeURIComponent(filters.query)}&tag=${encodeURIComponent(filters.tag)}` : "/feed",
  });
}

function renderAbout() {
  const body = `<article class="prose prose-page">
  <span class="eyebrow">About ${escapeHtml(SITE.shortName)}</span>
  <h1>${escapeHtml(SITE.name)}</h1>
  <p>${escapeHtml(SITE.shortName)} publishes clear, business-friendly technology content for teams building their presence online.</p>
  <p>We focus on topics that matter in the real world: fast websites, reliable hosting, branded email, cloud tools, security, and the small technical details that improve trust.</p>
  <h2>What this blog covers</h2>
  <ul>
    <li>Hosting and website performance</li>
    <li>Custom domain email and communications</li>
    <li>Cloud services for growing businesses</li>
    <li>Practical security habits and setup guides</li>
  </ul>
  <h2>How the project works</h2>
  <p>This site is intentionally lightweight: posts live in <code>posts/</code>, pages are rendered by <code>server.js</code>, and the styling lives in <code>public/styles.css</code>.</p>
  <p><a href="https://${escapeHtml(SITE.domain)}" target="_blank" rel="noreferrer">Explore the main Kuber site</a> to connect the blog with your broader services and lead-generation flow.</p>
</article>`;

  return layout({
    title: `About • ${SITE.name}`,
    description: `About ${SITE.name}.`,
    body,
    pathname: "/about",
  });
}

function renderRelatedPosts(currentPost, posts) {
  const related = posts
    .filter((post) => post.slug !== currentPost.slug)
    .filter((post) => post.tags.some((tag) => currentPost.tags.includes(tag)))
    .slice(0, 3);

  if (!related.length) return "";

  const items = related
    .map(
      (post) => `<article class="related-card">
  <span class="meta">${escapeHtml(post.displayDate || `${post.readingTime} min read`)}</span>
  <h3><a href="/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
  <p>${escapeHtml(post.summary)}</p>
</article>`
    )
    .join("");

  return `<section class="related-section">
  <h2>Related reading</h2>
  <div class="related-grid">${items}</div>
</section>`;
}

function renderPostPage(post, posts) {
  const metaParts = [post.displayDate, `${post.readingTime} min read`].filter(Boolean);
  const tags = post.tags.map((tag) => renderTagLink(tag, "", "/feed")).join("");

  const body = `<article class="prose article-shell">
  <a class="back" href="/feed">← Back to feed</a>
  <span class="eyebrow">Article</span>
  <h1>${escapeHtml(post.title)}</h1>
  ${metaParts.length ? `<div class="meta">${escapeHtml(metaParts.join(" • "))}</div>` : ""}
  ${tags ? `<div class="tag-list post-tags">${tags}</div>` : ""}
  ${post.summary ? `<p class="lede">${escapeHtml(post.summary)}</p>` : ""}
  ${post.html}
</article>
${renderRelatedPosts(post, posts)}`;

  return layout({
    title: `${post.title} • ${SITE.name}`,
    description: post.summary || SITE.description,
    body,
    pathname: `/post/${encodeURIComponent(post.slug)}`,
    ogType: "article",
  });
}

function renderNotFound() {
  const body = `<article class="prose prose-page">
  <h1>404</h1>
  <p>We couldn’t find that page.</p>
  <p><a href="/">Go back to the latest articles</a></p>
</article>`;

  return layout({
    title: `404 • ${SITE.name}`,
    description: "Not found",
    body,
    pathname: "/404",
  });
}

function renderRss(posts) {
  const items = posts
    .map((post) => {
      const url = buildAbsoluteUrl(`/post/${encodeURIComponent(post.slug)}`);
      return `<item>
  <title>${escapeHtml(post.title)}</title>
  <link>${escapeHtml(url)}</link>
  <guid>${escapeHtml(url)}</guid>
  <description>${escapeHtml(post.summary)}</description>
  <pubDate>${escapeHtml(new Date(post.date || Date.now()).toUTCString())}</pubDate>
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(SITE.name)}</title>
    <link>${escapeHtml(SITE.baseUrl)}</link>
    <description>${escapeHtml(SITE.description)}</description>
    ${items}
  </channel>
</rss>`;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (await servePublic(reqUrl, res)) return;

  if (reqUrl.pathname === "/") {
    const posts = await listPosts();
    return send(res, 200, "text/html; charset=utf-8", renderHomePage(posts));
  }

  if (reqUrl.pathname === "/feed") {
    const allPosts = await listPosts();
    const query = reqUrl.searchParams.get("q")?.trim() || "";
    const tag = slugify(reqUrl.searchParams.get("tag")?.trim() || "");

    const posts = allPosts.filter((post) => {
      const matchesQuery = !query
        || `${post.title} ${post.summary} ${post.tags.join(" ")} ${post.body}`.toLowerCase().includes(query.toLowerCase());
      const matchesTag = !tag || post.tags.some((value) => slugify(value) === tag);
      return matchesQuery && matchesTag;
    });

    return send(res, 200, "text/html; charset=utf-8", renderFeed(posts, { query, tag }));
  }

  if (reqUrl.pathname === "/about") {
    return send(res, 200, "text/html; charset=utf-8", renderAbout());
  }

  if (reqUrl.pathname === "/rss.xml") {
    const posts = await listPosts();
    return send(res, 200, "application/rss+xml; charset=utf-8", renderRss(posts));
  }

  const postMatch = reqUrl.pathname.match(/^\/post\/([^/]+)$/);
  if (postMatch) {
    const slug = decodeURIComponent(postMatch[1]);
    try {
      const posts = await listPosts();
      const post = posts.find((entry) => entry.slug === slug);
      if (!post) throw new Error("Post not found");
      return send(res, 200, "text/html; charset=utf-8", renderPostPage(post, posts));
    } catch {
      return send(res, 404, "text/html; charset=utf-8", renderNotFound());
    }
  }

  return send(res, 404, "text/html; charset=utf-8", renderNotFound());
});

server.listen(PORT, () => {
  console.log(`Kuber Tech Blog running on http://localhost:${PORT}`);
});
