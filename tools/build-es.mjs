// Construye la web publicable en una carpeta de salida y genera la versión en español en /es/.
//
//   node tools/build-es.mjs --out _site            (lo usa GitHub Actions antes de publicar)
//   node tools/build-es.mjs --out .local/preview   (réplica local para revisar antes de publicar)
//
// Cómo funciona:
// - Copia el sitio tal cual (sin .git, .github, .local, tools…).
// - Para cada página con textos en español (atributos data-es) crea /es/<misma ruta>, con el contenido
//   ya en español, <html lang="es">, enlaces internos apuntando a /es/ y las imágenes/archivos de la versión inglesa.
// - En ambas versiones añade <link rel="canonical"> y <link rel="alternate" hreflang> para Google,
//   y hace que el botón EN/ES cambie de dirección (/x ↔ /es/x) en lugar de traducir en la misma página.
// - Añade las URLs /es/ al sitemap.xml de salida.
// Las páginas de origen NO se modifican: se sigue editando el HTML en inglés con su data-es="…".
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : '_site');
const SITE = 'https://marexi.com';
const SKIP_TOP = new Set(['.git', '.github', '.local', '.claude', 'tools', 'node_modules', '_site', 'CLAUDE.md', 'CLAUDE.local.md', 'README.md']);
const NO_ES = [/^404\.html$/, /^pinger\/metstrade\//];          // páginas sin versión española
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// ---------- copiar el sitio ----------
// Protección: solo se vacía una carpeta de salida dentro del repo y llamada "_site" o dentro de ".local/".
const relOut = path.relative(ROOT, OUT).split(path.sep).join('/');
if (!relOut || relOut.startsWith('..') || path.isAbsolute(relOut) || !(relOut === '_site' || relOut.startsWith('.local/'))) {
  console.error(`Carpeta de salida no permitida: ${OUT} (usa "_site" o ".local/…")`); process.exit(1);
}
fs.rmSync(OUT, { recursive: true, force: true });
const files = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!rel && SKIP_TOP.has(e.name)) continue;
    if (e.name === 'desktop.ini') continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r); else files.push(r);
  }
})(ROOT, '');
for (const r of files) { fs.mkdirSync(path.dirname(path.join(OUT, r)), { recursive: true }); fs.copyFileSync(path.join(ROOT, r), path.join(OUT, r)); }

// ---------- utilidades ----------
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrEsc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const urlOf = rel => '/' + rel.replace(/(^|\/)index\.html$/, '$1');           // "pinger/index.html" → "/pinger/"
const pages = files.filter(f => f.endsWith('.html'));
const esPages = new Set(pages.filter(p => !NO_ES.some(re => re.test(p)) && /\sdata-es=/.test(fs.readFileSync(path.join(ROOT, p), 'utf8'))));
const esUrls = new Set([...esPages].map(urlOf));

// Sustituye el contenido de cada elemento con data-es por su texto en español (respeta anidamiento).
function swapInner(html) {
  const openRe = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\sdata-es="([^"]*)"([^>]*)>/g;
  let out = '', last = 0, m;
  while ((m = openRe.exec(html))) {
    const [full, tag, a1, val, a2] = m;
    const t = tag.toLowerCase();
    const openTag = `<${tag}${a1}${a2}>`;                        // misma etiqueta sin data-es
    if (VOID.has(t)) { out += html.slice(last, m.index) + openTag; last = m.index + full.length; continue; }
    // buscar el cierre que corresponde
    const tagRe = new RegExp(`<(/?)${t}\\b[^>]*>`, 'gi'); tagRe.lastIndex = m.index + full.length;
    let depth = 1, tm, end = -1;
    while ((tm = tagRe.exec(html))) { depth += tm[1] ? -1 : 1; if (depth === 0) { end = tm.index; break; } }
    if (end < 0) { out += html.slice(last, m.index) + openTag; last = m.index + full.length; continue; }
    out += html.slice(last, m.index) + openTag + decode(val);
    last = end; openRe.lastIndex = end;
  }
  return out + html.slice(last);
}

function headInject(html, extra) { return html.replace(/<head>/i, '<head>\n' + extra); }
function bodyInject(html, extra) { const i = html.lastIndexOf('</body>'); return html.slice(0, i) + extra + '\n' + html.slice(i); }

function langScripts(lang, enUrl, esUrl) {
  const pre = `<script>try{localStorage.setItem('marexi-lang','${lang}');localStorage.setItem('pinger-lang','${lang}')}catch(e){}</script>`;
  const post = `<script>/* cambio de idioma por dirección (generado por tools/build-es.mjs) */
function setLang(l){try{localStorage.setItem('marexi-lang',l);localStorage.setItem('pinger-lang',l)}catch(e){}
var u=l==='es'?${JSON.stringify(esUrl)}:${JSON.stringify(enUrl)};if(u!==location.pathname)location.href=u+location.hash;}
(function(){var e=document.getElementById('btn-en'),s=document.getElementById('btn-es');if(e)e.classList.toggle('on',${lang === 'en'});if(s)s.classList.toggle('on',${lang === 'es'});})();
</script>`;
  return { pre, post };
}
function alternates(enUrl, esUrl, self) {
  return `<link rel="canonical" href="${SITE}${self}">\n<link rel="alternate" hreflang="en" href="${SITE}${enUrl}">\n` +
    `<link rel="alternate" hreflang="es" href="${SITE}${esUrl}">\n<link rel="alternate" hreflang="x-default" href="${SITE}${enUrl}">`;
}
const fixBase = html => html.replace(/<base\s+href="https:\/\/marexi\.com(\/[^"]*)"\s*\/?>/i, '<base href="$1">');

// ---------- generar ----------
let made = 0;
for (const rel of pages) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const enUrl = urlOf(rel);
  let en = fixBase(src);
  if (!esPages.has(rel)) { fs.writeFileSync(path.join(OUT, rel), en); continue; }
  const esUrl = '/es' + enUrl;
  const dirUrl = enUrl.endsWith('/') ? enUrl : enUrl.replace(/[^/]*$/, '');

  // --- versión inglesa (misma URL de siempre)
  const L = langScripts('en', enUrl, esUrl);
  en = headInject(en, L.pre + '\n' + alternates(enUrl, esUrl, enUrl));
  en = bodyInject(en, L.post);
  fs.writeFileSync(path.join(OUT, rel), en);

  // --- versión española
  let es = fixBase(src);
  es = es.replace(/<html\b([^>]*)\blang="en"/i, '<html$1lang="es"');
  es = es.replace(/(<meta\b[^>]*?)\scontent="[^"]*"([^>]*?)\sdata-es-content="([^"]*)"/gi, '$1 content="$3"$2');
  es = es.replace(/(<(?:input|textarea)\b[^>]*?)\splaceholder="[^"]*"([^>]*?)\sdata-es-ph="([^"]*)"/gi, '$1 placeholder="$3"$2');
  es = es.replace(/(<(?:input|textarea)\b[^>]*?)\sdata-es-ph="([^"]*)"([^>]*?)\splaceholder="[^"]*"/gi, '$1 placeholder="$2"$3');
  es = es.replace(/(<a\b[^>]*?)\shref="[^"]*"([^>]*?)\sdata-es-href="([^"]*)"/gi, '$1 href="$3"$2');
  es = swapInner(es);
  // base: las rutas relativas de imágenes y archivos siguen apuntando a la carpeta de la versión inglesa
  if (/<base\s/i.test(es)) es = es.replace(/<base\s+href="[^"]*"\s*\/?>/i, `<base href="${dirUrl}">`);
  else es = headInject(es, `<base href="${dirUrl}">`);
  // enlaces: páginas del sitio → /es/…, anclas → misma página /es/
  es = es.replace(/(<a\b[^>]*?\shref=")([^"]*)(")/gi, (all, a, href, z) => {
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return all;
    if (href.startsWith('#')) return a + esUrl + href + z;
    let u; try { u = new URL(href, SITE + enUrl); } catch { return all; }
    if (u.origin !== SITE && !/^https?:\/\/(www\.)?marexi\.com$/i.test(u.origin)) return all;
    let p = u.pathname; if (p.endsWith('/index.html')) p = p.slice(0, -10);
    if (!esUrls.has(p)) return all;
    return a + '/es' + p + u.search + u.hash + z;
  });
  const S = langScripts('es', enUrl, esUrl);
  es = headInject(es, S.pre + '\n' + alternates(enUrl, esUrl, esUrl));
  es = bodyInject(es, S.post);
  const outFile = path.join(OUT, 'es', rel);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, es);
  made++;
}

// ---------- sitemap con las URLs /es/ ----------
const smPath = path.join(OUT, 'sitemap.xml');
if (fs.existsSync(smPath)) {
  let sm = fs.readFileSync(smPath, 'utf8');
  const blocks = [...sm.matchAll(/  <url>\s*<loc>https:\/\/marexi\.com(\/[^<]*)<\/loc>[\s\S]*?<\/url>\n/g)];
  let add = '';
  for (const b of blocks) if (esUrls.has(b[1])) add += b[0].replace(`<loc>${SITE}${b[1]}</loc>`, `<loc>${SITE}/es${b[1]}</loc>`);
  sm = sm.replace('</urlset>', add + '</urlset>');
  fs.writeFileSync(smPath, sm);
}
console.log(`Sitio generado en ${path.relative(ROOT, OUT) || OUT}: ${files.length} archivos, ${made} páginas en español.`);
