/* Envío de formularios de marexi.com al receptor del hosting (api.marexi.com).
 * marexiSend(tipo, datos, formulario) → Promise con 'ok' | 'invalid' | 'rate' | 'error'.
 * Si devuelve 'error' (sin conexión, receptor caído…), cada formulario abre el correo del visitante
 * como hasta ahora, para que nunca se pierda un mensaje.
 * Tipos: 'contacto' | 'pinger' | 'presupuesto' | 'pedido' (los destinatarios están fijados en el servidor).
 */
(function () {
  var API = 'https://api.marexi.com/form.php';
  var t0 = Date.now();
  window.marexiSend = function (type, data, form) {
    var url = window.MAREXI_FORM_API || API;          // permite probar en local
    var p = { form: type, t: Math.round((Date.now() - t0) / 1000), consent: true,
              lang: document.documentElement.lang === 'es' ? 'es' : 'en', page: location.pathname };
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) p[k] = data[k];
    if (form) {                                         // casillas trampa antispam
      var hp = form.querySelector('[name=botcheck],[name=website]');
      if (hp && hp.value) p.website = hp.value;
    }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);  // el servidor corta el SMTP a los ~10 s: así nunca hay envío + correo duplicado
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
                        credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        clearTimeout(timer);
        if (x.j && x.j.ok) return 'ok';
        if (x.s === 422) return 'invalid';
        if (x.s === 429) return 'rate';
        return 'error';
      })
      .catch(function () { clearTimeout(timer); return 'error'; });
  };
})();
