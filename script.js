/* =====================================================================
   Intermediación Inmobiliaria by Mariana Pérez — script.js
   Concepto «Plano vivo». Sin dependencias: todo es JavaScript nativo.

   Principios de robustez:
   - Cada módulo corre dentro de su propio try/catch: si uno falla, los demás siguen.
   - El contenido es visible por defecto. Los estados ocultos solo existen con la
     clase .js (puesta en <html> por un script en línea) y todos tienen respaldo.
   - Los revelados usan IntersectionObserver + un barrido por geometría en
     scroll/resize + un barrido a los ~2 s de cargar.
   - Se respeta prefers-reduced-motion en cada efecto.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 0. Configuración ---------- */

  // ÚNICO lugar donde vive el número de WhatsApp (lada 52 + 10 dígitos).
  // Si queda vacío, el botón flotante, los CTA de WhatsApp y el envío del
  // formulario se ocultan con elegancia.
  const WHATSAPP_NUMBER = '522222025843';

  // Enlace del catálogo de WhatsApp Business (formato wa.me/c/ con 521 + 10 dígitos).
  const CATALOGO_URL = WHATSAPP_NUMBER ? 'https://wa.me/c/521' + WHATSAPP_NUMBER.slice(2) : '';

  // Horario de atención (hora de Ciudad de México). Clave = día (0 domingo … 6 sábado).
  const TZ = 'America/Mexico_City';
  const HORARIO = { 1: [9, 18], 2: [9, 18], 3: [9, 18], 4: [9, 18], 5: [9, 18], 6: [10, 14] };

  /* ---------- 1. Utilidades ---------- */

  const root = document.documentElement;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const vh = () => window.innerHeight || root.clientHeight || 800;
  const mq = q => (window.matchMedia ? window.matchMedia(q).matches : false);
  const reduce = mq('(prefers-reduced-motion: reduce)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');

  // Planificador de scroll: una sola pasada por fotograma para todos los efectos.
  const scrollTasks = [];
  let ticking = false;
  function runTasks() {
    ticking = false;
    for (let i = 0; i < scrollTasks.length; i++) {
      try { scrollTasks[i](); } catch (err) { /* un efecto roto no detiene a los demás */ }
    }
  }
  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(runTasks);
  }

  // Compartido entre módulos: la ficha de la casa destacada ya es visible.
  let expandInfoOn = true;

  /* ---------- 2. WhatsApp (número, CTA, catálogo) ---------- */

  function waLink(text) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function initWhatsApp() {
    if (!WHATSAPP_NUMBER) {
      root.classList.add('no-wa');
      $$('[data-wa], [data-catalogo]').forEach(a => { a.hidden = true; });
      const form = $('#leadForm');
      const off = $('#noWa');
      if (form) form.hidden = true;
      if (off) off.hidden = false;
      return;
    }
    $$('[data-wa]').forEach(a => {
      a.href = waLink(a.getAttribute('data-msg') || '');
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-catalogo]').forEach(a => {
      a.href = CATALOGO_URL;
      a.target = '_blank';
      a.rel = 'noopener';
    });
    const local = WHATSAPP_NUMBER.replace(/^52/, '');
    const bonito = local.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
    $$('[data-wa-display]').forEach(a => {
      a.textContent = bonito;
      a.href = 'tel:+' + WHATSAPP_NUMBER;
    });
  }

  /* ---------- 3. Cargador ---------- */

  function initLoader() {
    const loader = $('#loader');
    if (!loader) return;
    if (reduce) { loader.classList.add('is-gone'); return; }

    const bar = $('#loaderBar');
    const num = $('#loaderNum');
    const DURACION = 1300;      // el conteo dura 1.3 s
    const LIMITE = 1800;        // cierre forzado: el cargador nunca pasa de ~2.6 s
    const t0 = performance.now();
    let cerrado = false;

    document.body.classList.add('no-scroll');

    function cerrar() {
      if (cerrado) return;
      cerrado = true;
      if (bar) bar.style.transform = 'scaleX(1)';
      if (num) num.textContent = '100';
      loader.style.pointerEvents = 'none';
      loader.classList.add('is-done');
      document.body.classList.remove('no-scroll');
      setTimeout(() => loader.classList.add('is-gone'), 900);
    }

    function pinta(now) {
      if (cerrado) return;
      const t = clamp((now - t0) / DURACION);
      const v = ease(t);
      if (bar) bar.style.transform = 'scaleX(' + v.toFixed(3) + ')';
      if (num) num.textContent = String(Math.round(v * 100));
      if (t >= 1 && (document.readyState === 'complete' || now - t0 > 1500)) { cerrar(); return; }
      requestAnimationFrame(pinta);
    }
    requestAnimationFrame(pinta);
    setTimeout(cerrar, LIMITE); // respaldo por tiempo
  }

  /* ---------- 4. Barra de progreso, encabezado y enlace activo ---------- */

  function initScrollUI() {
    const prog = $('#progress');
    const nav = $('#nav');
    const links = $$('.nav__links a');
    const secs = $$('main > section[id]');

    scrollTasks.push(function () {
      const y = window.pageYOffset || root.scrollTop || 0;
      const max = root.scrollHeight - vh();
      if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max) : 0).toFixed(4) + ')';
      if (nav) nav.classList.toggle('is-stuck', y > 24);

      let actual = '';
      const limite = vh() * 0.4;
      for (let i = 0; i < secs.length; i++) {
        if (secs[i].getBoundingClientRect().top <= limite) actual = secs[i].id;
      }
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + actual));
    });
  }

  /* ---------- 5. Menú móvil ---------- */

  function initMenu() {
    const burger = $('.burger');
    const menu = $('#menu');
    if (!burger || !menu) return;

    function fijar(abierto) {
      burger.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      burger.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', abierto);
      menu.setAttribute('aria-hidden', abierto ? 'false' : 'true');
      document.body.classList.toggle('no-scroll', abierto);
    }
    burger.addEventListener('click', () => fijar(burger.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a')) fijar(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fijar(false); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1000) fijar(false); });
  }

  /* ---------- 6. Revelado al hacer scroll (con respaldo por geometría) ---------- */

  function initReveal() {
    const els = $$('[data-reveal]');
    const mostrar = el => el.classList.add('is-in');

    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(mostrar);
      return;
    }

    // 1) Observador: se observa el propio elemento (ninguno tiene clip-path ni tamaño 0).
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { mostrar(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    els.forEach(el => io.observe(el));

    // 2) Respaldo por geometría: revela lo que ya está en la ventana (o ya quedó arriba).
    function barrido() {
      const h = vh();
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (el.classList.contains('is-in')) continue;
        if (el.getBoundingClientRect().top < h * 0.97) mostrar(el);
      }
    }
    scrollTasks.push(barrido);
    setTimeout(barrido, 2200);
    window.addEventListener('load', () => setTimeout(barrido, 2000));
  }

  /* ---------- 7. Contadores ---------- */

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;

    function correr(el) {
      el._hecho = true;
      const meta = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (reduce) { el.textContent = String(meta); return; }
      const t0 = performance.now();
      const dur = 1600;
      (function paso(now) {
        const t = clamp((now - t0) / dur);
        el.textContent = String(Math.round(ease(t) * meta));
        if (t < 1) requestAnimationFrame(paso); else el.textContent = String(meta);
      })(t0);
    }

    scrollTasks.push(function () {
      const h = vh();
      els.forEach(el => {
        if (el._hecho) return;
        // Los de la ficha de la casa esperan a que la ficha aparezca.
        if (el.closest('[data-expand-info]') && !expandInfoOn) return;
        const r = el.getBoundingClientRect();
        if (r.top < h * 0.92 && r.bottom > 0) correr(el);
      });
    });
  }

  /* ---------- 8. Hero: constelación de partículas doradas ---------- */

  function initHeroCanvas() {
    const cv = $('#heroCanvas');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const hero = cv.parentElement;

    let w = 0, h = 0, dpr = 1, parts = [], raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999, on: false };

    function nueva() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.06,
        r: Math.random() * 1.6 + 0.5,
        a: Math.random() * 0.6 + 0.25,
        t: Math.random() * 6.283
      };
    }

    function medir() {
      const r = hero.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((w * h) / 15000, 26, w < 700 ? 46 : 96));
      parts = [];
      for (let i = 0; i < n; i++) parts.push(nueva());
      if (reduce) dibujar(false);
    }

    function dibujar(mover) {
      ctx.clearRect(0, 0, w, h);
      const D = w < 700 ? 90 : 130;
      const D2 = D * D;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (mover) {
          p.x += p.vx; p.y += p.vy; p.t += 0.02;
          if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
          if (mouse.on) { // las partículas se apartan suavemente del cursor
            const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
            if (d2 < 19600 && d2 > 1) {
              const d = Math.sqrt(d2), f = (1 - d / 140) * 1.1;
              p.x += (dx / d) * f; p.y += (dy / d) * f;
            }
          }
        }
        const alfa = p.a * (0.62 + 0.38 * Math.sin(p.t));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = 'rgba(246,227,174,' + alfa.toFixed(3) + ')';
        ctx.fill();
        for (let j = i + 1; j < parts.length; j++) {
          const q = parts[j];
          const dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < D2) {
            ctx.strokeStyle = 'rgba(226,189,106,' + ((1 - Math.sqrt(d2) / D) * 0.22).toFixed(3) + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        if (mouse.on) { // hilos dorados hacia el cursor
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 24000) {
            ctx.strokeStyle = 'rgba(246,227,174,' + ((1 - Math.sqrt(d2) / 155) * 0.35).toFixed(3) + ')';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }
    }

    function fotograma() {
      raf = 0;
      if (!visible || document.hidden) return;
      dibujar(true);
      raf = requestAnimationFrame(fotograma);
    }
    function arrancar() { if (!raf && visible && !reduce && !document.hidden) raf = requestAnimationFrame(fotograma); }

    medir();
    if ('ResizeObserver' in window) new ResizeObserver(medir).observe(hero);
    else window.addEventListener('resize', medir);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) arrancar(); }).observe(hero);
    }
    document.addEventListener('visibilitychange', arrancar);

    if (finePointer) {
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { mouse.on = false; });
    }
    arrancar();
  }

  /* ---------- 9. Hero: palabra que rota ---------- */

  function initRotator() {
    const box = $('[data-rot]');
    if (!box || reduce) return;
    const words = $$('.rot__w', box);
    if (words.length < 2) return;
    let i = 0;
    setInterval(function () {
      if (document.hidden) return;
      const actual = words[i];
      i = (i + 1) % words.length;
      const sig = words[i];
      actual.classList.remove('is-on');
      actual.classList.add('is-out');
      sig.classList.remove('is-out');
      sig.classList.add('is-on');
      setTimeout(() => actual.classList.remove('is-out'), 760);
    }, 2600);
  }

  /* ---------- 10. Efectos de puntero: luz, 3D y botones magnéticos ---------- */

  function initPointerFX() {
    if (!finePointer || reduce) return;

    // Luz dorada que sigue al cursor en las secciones oscuras.
    $$('[data-spot]').forEach(sec => {
      let px = 0, py = 0, en = false;
      sec.addEventListener('pointermove', e => {
        px = e.clientX; py = e.clientY;
        if (en) return;
        en = true;
        requestAnimationFrame(() => {
          en = false;
          const r = sec.getBoundingClientRect();
          sec.style.setProperty('--mx', (px - r.left) + 'px');
          sec.style.setProperty('--my', (py - r.top) + 'px');
        });
      }, { passive: true });
    });

    // Inclinación 3D del arco del hero.
    const hero = $('#inicio');
    const arch = $('[data-tilt-hero]');
    if (hero && arch) {
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        arch.style.setProperty('--ry', (nx * 14).toFixed(2) + 'deg');
        arch.style.setProperty('--rx', (-ny * 10).toFixed(2) + 'deg');
      }, { passive: true });
      hero.addEventListener('pointerleave', () => {
        arch.style.setProperty('--ry', '0deg');
        arch.style.setProperty('--rx', '0deg');
      });
    }

    // Tarjetas del catálogo: inclinación y brillo.
    $$('.card__in').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--ry', (((x / r.width) - 0.5) * 8).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - (y / r.height)) * 6).toFixed(2) + 'deg');
        card.style.setProperty('--gx', x + 'px');
        card.style.setProperty('--gy', y + 'px');
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });

    // Botones magnéticos.
    $$('.btn--mag').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.2;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- 11. Parallax suave ---------- */

  function initParallax() {
    if (reduce) return;
    const els = $$('[data-parallax]');
    if (!els.length) return;
    scrollTasks.push(function () {
      const h = vh();
      els.forEach(el => {
        const ref = (el.parentElement || el).getBoundingClientRect();
        if (ref.bottom < -200 || ref.top > h + 200) return;
        const v = parseFloat(el.getAttribute('data-parallax')) || 0;
        const y = (ref.top + ref.height / 2 - h / 2) * v;
        el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      });
    });
  }

  /* ---------- 12. Manifiesto: el texto se ilumina palabra por palabra ---------- */

  function initLit() {
    const el = $('[data-lit]');
    if (!el || reduce) return;
    const palabras = [];

    function envolver(nodo) {
      if (nodo.nodeType === 3) {
        const trozos = nodo.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        trozos.forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = t;
          frag.appendChild(s);
          palabras.push(s);
        });
        nodo.parentNode.replaceChild(frag, nodo);
      } else if (nodo.nodeType === 1) {
        Array.prototype.slice.call(nodo.childNodes).forEach(envolver);
      }
    }
    Array.prototype.slice.call(el.childNodes).forEach(envolver);
    if (!palabras.length) return;

    let previo = -1;
    scrollTasks.push(function () {
      const r = el.getBoundingClientRect();
      const h = vh();
      if (r.bottom < -100 && previo === palabras.length) return;
      const p = clamp((h * 0.88 - r.top) / (r.height + h * 0.2));
      const n = Math.round(p * palabras.length);
      if (n === previo) return;
      for (let i = 0; i < palabras.length; i++) palabras[i].classList.toggle('on', i < n);
      previo = n;
    });
  }

  /* ---------- 13. Servicios: las puertas (acordeón) ---------- */

  function initDoors() {
    const wrap = $('[data-doors]');
    if (!wrap) return;
    const puertas = $$('.door', wrap);

    function abrir(puerta) {
      puertas.forEach(d => {
        const on = d === puerta;
        d.classList.toggle('is-open', on);
        const b = $('.door__btn', d);
        if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
        const cuerpo = $('.door__body', d);
        if (cuerpo) { if (on) cuerpo.removeAttribute('inert'); else cuerpo.setAttribute('inert', ''); }
      });
    }
    puertas.forEach(d => {
      d.addEventListener('click', e => { if (e.target.closest('a')) return; abrir(d); });
    });
    abrir(puertas.filter(d => d.classList.contains('is-open'))[0] || puertas[0]);
  }

  /* ---------- 14. Casa destacada: la imagen que se abre con el scroll ---------- */

  function initExpand() {
    const sec = $('[data-expand]');
    if (!sec) return;
    const track = $('.expand__track', sec);
    const sticky = $('.expand__sticky', sec);
    const media = $('[data-expand-media]', sec);
    const img = media ? $('img', media) : null;
    const head = $('[data-expand-head]', sec);
    const info = $('[data-expand-info]', sec);
    const grid = info ? $('.expand__grid', info) : null;
    if (!track || !sticky || !media) return;

    if (reduce) { // sin animación: la escena queda abierta y a la vista
      track.style.height = 'auto';
      sticky.style.position = 'relative';
      return;
    }

    expandInfoOn = false;
    if (head) head.style.transition = 'opacity .45s var(--ease)';

    scrollTasks.push(function () {
      const total = track.offsetHeight - sticky.offsetHeight;
      if (total <= 0) return;
      const r = track.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh() + 200) return;

      const p = clamp(-r.top / total);
      const e = easeIO(clamp(p / 0.55));
      const ancho = window.innerWidth >= 700;
      const sx = (ancho ? 26 : 9) * (1 - e);
      const st = 30 * (1 - e);
      const sb = 12 * (1 - e);
      const rad = 44 * (1 - e);
      media.style.clipPath = 'inset(' + st.toFixed(2) + '% ' + sx.toFixed(2) + '% ' + sb.toFixed(2) + '% ' + sx.toFixed(2) + '% round ' + rad.toFixed(1) + 'px)';
      if (img) img.style.transform = 'scale(' + (1.28 - 0.26 * e).toFixed(3) + ')';

      const a = clamp((p - 0.5) / 0.22);
      if (info) {
        info.style.opacity = a.toFixed(3);
        info.style.transform = 'translateY(' + ((1 - a) * 40).toFixed(1) + 'px)';
      }
      expandInfoOn = a > 0.08;

      // El título solo se retira si la ficha llegara a pisarlo (pantallas bajas).
      if (head && grid) {
        const choca = a > 0.3 && head.getBoundingClientRect().bottom > grid.getBoundingClientRect().top - 8;
        head.style.opacity = choca ? '0' : '1';
      }
    });
  }

  /* ---------- 15. Recorrido: scroll vertical que mueve la galería en horizontal ---------- */

  function initTour() {
    const sec = $('[data-hscroll]');
    if (!sec) return;
    const track = $('.tour__track', sec);
    const sticky = $('.tour__sticky', sec);
    const rail = $('[data-rail]', sec);
    if (!track || !sticky || !rail) return;

    // Las fotos fuera de pantalla también se cargan para que no aparezcan vacías al llegar.
    window.addEventListener('load', () => { $$('img', rail).forEach(i => { i.loading = 'eager'; }); });

    if (reduce) return; // queda como carrusel nativo con snap

    let dist = 0;
    function medir() {
      sec.classList.add('is-pinned');
      rail.style.transform = '';
      dist = Math.max(0, rail.scrollWidth - window.innerWidth);
      track.style.height = (sticky.offsetHeight + dist) + 'px';
      mover();
    }
    function mover() {
      const total = track.offsetHeight - sticky.offsetHeight;
      const r = track.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh() + 200) return;
      const p = total > 0 ? clamp(-r.top / total) : 0;
      rail.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
      sec.style.setProperty('--pp', (p * 100).toFixed(1) + '%');
    }
    scrollTasks.push(mover);

    medir();
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(medir, 150); });
    window.addEventListener('load', medir);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
  }

  /* ---------- 16. Catálogo: filtros ---------- */

  function initFilters() {
    const chips = $$('.fchip');
    const cards = $$('#cards .card');
    const cuenta = $('#cardCount');
    if (!chips.length || !cards.length) return;

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const f = chip.getAttribute('data-filter');
        chips.forEach(c => {
          const on = c === chip;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        let n = 0;
        cards.forEach(card => {
          const tags = (card.getAttribute('data-tags') || '').split(' ');
          const ver = f === 'all' || tags.indexOf(f) !== -1;
          card.hidden = !ver;
          if (!ver) return;
          card.classList.add('is-in'); // por si aún no se había revelado
          if (!reduce) {
            card.classList.remove('pop');
            void card.offsetWidth; // reinicia la animación
            card.style.animationDelay = Math.min(n, 8) * 45 + 'ms';
            card.classList.add('pop');
          }
          n++;
        });
        if (cuenta) cuenta.textContent = String(n);
      });
    });
  }

  /* ---------- 17. Zonas: lista ↔ mapa orbital ---------- */

  function initZonas() {
    const lista = $('.zlist');
    if (!lista) return;
    function caliente(z) {
      $$('[data-z]').forEach(el => el.classList.toggle('is-hot', !!z && el.getAttribute('data-z') === z));
    }
    $$('li[data-z]', lista).forEach(li => {
      const z = li.getAttribute('data-z');
      li.addEventListener('mouseenter', () => caliente(z));
      li.addEventListener('mouseleave', () => caliente(null));
      li.addEventListener('focusin', () => caliente(z));
      li.addEventListener('focusout', () => caliente(null));
      li.addEventListener('click', () => { // en pantallas táctiles: toca para encender / apagar
        if (finePointer) return;
        caliente(li.classList.contains('is-hot') ? null : z);
      });
    });
  }

  /* ---------- 18. Proceso: la línea de tiempo se dibuja al bajar ---------- */

  function initTimeline() {
    const tl = $('[data-tl]');
    if (!tl) return;
    const pasos = $$('.step', tl);
    if (reduce) {
      tl.style.setProperty('--tl', '1');
      pasos.forEach(s => s.classList.add('is-on'));
      return;
    }
    scrollTasks.push(function () {
      const r = tl.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh() + 100) return;
      const medio = vh() * 0.6;
      tl.style.setProperty('--tl', clamp((medio - r.top) / r.height).toFixed(4));
      pasos.forEach(s => s.classList.toggle('is-on', s.getBoundingClientRect().top < medio));
    });
  }

  /* ---------- 19. Compromiso: chat que se escribe, ticker y horario ---------- */

  function initTyped() {
    const el = $('[data-typed]');
    if (!el || reduce) return;
    const completo = el.textContent.trim();
    const caja = el.closest('.tile') || el;
    let fase = 'escribe', i = 0, timer = 0, activo = false, iniciado = false;

    function paso() {
      timer = 0;
      if (!activo) return;
      if (fase === 'escribe') {
        i++;
        el.textContent = completo.slice(0, i);
        if (i >= completo.length) { fase = 'pausa'; timer = setTimeout(paso, 3200); return; }
        timer = setTimeout(paso, 46 + Math.random() * 40);
      } else if (fase === 'pausa') {
        fase = 'borra';
        timer = setTimeout(paso, 30);
      } else {
        i = Math.max(0, i - 3);
        el.textContent = completo.slice(0, i);
        if (i <= 0) { fase = 'escribe'; timer = setTimeout(paso, 700); return; }
        timer = setTimeout(paso, 22);
      }
    }
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(es => {
      activo = es[0].isIntersecting;
      if (activo) {
        if (!iniciado) { iniciado = true; el.textContent = ''; i = 0; }
        if (!timer) timer = setTimeout(paso, 400);
      } else if (timer) { clearTimeout(timer); timer = 0; }
    }, { threshold: 0.3 }).observe(caja);
  }

  function initTicker() {
    const box = $('[data-ticker]');
    if (!box || reduce) return;
    const items = $$('.tick__i', box);
    if (items.length < 2) return;
    let i = 0;
    setInterval(function () {
      if (document.hidden) return;
      items[i].classList.remove('is-on');
      i = (i + 1) % items.length;
      items[i].classList.add('is-on');
    }, 2600);
  }

  function initStatus() {
    const box = $('[data-status]');
    const txt = $('[data-status-text]');
    if (!box || !txt) return;
    const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    function actualizar() {
      let dia, hora, min;
      try {
        const partes = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
        const dato = tipo => { const p = partes.filter(x => x.type === tipo)[0]; return p ? p.value : ''; };
        dia = dias[dato('weekday')];
        hora = parseInt(dato('hour'), 10) % 24;
        min = parseInt(dato('minute'), 10);
      } catch (err) { return; } // sin Intl se queda el texto fijo del HTML
      const rango = HORARIO[dia];
      const ahora = hora + min / 60;
      const abierto = !!rango && ahora >= rango[0] && ahora < rango[1];
      box.classList.toggle('is-open', abierto);
      txt.textContent = abierto
        ? 'Abierto ahora · atendemos hasta las ' + rango[1] + ':00'
        : 'Fuera de horario · Lunes a viernes de 9:00 a 18:00 · Sábados de 10:00 a 14:00';
    }
    actualizar();
    setInterval(actualizar, 60000);
  }

  /* ---------- 20. Preguntas frecuentes: una abierta a la vez ---------- */

  function initFaq() {
    const lista = $('[data-faq]');
    if (!lista) return;
    lista.addEventListener('toggle', e => {
      if (!e.target.open) return;
      $$('details', lista).forEach(d => { if (d !== e.target) d.open = false; });
    }, true);
  }

  /* ---------- 21. Formulario → WhatsApp ---------- */

  function initForm() {
    const form = $('#leadForm');
    if (!form || !WHATSAPP_NUMBER) return;
    const estado = $('#formStatus');
    const campo = n => form.elements[n];

    function decir(msg, error) {
      if (!estado) return;
      estado.textContent = msg;
      estado.hidden = false;
      estado.classList.toggle('is-error', !!error);
    }

    campo('nombre').addEventListener('input', () => campo('nombre').classList.remove('is-bad'));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const nombre = campo('nombre').value.trim();
      if (!nombre) {
        campo('nombre').classList.add('is-bad');
        campo('nombre').focus();
        decir('Dinos tu nombre para saber con quién platicamos.', true);
        return;
      }
      const accion = campo('accion').value;
      const tipo = campo('tipo').value;
      const zona = campo('zona').value.trim();
      const extra = campo('mensaje').value.trim();

      let msg = 'Hola, soy ' + nombre + '. Quiero ' + accion;
      if (tipo) msg += ' (' + tipo + ')';
      msg += '.';
      if (zona) msg += ' Zona o presupuesto: ' + zona + '.';
      if (extra) msg += ' ' + extra;
      msg += ' Los encontré en su página web.';

      const url = waLink(msg);
      const ventana = window.open(url, '_blank');
      if (ventana) { try { ventana.opener = null; } catch (err) { /* nada */ } }
      else window.location.href = url;
      decir('Listo, abrimos WhatsApp con tu mensaje. Si no se abre, usa el botón verde de abajo a la derecha.', false);
    });
  }

  /* ---------- 22. Cinta: acelera con la velocidad del scroll ---------- */

  function initMarquee() {
    const track = $('.marquee__track');
    if (!track || reduce || !track.getAnimations) return;
    let anim = null, rate = 1, raf = 0, lastY = window.pageYOffset || 0;

    function relaja() {
      rate += (1 - rate) * 0.06;
      if (Math.abs(rate - 1) < 0.02) rate = 1;
      if (anim) anim.playbackRate = rate;
      raf = rate !== 1 ? requestAnimationFrame(relaja) : 0;
    }
    scrollTasks.push(function () {
      const y = window.pageYOffset || 0;
      const dy = Math.abs(y - lastY);
      lastY = y;
      if (!anim) anim = track.getAnimations()[0];
      if (!anim || dy < 2) return;
      rate = Math.min(7, Math.max(rate, 1 + dy * 0.12));
      anim.playbackRate = rate;
      if (!raf) raf = requestAnimationFrame(relaja);
    });
  }

  /* ---------- 23. Arranque ---------- */

  function arrancar() {
    [
      initWhatsApp, initLoader, initMenu, initScrollUI, initReveal, initCounters,
      initHeroCanvas, initRotator, initPointerFX, initParallax, initLit, initDoors,
      initExpand, initTour, initFilters, initZonas, initTimeline, initTyped,
      initTicker, initStatus, initFaq, initForm, initMarquee
    ].forEach(fn => {
      try { fn(); } catch (err) { if (window.console) console.warn('[landing] módulo con error:', fn.name, err); }
    });

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('orientationchange', requestUpdate);
    window.addEventListener('load', requestUpdate);
    requestUpdate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
