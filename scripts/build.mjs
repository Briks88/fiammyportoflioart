// Costruisce la cartella "dist" che Vercel pubblica.
// A ogni pubblicazione dal pannello (e quindi a ogni modifica di data/*.json):
//  - copia il sito così com'è;
//  - genera una pagina statica per ogni opera (/opera/<id>/) con titolo, immagine, data, tecnica e dati strutturati;
//  - rigenera sitemap.xml (con le immagini) e l'elenco completo delle opere in opere.html.
// Nessuna dipendenza: solo Node.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd(), OUT = path.join(ROOT, "dist");
const IGNORE = new Set([".git", ".github", ".vercel", "node_modules", "dist", "scripts", "demo", "README.md", "vercel.json", "package.json", "package-lock.json"]);
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fmtDate = (w) => [w.day, w.month ? MONTHS[w.month - 1] : "", w.year].filter(Boolean).join(" ");
const isoDate = (w) => [w.year, w.month && String(w.month).padStart(2, "0"), w.month && w.day && String(w.day).padStart(2, "0")].filter(Boolean).join("-");
const label = (list, id) => (list.find((x) => x.id === id) || {}).label || id;
const trunc = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

function imgSize(file) { // dimensioni di JPEG/PNG senza librerie
  try {
    const b = fs.readFileSync(path.join(ROOT, file));
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch { /* immagine mancante: si prosegue senza dimensioni */ }
  return null;
}

// ---- 1) copia del sito
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(ROOT)) {
  if (IGNORE.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

// ---- 2) dati
const cfg = JSON.parse(read("data/config.json"));
const works = (JSON.parse(read("data/works.json")).works || []).filter((w) => w && w.id && w.image);
const SITE = (cfg.siteUrl || "https://mondodinchiostromatitoso.it").replace(/\/$/, "");
const TITLE = cfg.siteTitle || "Portfolio", ARTIST = cfg.artist || "";
const abs = (p) => SITE + "/" + String(p).replace(/^\//, "");
const css = "/css/style.css?v=7", js = "/js/site.js?v=12";

// ---- 3) una pagina per opera
function workPage(w, i) {
  const tec = label(cfg.tecniche || [], w.tecnica), date = fmtDate(w), iso = isoDate(w);
  const temi = (w.temi || []).map((t) => ({ id: t, label: label(cfg.temi || [], t) }));
  const url = `${SITE}/opera/${w.id}/`, sz = imgSize(w.image);
  const desc = w.description ? trunc(w.description.replace(/\s+/g, " "), 158) : trunc(`${w.title}: ${tec.toLowerCase()}${date ? " del " + date : ""} di ${ARTIST || TITLE}${temi.length ? ". " + temi.map((t) => t.label).join(", ") : ""}.`, 158);
  const pageTitle = `${w.title} — ${tec}${w.year ? ", " + w.year : ""} | ${TITLE}`;
  const prev = works[(i - 1 + works.length) % works.length], next = works[(i + 1) % works.length];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "VisualArtwork", "@id": url + "#opera", name: w.title, url, image: abs(w.image), artMedium: tec, ...(w.year ? { dateCreated: iso } : {}),
        ...(w.description ? { description: w.description } : {}), ...(temi.length ? { keywords: temi.map((t) => t.label).join(", ") } : {}),
        creator: { "@type": "Person", name: ARTIST || TITLE }, inLanguage: "it", isPartOf: { "@id": SITE + "/#website" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Opere", item: SITE + "/opere.html" },
        { "@type": "ListItem", position: 3, name: w.title, item: url } ] },
    ],
  };
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#f5f0e6">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(TITLE)}">
  <meta property="og:locale" content="it_IT">
  <meta property="og:title" content="${esc(w.title)} — ${esc(TITLE)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${abs(w.image)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
  <link rel="apple-touch-icon" href="/images/logo-180.png">
  <link rel="preload" href="/fonts/cormorant-garamond-normal-500-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/inter-normal-400-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/fonts.css?v=1">
  <link rel="stylesheet" href="${css}">
</head>
<body data-page="opera">
  <header class="site-header" id="header"></header>
  <main class="wrap work">
    <nav class="crumbs" aria-label="Percorso"><a href="/">Home</a><span aria-hidden="true">›</span><a href="/opere.html">Opere</a><span aria-hidden="true">›</span><span>${esc(w.title)}</span></nav>
    <article class="work-card">
      <figure class="work-fig"><img src="/${esc(w.image)}" alt="${esc(w.title)} — ${esc(tec.toLowerCase())}${ARTIST ? " di " + esc(ARTIST) : ""}"${sz ? ` width="${sz.w}" height="${sz.h}"` : ""} fetchpriority="high"></figure>
      <div class="work-info">
        <h1>${esc(w.title)}</h1>
        <p class="work-meta">${esc(tec)}${date ? ` · <time datetime="${esc(iso)}">${esc(date)}</time>` : ""}</p>
        ${w.description ? `<p class="work-desc">${esc(w.description).replace(/\n+/g, "<br>")}</p>` : ""}
        ${temi.length ? `<p class="work-tags">${temi.map((t) => `<a href="/opere.html?tema=${encodeURIComponent(t.id)}">${esc(t.label)}</a>`).join("")}<a href="/opere.html?tecnica=${encodeURIComponent(w.tecnica)}">${esc(tec)}</a></p>` : ""}
      </div>
    </article>
    ${works.length > 1 ? `<nav class="work-nav" aria-label="Altre opere"><a rel="prev" href="/opera/${esc(prev.id)}/"><small>Precedente</small><span>${esc(prev.title)}</span></a><a rel="next" href="/opera/${esc(next.id)}/"><small>Successiva</small><span>${esc(next.title)}</span></a></nav>` : ""}
    <p class="work-back"><a class="btn" href="/opere.html">Tutte le opere</a></p>
  </main>
  <footer class="site-footer" id="footer"></footer>
  <script src="${js}"></script>
  <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
  <script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
}

let made = 0;
for (let i = 0; i < works.length; i++) {
  try {
    const dir = path.join(OUT, "opera", works[i].id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), workPage(works[i], i));
    made++;
  } catch (e) { console.warn("Pagina non generata per", works[i].id, e.message); }
}

// ---- 4) elenco completo delle opere dentro opere.html (link leggibili anche senza JavaScript)
try {
  const file = path.join(OUT, "opere.html");
  let html = fs.readFileSync(file, "utf8");
  const list = works.map((w) => `<li><a href="/opera/${esc(w.id)}/">${esc(w.title)}</a>${w.year ? ` <span>${esc(w.year)}</span>` : ""}</li>`).join("");
  const block = `<details class="work-index"><summary>Elenco completo delle opere (${works.length})</summary><ul>${list}</ul></details>\n  `;
  if (works.length && html.includes("</main>")) html = html.replace("</main>", block + "</main>");
  fs.writeFileSync(file, html);
} catch (e) { console.warn("Elenco opere non inserito:", e.message); }

// ---- 5) sitemap con le immagini
const urls = [
  `  <url><loc>${SITE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
  `  <url><loc>${SITE}/opere.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
  ...works.map((w) => `  <url><loc>${SITE}/opera/${esc(w.id)}/</loc><changefreq>monthly</changefreq><priority>0.6</priority><image:image><image:loc>${esc(abs(w.image))}</image:loc><image:title>${esc(w.title)}</image:title></image:image></url>`),
  fs.existsSync(path.join(ROOT, "privacy.html")) ? `  <url><loc>${SITE}/privacy.html</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>` : "",
].filter(Boolean);
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`);

console.log(`Sito costruito in dist/: ${made}/${works.length} pagine opera, sitemap con ${urls.length} indirizzi.`);
