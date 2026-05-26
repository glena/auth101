import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import prettier from "prettier";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const presentationsDir = join(root, "presentations");
const checkOnly = process.argv.includes("--check");
const resolvedPrettierConfig = (await prettier.resolveConfig(join(root, "index.html"))) ?? {};
const htmlPrettierConfig = {
  ...resolvedPrettierConfig,
  parser: "html",
};

marked.use({
  gfm: true,
  breaks: false,
});

function normalize(value) {
  return `${String(value).replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseMetadata(frontMatter) {
  const metadata = {};
  let currentList = null;
  let currentItem = null;

  for (const line of frontMatter.split("\n")) {
    if (!line.trim()) continue;

    const listItemMatch = line.match(/^\s*-\s+([^:]+):\s*(.*)$/);
    if (listItemMatch && currentList) {
      currentItem = { [listItemMatch[1].trim()]: parseScalar(listItemMatch[2]) };
      metadata[currentList].push(currentItem);
      continue;
    }

    const nestedMatch = line.match(/^\s+([^:]+):\s*(.*)$/);
    if (nestedMatch && currentItem) {
      currentItem[nestedMatch[1].trim()] = parseScalar(nestedMatch[2]);
      continue;
    }

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (value === "") {
      metadata[key] = [];
      currentList = key;
      currentItem = null;
    } else {
      metadata[key] = parseScalar(value);
      currentList = null;
      currentItem = null;
    }
  }

  metadata.order = Number.parseInt(metadata.order || "999", 10);
  metadata.resources = Array.isArray(metadata.resources) ? metadata.resources : [];
  return metadata;
}

function readDeck(slug) {
  const sourcePath = join(presentationsDir, slug, "slides.md");
  const raw = readFileSync(sourcePath, "utf8");
  const frontMatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!frontMatterMatch) {
    throw new Error(`${relative(root, sourcePath)} must start with front matter.`);
  }

  const metadata = parseMetadata(frontMatterMatch[1]);
  const body = frontMatterMatch[2].trim();
  const slides = body
    .split(/^---$/m)
    .map((slide) => slide.trim())
    .filter(Boolean)
    .map(parseSlide);

  if (!metadata.title || !metadata.description) {
    throw new Error(`${relative(root, sourcePath)} must define title and description.`);
  }

  if (slides.length === 0) {
    throw new Error(`${relative(root, sourcePath)} must contain at least one slide.`);
  }

  return {
    slug,
    sourcePath,
    outputPath: join(presentationsDir, slug, "index.html"),
    metadata,
    slides,
  };
}

function parseSlide(source) {
  const notesMatch = source.match(/::: notes\n([\s\S]*?)\n:::/);
  const notesMarkdown = notesMatch ? notesMatch[1].trim() : "";
  const contentMarkdown = notesMatch ? source.replace(notesMatch[0], "").trim() : source;
  const headingMatch = contentMarkdown.match(/^#{1,3}\s+(.+)$/m);
  const html = marked.parse(contentMarkdown);
  const content = splitSlideContent(html);

  return {
    title: headingMatch ? headingMatch[1].replace(/[`*_]/g, "").trim() : "Untitled slide",
    headingHtml: content.headingHtml,
    bodyHtml: content.bodyHtml,
    notesHtml: notesMarkdown ? marked.parse(notesMarkdown) : "",
  };
}

function splitSlideContent(html) {
  const normalized = html.trim();
  const headingMatch = normalized.match(/^(<h([1-3])[^>]*>[\s\S]*?<\/h\2>)\n?([\s\S]*)$/);
  if (!headingMatch) {
    return {
      headingHtml: "",
      bodyHtml: normalized,
    };
  }

  return {
    headingHtml: headingMatch[1],
    bodyHtml: headingMatch[3].trim(),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderIndex(decks) {
  const cards = decks
    .map((deck) => {
      const resources = deck.metadata.resources
        .map(
          (resource) =>
            `<a class="button secondary" href="${escapeHtml(resource.url)}">${escapeHtml(resource.label)}</a>`,
        )
        .join("\n          ");

      return `<article class="deck-card">
        <div>
          <h2>${escapeHtml(deck.metadata.title)}</h2>
          <p>${escapeHtml(deck.metadata.description)}</p>
        </div>
        <div class="deck-meta">
          <span>${deck.slides.length} slides</span>
          <span>Status: ${escapeHtml(deck.metadata.status || "draft")}</span>
        </div>
        <div class="deck-actions">
          <a class="button" href="presentations/${escapeHtml(deck.slug)}/index.html">Open presentation</a>
          ${resources}
        </div>
      </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Auth Presentations</title>
  <link rel="stylesheet" href="assets/site.css">
</head>
<body>
  <main>
    <section class="hero">
      <h1>Auth Presentations</h1>
      <p>Small, focused presentations for teaching authentication and authorization. Each deck is generated from Markdown and can be opened as static HTML.</p>
    </section>
    <section class="deck-list" aria-label="Presentations">
      ${cards}
    </section>
  </main>
</body>
</html>`;
}

function renderPresentation(deck) {
  const slides = deck.slides
    .map(
      (slide, index) => `<section class="slide" aria-label="${escapeHtml(slide.title)}" data-slide="${index + 1}">
      <div class="slide-content">
        <div class="slide-title">
          ${slide.headingHtml}
        </div>
        <div class="slide-body">
          ${slide.bodyHtml}
        </div>
      </div>
    </section>`,
    )
    .join("\n");
  const notes = JSON.stringify(deck.slides.map((slide) => slide.notesHtml));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(deck.metadata.title)}</title>
  <link rel="stylesheet" href="../../assets/presentation.css">
</head>
<body>
  <main class="deck" data-deck="${escapeHtml(deck.slug)}" data-title="${escapeHtml(deck.metadata.title)}">
    ${slides}
  </main>
  <div class="controls" aria-label="Presentation controls">
    <button type="button" data-prev aria-label="Previous slide">Prev</button>
    <span data-counter></span>
    <button type="button" data-next aria-label="Next slide">Next</button>
    <button type="button" data-notes aria-label="Open presenter notes">Notes</button>
  </div>
  <div class="progress" aria-hidden="true"><span data-progress></span></div>
  <script type="application/json" id="notes-data">${notes.replaceAll("<", "\\u003c")}</script>
  <script src="../../assets/presentation.js"></script>
</body>
</html>`;
}

function discoverDecks() {
  if (!existsSync(presentationsDir)) return [];
  return readdirSync(presentationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(presentationsDir, entry.name, "slides.md")))
    .map((entry) => readDeck(entry.name))
    .sort(
      (left, right) =>
        left.metadata.order - right.metadata.order || left.metadata.title.localeCompare(right.metadata.title),
    );
}

async function writeOrCheck(path, contents, options = {}) {
  const formatted = options.format === "html" ? await prettier.format(contents, htmlPrettierConfig) : contents;
  const output = normalize(formatted);
  if (checkOnly) {
    const current = existsSync(path) ? normalize(readFileSync(path, "utf8")) : "";
    if (current !== output) {
      console.error(`Generated file is stale: ${relative(root, path)}`);
      process.exitCode = 1;
    }
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, output);
  console.log(`Wrote ${relative(root, path)}`);
}

const decks = discoverDecks();
if (decks.length === 0) {
  throw new Error("No presentations found.");
}

await writeOrCheck(join(root, "index.html"), renderIndex(decks), { format: "html" });
for (const deck of decks) {
  await writeOrCheck(deck.outputPath, renderPresentation(deck), { format: "html" });
}

if (checkOnly && process.exitCode) {
  console.error("Run `sfw npm run build` to regenerate static HTML.");
}
