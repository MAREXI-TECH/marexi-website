/* Tienda Pinger de Marexi (/shop/) — sin servidor.
 *
 * - CATÁLOGO Y PRECIOS: se cambian solo aquí, en PRODUCTS (price_cents = precio en céntimos sin IVA; null = "bajo consulta").
 * - El carrito se guarda en el navegador del cliente (localStorage "marexi-cart").
 * - Pedido y presupuesto: se abre el correo del cliente con la solicitud ya redactada para SHOP_EMAIL,
 *   y la página /shop/done/ la muestra con botones para volver a abrir el correo o copiarla.
 * - Idioma: el de <html lang>. La versión /es/ la genera tools/build-es.mjs.
 */
var SHOP_EMAIL = 'info@marexi.com';
var IMG_PINGER = '/pinger/pinger-device.png';

var PRODUCTS = {
  'PINGER-3': { group: 'units', type: 'unit', price_cents: 45000, img: IMG_PINGER,
    name_en: 'Pinger® V2.3 — 3 units', name_es: 'Pinger® V2.3 — 3 unidades',
    desc_en: 'Pack of 3 Pinger® V2.3 acoustic deterrent devices for dolphins and other cetaceans. 10 kHz tonal, approx. 9,500 h of operation (about 13 months), automatic activation in water, down to 500 m. Developed in accordance with Implementing Regulation (EU) 2020/967.',
    desc_es: 'Pack de 3 dispositivos acústicos de disuasión Pinger® V2.3 para delfines y otros cetáceos. 10 kHz tonal, aprox. 9.500 h de funcionamiento (unos 13 meses), activación automática en el agua, hasta 500 m. Desarrollado conforme al Reglamento de Ejecución (UE) 2020/967.' },
  'PINGER-5': { group: 'units', type: 'unit', price_cents: 73000, img: IMG_PINGER,
    name_en: 'Pinger® V2.3 — 5 units', name_es: 'Pinger® V2.3 — 5 unidades',
    desc_en: 'Pack of 5 Pinger® V2.3 acoustic deterrent devices for dolphins and other cetaceans. 10 kHz tonal, approx. 9,500 h of operation (about 13 months), automatic activation in water, down to 500 m. Developed in accordance with Implementing Regulation (EU) 2020/967.',
    desc_es: 'Pack de 5 dispositivos acústicos de disuasión Pinger® V2.3 para delfines y otros cetáceos. 10 kHz tonal, aprox. 9.500 h de funcionamiento (unos 13 meses), activación automática en el agua, hasta 500 m. Desarrollado conforme al Reglamento de Ejecución (UE) 2020/967.' },
  'PINGER-10': { group: 'units', type: 'unit', price_cents: 145000, img: IMG_PINGER,
    name_en: 'Pinger® V2.3 — 10 units', name_es: 'Pinger® V2.3 — 10 unidades',
    desc_en: 'Pack of 10 Pinger® V2.3 acoustic deterrent devices for dolphins and other cetaceans. 10 kHz tonal, approx. 9,500 h of operation (about 13 months), automatic activation in water, down to 500 m. Developed in accordance with Implementing Regulation (EU) 2020/967.',
    desc_es: 'Pack de 10 dispositivos acústicos de disuasión Pinger® V2.3 para delfines y otros cetáceos. 10 kHz tonal, aprox. 9.500 h de funcionamiento (unos 13 meses), activación automática en el agua, hasta 500 m. Desarrollado conforme al Reglamento de Ejecución (UE) 2020/967.' },
  'PINGER-FLEET': { group: 'fleet', type: 'unit', price_cents: null,
    name_en: 'Pinger® V2.3 — Fleet / large volume', name_es: 'Pinger® V2.3 — Flota / gran volumen',
    desc_en: '20 or more units with volume pricing. Contact us for a tailored proposal.',
    desc_es: '20 o más unidades con precio por volumen. Contáctenos para una propuesta personalizada.' }
};
var CURRENCY = 'EUR';
var TYPE_LABEL = { unit: ['Unit', 'Unidad'] };

// ---------- idioma y rutas ----------
function isEs() { return document.documentElement.lang === 'es'; }
function T(en, es) { return isEs() ? es : en; }
function base() { return isEs() ? '/es' : ''; }                        // las páginas /es/ enlazan a /es/shop/…
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pName(p) { return isEs() ? p.name_es : p.name_en; }
function pDesc(p) { return isEs() ? p.desc_es : p.desc_en; }
function fmt(c) { return c == null ? null : (c / 100).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CURRENCY; }
function param(k) { try { return new URLSearchParams(location.search).get(k) || ''; } catch (e) { return ''; } }

// Cambio de idioma para ver las páginas sin generar (la web publicada lo sustituye por el de tools/build-es.mjs).
function setLang(lang) {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-es]').forEach(function (el) {
    if (!el.hasAttribute('data-en')) el.setAttribute('data-en', el.innerHTML);
    el.innerHTML = el.getAttribute(lang === 'es' ? 'data-es' : 'data-en');
  });
  var be = document.getElementById('btn-en'), bs = document.getElementById('btn-es');
  if (be) be.classList.toggle('on', lang === 'en');
  if (bs) bs.classList.toggle('on', lang === 'es');
  shopRender();
}

// ---------- carrito ----------
function cartRead() { try { return JSON.parse(localStorage.getItem('marexi-cart') || '{}'); } catch (e) { return {}; } }
function cartWrite(c) { try { localStorage.setItem('marexi-cart', JSON.stringify(c)); } catch (e) {} cartBadge(); }
function cartCount() { var c = cartRead(), n = 0; for (var k in c) if (PRODUCTS[k]) n += c[k]; return n; }
function cartBadge() { var b = document.getElementById('cartBadge'); if (!b) return; var n = cartCount(); b.textContent = n; b.style.display = n ? 'inline-flex' : 'none'; }
function addToCart(sku, qty, btn) {
  var c = cartRead(); c[sku] = (c[sku] || 0) + (qty || 1); cartWrite(c);
  if (btn) { var t = btn.innerHTML; btn.classList.add('added'); btn.innerHTML = T('Added ✓', 'Añadido ✓');
    setTimeout(function () { btn.classList.remove('added'); btn.innerHTML = t; }, 1300); }
}
function setQty(sku, v) { var c = cartRead(); v = parseInt(v, 10) || 0; if (v <= 0) delete c[sku]; else c[sku] = v; cartWrite(c); shopRender(); }
function items() { var c = cartRead(), out = []; for (var s in c) if (c[s] > 0 && PRODUCTS[s]) out.push({ sku: s, qty: c[s] }); return out; }
function totals(list) {
  var sum = 0, poa = false;
  list.forEach(function (x) { var p = PRODUCTS[x.sku]; if (p.price_cents == null) poa = true; else sum += p.price_cents * x.qty; });
  return { sum: sum, poa: poa, text: fmt(sum) + (poa ? T(' + items on request', ' + partidas bajo consulta') : '') };
}

// ---------- catálogo ----------
function cardHtml(sku) {
  var p = PRODUCTS[sku], u = base() + '/shop/';
  var priced = p.price_cents != null;
  return '<div class="pcard ' + p.type + '">' +
    (p.img ? '<img src="' + p.img + '" alt="' + esc(pName(p)) + '" loading="lazy">' : '') +
    '<div class="ptype">' + T(TYPE_LABEL[p.type][0], TYPE_LABEL[p.type][1]) + '</div>' +
    '<h3>' + esc(pName(p)) + '</h3>' +
    '<div class="pdesc">' + esc(pDesc(p)) + '</div>' +
    '<div class="prow">' + (priced ? '<span class="price">' + fmt(p.price_cents) + '</span>' : '<span class="poa">' + T('Price on request', 'Precio bajo consulta') + '</span>') + '</div>' +
    '<div class="prow">' + (priced
      ? '<button class="btn sm" onclick="addToCart(\'' + sku + '\',1,this)">' + T('Add to cart', 'Añadir') + '</button>'
      : '<a class="btn sm ghost" href="' + u + 'quote/?sku=' + sku + '">' + T('Request quote', 'Solicitar presupuesto') + '</a>') +
    '<a class="stock" href="' + u + 'product/?sku=' + sku + '">' + T('Details →', 'Detalles →') + '</a></div></div>';
}
function renderCatalogue() {
  document.querySelectorAll('[data-group]').forEach(function (box) {
    var g = box.getAttribute('data-group');
    box.innerHTML = Object.keys(PRODUCTS).filter(function (k) { return PRODUCTS[k].group === g; }).map(cardHtml).join('');
  });
}

// ---------- ficha de producto ----------
function renderProduct() {
  var box = document.getElementById('productBox'), sku = param('sku'), p = PRODUCTS[sku], u = base() + '/shop/';
  if (!p) { box.innerHTML = '<p class="empty">' + T('Product not found.', 'Producto no encontrado.') + ' <a href="' + u + '">' + T('Go to catalogue', 'Ir al catálogo') + '</a></p>'; return; }
  document.title = pName(p) + ' · Marexi';
  var priced = p.price_cents != null;
  box.innerHTML = (p.img ? '<img src="' + p.img + '" alt="' + esc(pName(p)) + '">' : '') +
    '<div class="ptype">' + T(TYPE_LABEL[p.type][0], TYPE_LABEL[p.type][1]) + '</div>' +
    '<h1>' + esc(pName(p)) + '</h1><p class="d">' + esc(pDesc(p)) + '</p>' +
    '<div class="summary">' + (priced ? '<span class="price">' + fmt(p.price_cents) + '</span>' : '<span class="poa">' + T('Price on request', 'Precio bajo consulta') + '</span>') + '</div>' +
    '<div class="actions">' + (priced
      ? '<input class="qty" id="qty" type="number" min="1" value="1" aria-label="' + T('Quantity', 'Cantidad') + '">' +
        '<button class="btn" onclick="addToCart(\'' + sku + '\',qtyVal(),this)">' + T('Add to cart', 'Añadir al carrito') + '</button>' +
        '<a class="btn ghost" href="' + u + 'cart/">' + T('View cart', 'Ver carrito') + '</a>'
      : '<a class="btn" href="' + u + 'quote/?sku=' + sku + '">' + T('Request quote', 'Pedir presupuesto') + '</a>') + '</div>' +
    '<p style="margin-top:16px"><a href="' + u + '">' + T('← Back to catalogue', '← Volver al catálogo') + '</a></p>';
}
function qtyVal() { var q = document.getElementById('qty'); return q ? Math.max(1, parseInt(q.value, 10) || 1) : 1; }

// ---------- carrito (página) ----------
function renderCart() {
  var box = document.getElementById('cartBox'), list = items();
  if (!list.length) { box.innerHTML = '<p class="empty">' + T('Your cart is empty.', 'Su carrito está vacío.') + '</p>';
    document.getElementById('sumBox').hidden = true; document.getElementById('checkoutBtn').style.display = 'none'; return; }
  var r = '<table class="cart"><thead><tr><th>' + T('Item', 'Producto') + '</th><th class="num">' + T('Price', 'Precio') + '</th><th class="num">' + T('Qty', 'Cant.') +
    '</th><th class="num">Total</th><th></th></tr></thead><tbody>';
  list.forEach(function (x) { var p = PRODUCTS[x.sku], line = p.price_cents == null ? null : p.price_cents * x.qty;
    r += '<tr><td>' + esc(pName(p)) + '</td><td class="num">' + (p.price_cents == null ? T('on request', 'bajo consulta') : fmt(p.price_cents)) + '</td>' +
      '<td class="num"><input class="qty" type="number" min="0" value="' + x.qty + '" aria-label="' + T('Quantity', 'Cantidad') + '" onchange="setQty(\'' + x.sku + '\',this.value)"></td>' +
      '<td class="num">' + (line == null ? '—' : fmt(line)) + '</td>' +
      '<td class="num"><button class="rm" title="' + T('Remove', 'Quitar') + '" onclick="setQty(\'' + x.sku + '\',0)">✕</button></td></tr>'; });
  box.innerHTML = r + '</tbody></table>';
  document.getElementById('sumBox').hidden = false;
  document.getElementById('sumVal').textContent = totals(list).text;
  document.getElementById('checkoutBtn').style.display = 'inline-block';
}

// ---------- resumen en "Finalizar pedido" ----------
function renderMini() {
  var box = document.getElementById('cartMini'), list = items(), f = document.getElementById('ordForm');
  if (!list.length) { box.innerHTML = '<p class="empty">' + T('Cart empty. ', 'Carrito vacío. ') + '<a href="' + base() + '/shop/">' + T('Go to catalogue', 'Ir al catálogo') + '</a></p>';
    if (f) f.style.display = 'none'; return; }
  if (f) f.style.display = '';
  var r = '<table class="cart"><tbody>';
  list.forEach(function (x) { var p = PRODUCTS[x.sku], line = p.price_cents == null ? null : p.price_cents * x.qty;
    r += '<tr><td>' + esc(pName(p)) + ' × ' + x.qty + '</td><td class="num">' + (line == null ? T('on request', 'bajo consulta') : fmt(line)) + '</td></tr>'; });
  box.innerHTML = r + '</tbody></table><div class="summary"><span>Subtotal</span><b>' + esc(totals(list).text) + '</b></div>';
}

// ---------- presupuesto (cabecera) ----------
function renderQuoteHead() {
  var p = PRODUCTS[param('sku')], el = document.getElementById('qProduct'), h = document.getElementById('psku');
  if (h) h.value = p ? param('sku') : '';
  if (el) el.innerHTML = p ? T('Product: ', 'Producto: ') + '<b>' + esc(pName(p)) + '</b>' : '';
}

// ---------- envío por correo ----------
function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
function newRef(prefix) {
  var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return prefix + '-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}
function lines(pairs) { return pairs.filter(function (x) { return x[1]; }).map(function (x) { return x[0] + ': ' + x[1]; }).join('\n'); }
function checkCommon(req, errEl) {
  for (var i = 0; i < req.length; i++) if (!val(req[i])) { errEl.textContent = T('Fill in the required fields *.', 'Complete los campos obligatorios *.'); return false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'))) { errEl.textContent = T('Invalid email.', 'Correo no válido.'); return false; }
  if (!document.getElementById('consent').checked) { errEl.textContent = T('Please tick consent.', 'Marque el consentimiento.'); return false; }
  return true;
}
function mailtoUrl(subject, body) { return 'mailto:' + SHOP_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body); }
function sendByEmail(kind, ref, subject, body) {
  try { sessionStorage.setItem('marexi-shop-last', JSON.stringify({ kind: kind, ref: ref, subject: subject, body: body })); } catch (e) {}
  var a = document.createElement('a'); a.href = mailtoUrl(subject, body); document.body.appendChild(a); a.click(); a.remove();   // abre el correo (requiere el clic del usuario)
  setTimeout(function () { location.href = base() + '/shop/done/'; }, 400);
}
function submitOrder(e) {
  e.preventDefault();
  var err = document.getElementById('err'); err.textContent = '';
  if (!checkCommon(['name', 'company', 'email', 'country'], err)) return;
  var list = items(); if (!list.length) { err.textContent = T('Your cart is empty.', 'Su carrito está vacío.'); return; }
  var ref = newRef('PED');
  var body = T('Order request', 'Solicitud de pedido') + ' ' + ref + '\n\n' +
    list.map(function (x) { var p = PRODUCTS[x.sku], line = p.price_cents == null ? T('on request', 'bajo consulta') : fmt(p.price_cents * x.qty);
      return '- ' + pName(p) + ' [' + x.sku + '] × ' + x.qty + ' — ' + line; }).join('\n') +
    '\n\nSubtotal: ' + totals(list).text + ' ' + T('(excl. VAT & shipping)', '(sin IVA ni envío)') +
    '\n' + T('Payment', 'Pago') + ': ' + T('Proforma / bank transfer', 'Proforma / transferencia') + '\n\n' +
    lines([[T('Full name', 'Nombre'), val('name')], [T('Company', 'Empresa'), val('company')], [T('Email', 'Correo'), val('email')],
      [T('Phone', 'Teléfono'), val('phone')], [T('Country', 'País'), val('country')], [T('VAT / tax ID', 'NIF / IVA'), val('vat')],
      [T('Shipping address / notes', 'Dirección de envío / notas'), val('notes')]]) + '\n';
  sendByEmail('order', ref, T('Order request', 'Solicitud de pedido') + ' ' + ref + ' — ' + val('company'), body);
}
function submitQuote(e) {
  e.preventDefault();
  var err = document.getElementById('err'); err.textContent = '';
  if (!checkCommon(['name', 'company', 'email', 'country', 'sector'], err)) return;
  var ref = newRef('PRE'), p = PRODUCTS[val('psku')];
  var rt = document.querySelector('input[name=reqtype]:checked');
  var body = T('Quote request', 'Solicitud de presupuesto') + ' ' + ref + '\n\n' +
    lines([[T('Product', 'Producto'), p ? pName(p) + ' [' + val('psku') + ']' : ''], [T('What you need', 'Qué necesita'), rt ? rt.parentNode.textContent.trim() : '']]) + '\n\n' +
    lines([[T('Full name', 'Nombre'), val('name')], [T('Company', 'Empresa'), val('company')], [T('Role', 'Cargo'), val('role')], [T('Email', 'Correo'), val('email')],
      [T('Phone', 'Teléfono'), val('phone')], [T('Country', 'País'), val('country')]]) + '\n\n' +
    lines([['Sector', selText('sector')], [T('Scale (vessels / devices)', 'Escala (embarcaciones / dispositivos)'), val('scale')],
      [T('Target species / area', 'Especies objetivo / zona'), val('area')], [T('Timeline', 'Plazo'), selText('timeline')]]) +
    (val('message') ? '\n\n' + T('Message', 'Mensaje') + ':\n' + val('message') : '') + '\n';
  sendByEmail('quote', ref, T('Quote request', 'Solicitud de presupuesto') + ' ' + ref + ' — ' + val('company'), body);
}
function selText(id) { var s = document.getElementById(id); return s && s.value ? s.options[s.selectedIndex].text.trim() : ''; }

// ---------- página final ----------
function renderDone() {
  var box = document.getElementById('doneBox'), d = null;
  try { d = JSON.parse(sessionStorage.getItem('marexi-shop-last') || 'null'); } catch (e) {}
  if (!d) { box.innerHTML = '<p>' + T('There is no pending request.', 'No hay ninguna solicitud pendiente.') + '</p><div class="actions"><a class="btn ghost" href="' + base() + '/shop/">' + T('← Back to store', '← Volver a la tienda') + '</a></div>'; return; }
  if (d.kind === 'order') { try { localStorage.removeItem('marexi-cart'); } catch (e) {} cartBadge(); }
  box.innerHTML = '<div class="mark">✉</div>' +
    '<h1>' + T('Last step: send the email', 'Último paso: envíe el correo') + '</h1>' +
    '<div class="ref">' + esc(d.ref) + '</div>' +
    '<p>' + T('Your email program has opened with the request already written to <b>' + SHOP_EMAIL + '</b>. Send it and we will get back to you',
      'Se ha abierto su programa de correo con la solicitud ya redactada para <b>' + SHOP_EMAIL + '</b>. Envíela y le responderemos') +
      (d.kind === 'order' ? T(' with a proforma to confirm before invoicing.', ' con una proforma para confirmar antes de facturar.') : T(' shortly.', ' en breve.')) + '</p>' +
    '<div class="actions"><a class="btn" href="' + esc(mailtoUrl(d.subject, d.body)) + '">' + T('Open email again', 'Abrir el correo de nuevo') + '</a>' +
    '<button class="btn ghost" id="copyBtn" onclick="copyMail()">' + T('Copy text', 'Copiar texto') + '</button></div>' +
    '<p class="small">' + T('If your email program did not open, copy the text and send it to ', 'Si no se ha abierto su programa de correo, copie el texto y envíelo a ') +
      '<a href="mailto:' + SHOP_EMAIL + '">' + SHOP_EMAIL + '</a>.</p>' +
    '<div class="mailtext" id="mailText">' + esc(T('Subject', 'Asunto') + ': ' + d.subject + '\n\n' + d.body) + '</div>' +
    '<div class="actions"><a class="btn ghost" href="' + base() + '/shop/">' + T('← Back to store', '← Volver a la tienda') + '</a></div>';
}
function copyMail() {
  var t = document.getElementById('mailText').textContent, b = document.getElementById('copyBtn');
  var ok = function () { b.textContent = T('Copied ✓', 'Copiado ✓'); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () { fallbackCopy(t); ok(); }); else { fallbackCopy(t); ok(); }
}
function fallbackCopy(t) { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }

// ---------- arranque ----------
function shopRender() {
  cartBadge();
  var page = document.body.getAttribute('data-page');
  if (page === 'catalogue') renderCatalogue();
  if (page === 'product') renderProduct();
  if (page === 'cart') renderCart();
  if (page === 'checkout') renderMini();
  if (page === 'quote') renderQuoteHead();
  if (page === 'done') renderDone();
}
document.addEventListener('DOMContentLoaded', function () {
  shopRender();
  var f = document.getElementById('ordForm'); if (f) f.addEventListener('submit', submitOrder);
  var q = document.getElementById('qForm'); if (q) q.addEventListener('submit', submitQuote);
});
window.addEventListener('storage', function (e) { if (e.key === 'marexi-cart') shopRender(); });
