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
// - Justifica el texto de todas las páginas (ver JUSTIFY).
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

// Texto justificado en toda la web: párrafos y listas de texto alineados a la izquierda → justificados (sin partir palabras:
// si una palabra no cabe, salta entera a la línea siguiente);
// los centrados de varias líneas → justificados con la última línea centrada. Los alineados a la izquierda
// ocupan además todo el ancho de su contenedor (sin max-width), para no dejar hueco a la derecha. Se excluyen menús, botones y textos cortos.
const JUSTIFY = `<style>.mx-j{text-align:justify!important;-webkit-hyphens:manual;hyphens:manual;overflow-wrap:normal;word-break:normal}.mx-jc{text-align-last:center}.mx-w{max-width:none!important}</style>
<script>document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('p,li,dd,blockquote').forEach(function(e){
if(e.closest('nav,header,footer,button,.chips,.chip,.facts,.pfacts,.lang'))return;var t=(e.textContent||'').trim();if(t.length<90)return;
var cs=getComputedStyle(e);if(cs.display.indexOf('flex')>-1||cs.display.indexOf('inline')>-1)return;var a=cs.textAlign;
if(a==='left'||a==='start'||a==='justify')e.classList.add('mx-j','mx-w');else if(a==='center')e.classList.add('mx-j','mx-jc');});});</script>`;
// Cabecera/menú con las mismas medidas en todas las páginas (alto, ancho, márgenes, logo y tamaño de los enlaces).
const HEADER = `<style>header.nav{position:sticky;top:0;z-index:50}
header.nav>.nav-inner{height:96px!important;max-width:1280px!important;margin:0 auto!important;padding:0 48px!important;box-sizing:border-box!important}
header.nav .brand img{height:44px!important;width:auto!important;display:block}
header.nav .lang{font-size:.78rem!important}header.nav .lang button{padding:5px 11px!important}
header.nav .nav-links>a:not(.btn):not(.shop-nav-link),header.nav .navgroup-trigger,header.nav .navgroup-menu a,header.nav .back,header.nav .back-link,header.nav .storehome,header.nav .catmenu a,header.nav .cartlink{font-size:15px!important}
@media(max-width:640px){header.nav>.nav-inner{height:auto!important;min-height:72px!important;padding:0 20px!important}header.nav .brand img{height:36px!important}}</style>`;
// Panel superior (hero) uniforme en todas las páginas interiores: mismo margen superior/inferior, mismo tamaño de h1
// y contenido de los heros a dos columnas alineado arriba (la portada, con .hero-photo, no se toca).
const HERO = `<style>section.hero:not(:has(.hero-photo)){padding-top:84px!important;padding-bottom:56px!important}
section.hero:not(:has(.hero-photo)) h1{font-size:clamp(2rem,5vw,3.1rem)!important;line-height:1.15!important;margin-bottom:16px!important}
section.hero:not(:has(.hero-photo)) .wrap{max-width:1120px!important}
section.hero .h1top{margin:0 0 16px!important}
section.hero .hero-split,section.hero .hero-grid,section.hero .hsplit,section.hero>.wrap{align-items:start!important}
@media(max-width:640px){section.hero:not(:has(.hero-photo)){padding-top:56px!important;padding-bottom:44px!important}}</style>`;
// Campos de formulario a 16 px en móvil y tableta: por debajo de 16 px, Safari en iPhone amplía la pantalla al tocarlos.
// En escritorio no cambia nada.
const FORMS = `<style>@media(max-width:820px){input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),textarea,select{font-size:16px!important}}</style>`;
const withJustify = html => /<\/head>/i.test(html) ? html.replace(/<\/head>/i, JUSTIFY + '\n' + HEADER + '\n' + HERO + '\n' + FORMS + '\n</head>') : html;
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

// ---------- vista previa al compartir (Open Graph / Twitter) ----------
// Imagen 1200x630 por página en assets/og/ (generadas con el logo de cada producto); título y descripción
// salen del <title> y la meta description de cada idioma.
const OG_IMG = [
  ['anisakischeck/scanisakis/', 'scanisakis'], ['anisakischeck/matrixled/', 'matrixled'], ['anisakischeck/retroled/', 'retroled'],
  ['anisakischeck/uvpress/', 'uvpress'], ['anisakischeck/', 'anisakischeck'], ['pinger/', 'pinger'], ['shop/', 'pinger'],
  ['aquadef/', 'aquadef'], ['tedepad/', 'tedepad'], ['tunascan/', 'tunascan'], ['hydrophones/', 'hydrophones'],
  ['acoustic-tank/', 'acoustic-tank'], ['cylinder/', 'cylinder'], ['usv-victoria/', 'usv-victoria'], ['dual-use/', 'dual-use'],
  ['seasampler/', 'seasampler'], ['t-clean/', 'tclean'], ['sfs/', 'sfs'], ['c-tuna/', 'c-tuna'], ['bioacoustics/', 'bioacoustics'],
  ['contaminant-detection/', 'contaminants'], ['shark-bycatch/', 'shark-bycatch']];
const unesc = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attr = s => unesc(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function ogTags(html, rel, url, lang) {
  if (/property="og:/i.test(html)) return html;
  const title = (html.match(/<title\b[^>]*>([^<]*)<\/title>/i) || [])[1];
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1];
  if (!title) return html;
  const img = (OG_IMG.find(([p]) => rel.startsWith(p)) || [null, 'marexi'])[1];
  const t = [
    ['og:type', 'website'], ['og:site_name', 'Marexi'], ['og:title', title.trim()], ...(desc ? [['og:description', desc]] : []),
    ['og:url', SITE + url], ['og:image', `${SITE}/assets/og/${img}.jpg`], ['og:image:width', '1200'], ['og:image:height', '630'],
    ['og:locale', lang === 'es' ? 'es_ES' : 'en_GB'], ['og:locale:alternate', lang === 'es' ? 'en_GB' : 'es_ES']];
  const tags = t.map(([k, v]) => `<meta property="${k}" content="${attr(v)}">`).join('\n') + '\n' +
    `<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${SITE}/assets/og/${img}.jpg">`;
  return html.replace(/<\/head>/i, tags + '\n</head>');
}

// ---------- generar ----------
let made = 0;
for (const rel of pages) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const enUrl = urlOf(rel);
  let en = fixBase(src);
  if (!esPages.has(rel)) { fs.writeFileSync(path.join(OUT, rel), withJustify(ogTags(en, rel, enUrl, 'en'))); continue; }
  const esUrl = '/es' + enUrl;
  const dirUrl = enUrl.endsWith('/') ? enUrl : enUrl.replace(/[^/]*$/, '');

  // --- versión inglesa (misma URL de siempre)
  const L = langScripts('en', enUrl, esUrl);
  en = headInject(en, L.pre + '\n' + alternates(enUrl, esUrl, enUrl));
  en = bodyInject(en, L.post);
  fs.writeFileSync(path.join(OUT, rel), withJustify(ogTags(en, rel, enUrl, 'en')));

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
  fs.writeFileSync(outFile, withJustify(ogTags(es, rel, esUrl, 'es')));
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

// ---------- redirecciones de la web antigua (WordPress hasta 2026) ----------
// URLs antiguas que Google aún tenía (Search Console, 19/11/2026) → su equivalente actual.
// GitHub Pages no permite redirecciones de servidor: se crea una página mínima con redirección inmediata
// (meta refresh 0 + location.replace), que Google trata como redirección permanente, y canonical al destino.
// No se añaden al sitemap. Si una ruta ya existe en el sitio, NO se sobrescribe (aviso y se salta).
const REDIRECTS = {
  'en/': '/', 'en/home/': '/', 'en/technologies/': '/',
  'en/tedepad/': '/tedepad/', 'en/anisakischeck/': '/anisakischeck/',
  'en/producto/pinger-5-unidades/': '/shop/product/?sku=PINGER-5',
  'en/producto/pinger-10-units/': '/shop/product/?sku=PINGER-10',
  'productos/': '/es/', 'photonics/': '/es/',
  'scanisakis/': '/es/anisakischeck/scanisakis/',
  'terminos-y-condiciones/': '/es/legal.html',
  'producto/pinger-3-unidades/': '/es/shop/product/?sku=PINGER-3',
  'producto/pinger-5-unidades/': '/es/shop/product/?sku=PINGER-5',
  'producto/pinger-10-unidades/': '/es/shop/product/?sku=PINGER-10',
  // 23/11/2026 (P70): enlaces antiguos que Google mostraba en su menú al buscar «marexi» y daban 404.
  // Regla de Christian: si no hay un equivalente seguro, a la portada.
  'empresa/': '/es/', 'inicio/': '/es/',
  'company/': '/', 'acoustics/': '/', 'defense/': '/',
  'anisakis/': '/', 'marelight/': '/', 'retroled/': '/anisakischeck/retroled/',
};
let redirs = 0;
for (const [from, to] of Object.entries(REDIRECTS)) {
  const file = path.join(OUT, from, 'index.html');
  if (fs.existsSync(file)) { console.warn(`Redirección saltada: /${from} ya existe en el sitio`); continue; }
  const lang = to.startsWith('/es/') ? 'es' : 'en', t = attrEsc(to);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8"><title>Marexi</title>
<link rel="canonical" href="${SITE}${t}">
<meta http-equiv="refresh" content="0; url=${t}">
<script>location.replace(${JSON.stringify(to)}+location.hash)</script>
</head><body><p><a href="${t}">marexi.com${t}</a></p></body></html>
`);
  redirs++;
}
console.log(`Sitio generado en ${path.relative(ROOT, OUT) || OUT}: ${files.length} archivos, ${made} páginas en español, ${redirs} redirecciones.`);
