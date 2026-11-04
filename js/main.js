/* Convite de Honorio & Ana Eloisa. Sem dependências. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var ramp = function (v, a, b) { return clamp((v - a) / (b - a), 0, 1); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var WEDDING = new Date('2026-11-28T19:00:00+01:00').getTime();
  var vh = window.innerHeight;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  function buzz(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

  /* Nome do convidado: ?para=Maria%20Silva ------------------------------- */

  var guest = '';
  try { guest = (new URLSearchParams(location.search).get('para') || '').trim().slice(0, 60); } catch (e) {}
  if (guest) {
    $('#env-guest').textContent = guest;
    $('#env-for').hidden = false;
    var inviteGuest = $('#invite-guest');
    inviteGuest.textContent = guest;
    inviteGuest.hidden = false;
    $('#rsvp-name').value = guest;
  }

  /* Ornamentos: raminhos desenhados por código, para se poderem desenhar no ecrã */

  function leaf(x, y, angle, len, wid) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var tx = x + c * len, ty = y + s * len;
    var mx = x + c * len * 0.5, my = y + s * len * 0.5;
    var nx = -s * wid, ny = c * wid;
    var f = function (n) { return n.toFixed(2); };
    return 'M' + f(x) + ' ' + f(y) +
      'Q' + f(mx + nx) + ' ' + f(my + ny) + ' ' + f(tx) + ' ' + f(ty) +
      'Q' + f(mx - nx) + ' ' + f(my - ny) + ' ' + f(x) + ' ' + f(y);
  }
  function branch(points, leaves, len, wid) {
    // Bézier quadrática com folhas alternadas ao longo do caule
    var p0 = points[0], p1 = points[1], p2 = points[2], d = [];
    d.push('M' + p0[0] + ' ' + p0[1] + 'Q' + p1[0] + ' ' + p1[1] + ' ' + p2[0] + ' ' + p2[1]);
    for (var i = 1; i <= leaves; i++) {
      var t = i / (leaves + 0.5), u = 1 - t;
      var x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      var y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      var a = Math.atan2(2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]));
      var size = len * (1 - t * 0.45);
      d.push(leaf(x, y, a + 0.62, size, wid));
      d.push(leaf(x, y, a - 0.62, size, wid));
    }
    return d;
  }
  function svgFrom(viewBox, paths) {
    return '<svg viewBox="' + viewBox + '" aria-hidden="true">' + paths.map(function (d) {
      return '<path pathLength="1" d="' + d + '"/>';
    }).join('') + '</svg>';
  }
  var SPRIGS = {
    corner: svgFrom('0 0 112 112', branch([[4, 108], [8, 12], [108, 4]], 8, 15, 4.2)),
    divider: svgFrom('0 0 196 34', branch([[92, 17], [56, 9], [8, 17]], 5, 11, 3.2).concat(branch([[104, 17], [140, 25], [188, 17]], 5, 11, 3.2), ['M98 11L104 17L98 23L92 17Z']))
  };
  $$('[data-sprig]').forEach(function (el) { el.innerHTML = SPRIGS[el.getAttribute('data-sprig')]; });

  /* Calendário ----------------------------------------------------------- */

  (function () {
    var box = $('#cal');
    var heads = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
    var html = '<p class="cal__title">Novembro de 2026</p><div class="cal__grid">';
    heads.forEach(function (d) { html += '<abbr>' + d + '</abbr>'; });
    for (var b = 0; b < 6; b++) html += '<span></span>'; // o dia 1 é domingo
    for (var n = 1; n <= 30; n++) {
      if (n === 28) {
        html += '<span class="is-day">28<svg class="cal__ring" viewBox="0 0 46 46" aria-hidden="true"><path pathLength="1" d="M31 6C17 2 5 11 4 23c-1 13 10 20 21 19 11-1 18-10 17-21C41 11 32 4 20 6"/></svg></span>';
      } else {
        html += '<span>' + n + '</span>';
      }
    }
    box.innerHTML = html + '</div>';
  })();

  /* Fotos de cena: cada uma é uma versão esmeralda por cima da versão a cores */

  var photos = {};
  $$('.scene__photo').forEach(function (el) {
    var name = el.getAttribute('data-img');
    var color = doc.createElement('img');
    var mono = doc.createElement('img');
    color.alt = ''; mono.alt = '';
    color.decoding = 'async'; mono.decoding = 'async';
    el.appendChild(color);
    el.appendChild(mono);
    photos[el.getAttribute('data-scene-id')] = { el: el, color: color, mono: mono, name: name, loaded: false };
  });
  function loadPhoto(id) {
    var p = photos[id];
    if (!p || p.loaded) return;
    p.loaded = true;
    p.color.src = 'img/' + p.name + '.webp';
    p.mono.src = 'img/' + p.name + '-m.webp';
  }

  /* Sequência de fotogramas: do anel ao casal ---------------------------- */

  var FRAMES = 56;
  var canvas = $('#seq');
  var ctx = canvas.getContext('2d');
  var frames = new Array(FRAMES);
  var shown = -1, wanted = 0, current = 0;

  function frameUrl(i) { return 'seq/' + ('00' + i).slice(-3) + '.webp'; }
  function nearest(i) {
    if (frames[i] && frames[i].ready) return frames[i];
    for (var d = 1; d < FRAMES; d++) {
      if (frames[i - d] && frames[i - d].ready) return frames[i - d];
      if (frames[i + d] && frames[i + d].ready) return frames[i + d];
    }
    return null;
  }
  function draw(pos) {
    var a = Math.floor(pos), t = pos - a;
    var first = nearest(a);
    if (!first) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(first, 0, 0, canvas.width, canvas.height);
    // Mistura com o fotograma seguinte: o movimento fica contínuo entre fotogramas
    if (t > 0.04 && a + 1 < FRAMES && frames[a + 1] && frames[a + 1].ready) {
      ctx.globalAlpha = t;
      ctx.drawImage(frames[a + 1], 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    shown = pos;
  }
  (function preload() {
    // Primeiro uma passagem grossa, depois vai preenchendo: desliza logo, e fica cada vez mais fluido
    var order = [], seen = {}, steps = (saveData || reduced) ? [FRAMES] : [8, 4, 2, 1];
    steps.forEach(function (s) {
      for (var i = 0; i < FRAMES; i += s) if (!seen[i]) { seen[i] = 1; order.push(i); }
    });
    if (!seen[FRAMES - 1]) order.push(FRAMES - 1);
    if (reduced) order = [FRAMES - 1];
    var next = 0, active = 0;
    function pump() {
      while (active < 6 && next < order.length) start(order[next++]);
    }
    function start(i) {
      active++;
      var img = new Image();
      img.onload = function () {
        img.ready = true;
        frames[i] = img;
        active--;
        if (shown < 0 || Math.abs(i - current) < 1.5) draw(current);
        pump();
      };
      img.onerror = function () { active--; pump(); };
      img.src = frameUrl(i);
    }
    pump();
  })();

  /* Cena ativa ----------------------------------------------------------- */

  var sceneItems = $$('[data-scene-id]');
  var triggers = $$('[data-scene]').map(function (el) {
    var prev = el.previousElementSibling;
    // A seguir a um painel, a cena muda antes de aparecer: nunca se vê a anterior
    return { el: el, id: el.getAttribute('data-scene'), line: prev && prev.classList.contains('panel') ? 1 : 0.55, top: 0 };
  });
  var currentScene = null;
  var film = $('.scene__film');

  function setScene(id) {
    if (id === currentScene) return;
    currentScene = id;
    sceneItems.forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-scene-id') === id);
    });
    loadPhoto(id);
    syncFilm();
  }
  function syncFilm() {
    if (currentScene === 'festa' && !reduced && !saveData) {
      if (!film.getAttribute('src')) film.src = film.getAttribute('data-src');
      var playing = film.play();
      if (playing && playing.catch) playing.catch(function () {});
    } else {
      film.pause();
    }
  }

  /* Medidas -------------------------------------------------------------- */

  var scrub = $('#scrub');
  var beats = $$('.beat').map(function (el) {
    return { el: el, a: parseFloat(el.getAttribute('data-in')), b: parseFloat(el.getAttribute('data-out')) };
  });
  var cue = $('#cue');
  var dateBox = $('#data');
  var datePieces = {
    kicker: $('[data-date="kicker"]'), day: $('[data-date="day"]'),
    month: $('[data-date="month"]'), time: $('[data-date="time"]')
  };
  var statements = $$('.statement').map(function (el) { return { el: el, top: 0, h: 0 }; });
  var blooms = $$('[data-bloom]').map(function (el) { return { el: el, id: el.getAttribute('data-bloom'), top: 0, h: 0 }; });
  var dock = $('#dock');
  var dockPanels = $$('.invite, .when, .album, .place').map(function (el) { return { el: el, top: 0, bottom: 0 }; });
  var thread = $('#thread');
  var rsvp = $('#confirmar');
  var m = { scrubTop: 0, scrubLen: 1, dateTop: 0, dateLen: 1, rsvpTop: 0, rsvpBottom: 0, max: 1 };

  function pageTop(el) { return el.getBoundingClientRect().top + window.pageYOffset; }
  function measure() {
    vh = window.innerHeight;
    m.scrubTop = pageTop(scrub);
    m.scrubLen = Math.max(1, scrub.offsetHeight - vh);
    m.dateTop = pageTop(dateBox);
    m.dateLen = Math.max(1, dateBox.offsetHeight - vh);
    m.rsvpTop = pageTop(rsvp);
    m.rsvpBottom = m.rsvpTop + rsvp.offsetHeight;
    m.max = Math.max(1, doc.documentElement.scrollHeight - vh);
    dockPanels.forEach(function (d) { d.top = pageTop(d.el); d.bottom = d.top + d.el.offsetHeight; });
    triggers.forEach(function (t) { t.top = pageTop(t.el); });
    statements.forEach(function (s) { s.top = pageTop(s.el); s.h = s.el.offsetHeight; });
    blooms.forEach(function (b) { b.top = pageTop(b.el); b.h = b.el.offsetHeight; });
  }

  /* Tudo o que depende do scroll passa por aqui, uma vez por fotograma ---- */

  var running = false, lastY = -1;

  function paint() {
    var y = window.pageYOffset;
    var moved = y !== lastY;
    lastY = y;

    // Cena: a última cujo gatilho já passou a sua linha
    var id = triggers[0].id;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].top < y + vh * triggers[i].line) id = triggers[i].id;
    }
    setScene(id);

    // Fotogramas, com um pequeno atraso que apaga os saltos do dedo
    var p = ramp(y, m.scrubTop, m.scrubTop + m.scrubLen);
    if (!reduced) {
      // Inteiro: em repouso mostra um fotograma limpo, sem imagem dupla
      wanted = Math.round(ramp(p, 0, 0.84) * (FRAMES - 1));
      current += (wanted - current) * 0.2;
      if (Math.abs(wanted - current) < 0.01) current = wanted;
      if (current !== shown && currentScene === 'anel') draw(current);

      beats.forEach(function (b) {
        var fadeIn = b.a === 0 ? 1 : ramp(p, b.a, b.a + 0.07);
        var fadeOut = 1 - ramp(p, b.b - 0.07, b.b);
        var o = Math.min(fadeIn, fadeOut);
        b.el.style.opacity = o.toFixed(3);
        var shift = (1 - fadeIn) * 18 - (1 - fadeOut) * 18;
        b.el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      });

      // A data: o número vem de muito perto até assentar
      var dp = ramp(y, m.dateTop - vh * 0.1, m.dateTop + m.dateLen * 0.92);
      var z = easeOut(ramp(dp, 0.02, 0.62));
      datePieces.day.style.transform = 'translate3d(0,0,0) scale(' + (3.6 - 2.6 * z).toFixed(3) + ')';
      datePieces.day.style.opacity = ramp(dp, 0, 0.26).toFixed(3);
      [[datePieces.kicker, 0.5], [datePieces.month, 0.58], [datePieces.time, 0.68]].forEach(function (pair) {
        var t = ramp(dp, pair[1], pair[1] + 0.16);
        pair[0].style.opacity = t.toFixed(3);
        pair[0].style.transform = 'translate3d(0,' + ((1 - t) * 14).toFixed(1) + 'px,0)';
      });

      // Texto das cenas: acende ao passar pelo centro, como na Empire
      statements.forEach(function (s) {
        var anchor = s.top - y + s.h / 2;
        if (anchor < -vh || anchor > vh * 2) return;
        var dist = (anchor - vh * 0.66) / (vh * 0.5);
        var o = clamp(1.35 - Math.abs(dist) * 1.3, 0, 1);
        s.el.style.opacity = o.toFixed(3);
        s.el.style.transform = 'translate3d(0,' + (dist * 16).toFixed(1) + 'px,0)';
      });

      // Cada foto nasce em esmeralda e ganha cor; aproxima-se devagar
      blooms.forEach(function (b) {
        var photo = photos[b.id];
        if (!photo || currentScene !== b.id) return;
        var q = ramp(y, b.top - vh * 0.5, b.top + b.h - vh);
        photo.mono.style.opacity = (1 - ramp(q, 0.2, 0.82)).toFixed(3);
        var scale = (1.1 - q * 0.1).toFixed(4);
        var tf = 'translate3d(0,0,0) scale(' + scale + ')';
        photo.color.style.transform = tf;
        photo.mono.style.transform = tf;
      });
    }

    if (moved) {
      if (!saveData && !reduced && !film.getAttribute('src') && y > m.dateTop - vh * 1.5) {
        film.preload = 'auto';
        film.src = film.getAttribute('data-src');
      }
      cue.classList.toggle('is-gone', y > 30);
      var mid = y + vh * 0.6;
      var onPanel = dockPanels.some(function (d) { return mid > d.top && mid < d.bottom; });
      var rsvpNear = y + vh > m.rsvpTop + 40;
      dock.classList.toggle('is-on', opened && onPanel && !rsvpNear);
      thread.style.transform = 'scaleY(' + (y / m.max).toFixed(4) + ')';
    }

    var settling = !reduced && Math.abs(wanted - current) > 0.01;
    if (settling || y !== window.pageYOffset) {
      requestAnimationFrame(paint);
    } else {
      running = false;
    }
  }
  function queue() {
    if (running) return;
    running = true;
    requestAnimationFrame(paint);
  }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { measure(); queue(); });
  window.addEventListener('load', function () { measure(); queue(); });

  /* Aparecer ao entrar --------------------------------------------------- */

  var revealables = $$('.rv, [data-sprig]');
  if ('IntersectionObserver' in window && !reduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        if (entry.target.hasAttribute('data-sprig')) entry.target.classList.add('is-drawn');
        ro.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { ro.observe(el); });
    // Sequência dentro de cada painel
    $$('.panel').forEach(function (panel) {
      $$('.rv', panel).forEach(function (el, i) { el.style.setProperty('--d', Math.min(i * 60, 300) + 'ms'); });
    });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in', 'is-drawn'); });
  }

  /* Música --------------------------------------------------------------- */

  var audio = { ctx: null, gain: null, buffer: null, wantOn: true, playing: false, src: null, data: null };
  var soundBtn = $('#sound');
  var LEVEL = 0.5, FADE = 1.6;

  if (window.fetch && (window.AudioContext || window.webkitAudioContext)) {
    audio.data = fetch('audio/musica.m4a').then(function (r) {
      if (!r.ok) throw new Error('musica');
      return r.arrayBuffer();
    }).catch(function () { return null; });
  }
  function playLoop() {
    if (!audio.buffer || !audio.wantOn) return;
    var c = audio.ctx, t = c.currentTime + 0.02, dur = audio.buffer.duration;
    var src = c.createBufferSource();
    var env = c.createGain();
    src.buffer = audio.buffer;
    src.connect(env);
    env.connect(audio.gain);
    // O ficheiro não foi feito para repetir: entra e sai em fade
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + FADE);
    env.gain.setValueAtTime(1, t + dur - FADE);
    env.gain.linearRampToValueAtTime(0, t + dur);
    src.onended = function () { if (audio.src === src) playLoop(); };
    src.start(t);
    audio.src = src;
    audio.playing = true;
  }
  function startMusic() {
    // Tem de nascer dentro do toque: é a regra dos browsers móveis
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !audio.data) return;
    audio.ctx = new AC();
    audio.gain = audio.ctx.createGain();
    audio.gain.gain.value = LEVEL;
    audio.gain.connect(audio.ctx.destination);
    audio.ctx.resume();
    audio.data.then(function (bytes) {
      if (!bytes) return null;
      return new Promise(function (ok, fail) { audio.ctx.decodeAudioData(bytes, ok, fail); });
    }).then(function (buffer) {
      if (!buffer) return;
      audio.buffer = buffer;
      soundBtn.hidden = false;
      playLoop();
    }).catch(function () {});
  }
  function setSound(on) {
    audio.wantOn = on;
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? 'Desligar a música' : 'Ligar a música');
    if (!audio.ctx) return;
    var t = audio.ctx.currentTime;
    audio.gain.gain.cancelScheduledValues(t);
    audio.gain.gain.setValueAtTime(audio.gain.gain.value, t);
    audio.gain.gain.linearRampToValueAtTime(on ? LEVEL : 0, t + 0.35);
    if (on) {
      audio.ctx.resume();
      if (!audio.playing) playLoop();
    } else {
      setTimeout(function () { if (!audio.wantOn) audio.ctx.suspend(); }, 420);
    }
  }
  soundBtn.addEventListener('click', function () { setSound(!audio.wantOn); });
  doc.addEventListener('visibilitychange', function () {
    if (!audio.ctx) return;
    if (doc.hidden) { audio.ctx.suspend(); film.pause(); }
    else { if (audio.wantOn) audio.ctx.resume(); syncFilm(); }
  });

  /* Abrir o envelope ------------------------------------------------------ */

  var gate = $('#gate');
  var seal = $('#seal');
  var opened = false;

  function showGate() { gate.classList.add('is-ready'); }
  var fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
  var sealImg = new Image();
  var sealReady = new Promise(function (ok) { sealImg.onload = sealImg.onerror = ok; sealImg.src = 'img/selo.webp'; });
  Promise.race([
    Promise.all([fontsReady, sealReady]),
    new Promise(function (ok) { setTimeout(ok, 1600); })
  ]).then(showGate);

  seal.addEventListener('click', function () {
    if (opened) return;
    opened = true;
    buzz(14);
    startMusic();
    gate.classList.add('is-opening');
    root.classList.add('is-open');
    window.setTimeout(function () { buzz(8); }, 560);
    window.setTimeout(function () {
      gate.hidden = true;
      window.scrollTo(0, 0);
      root.classList.remove('is-locked');
      measure();
      queue();
      $('#convite').focus({ preventScroll: true });
    }, reduced ? 320 : 2360);
  });

  /* Contagem decrescente -------------------------------------------------- */

  (function () {
    var box = $('#count');
    var els = { d: $('#c-d'), h: $('#c-h'), m: $('#c-m'), s: $('#c-s') };
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    function tick() {
      var left = WEDDING - Date.now();
      if (left <= 0) {
        box.innerHTML = '<div style="grid-column:1/-1"><b>Hoje é o dia</b></div>';
        clearInterval(timer);
        return;
      }
      var s = Math.floor(left / 1000);
      els.d.textContent = pad(Math.floor(s / 86400));
      els.h.textContent = pad(Math.floor(s % 86400 / 3600));
      els.m.textContent = pad(Math.floor(s % 3600 / 60));
      els.s.textContent = pad(s % 60);
    }
    var timer = setInterval(tick, 1000);
    tick();
  })();

  /* Álbum: atirar a foto com o dedo --------------------------------------- */

  (function () {
    var deck = $('#deck');
    var prints = $$('.print', deck);
    var count = $('#deck-n');
    var index = 0, flying = false;
    var TILT = [-2.4, 1.8, -1.1, 2.6, -1.9, 1.2, -2.8];

    function layout() {
      prints.forEach(function (card, i) {
        var depth = (i - index + prints.length) % prints.length;
        card.style.zIndex = prints.length - depth;
        card.style.opacity = depth > 2 ? 0 : 1;
        card.style.visibility = depth > 2 ? 'hidden' : 'visible';
        card.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
        card.style.transform = 'translate3d(0,' + depth * 11 + 'px,0) scale(' + (1 - depth * 0.045) + ') rotate(' + (depth === 0 ? 0 : TILT[i]) + 'deg)';
      });
      count.textContent = index + 1;
    }
    function fling(dir) {
      if (flying) return;
      flying = true;
      buzz(8);
      var card = prints[index];
      card.classList.remove('is-drag');
      card.style.transform = 'translate3d(' + dir * 130 + '%,-3%,0) rotate(' + dir * 16 + 'deg)';
      card.style.opacity = 0;
      index = (index + 1) % prints.length;
      window.setTimeout(function () {
        // A foto atirada volta, sem se ver, para o fundo do monte
        card.style.transition = 'none';
        layout();
        void card.offsetWidth;
        card.style.transition = '';
        flying = false;
      }, 300);
      // As de baixo sobem já, sem esperar
      prints.forEach(function (c, i) {
        if (c === card) return;
        var depth = (i - index + prints.length) % prints.length;
        c.style.zIndex = prints.length - depth;
        c.style.opacity = depth > 2 ? 0 : 1;
        c.style.visibility = depth > 2 ? 'hidden' : 'visible';
        c.style.transform = 'translate3d(0,' + depth * 11 + 'px,0) scale(' + (1 - depth * 0.045) + ') rotate(' + (depth === 0 ? 0 : TILT[i]) + 'deg)';
      });
      count.textContent = index + 1;
    }
    function back() {
      if (flying) return;
      index = (index - 1 + prints.length) % prints.length;
      var card = prints[index];
      card.style.transition = 'none';
      card.style.transform = 'translate3d(-130%,-3%,0) rotate(-16deg)';
      card.style.opacity = 0;
      card.style.zIndex = prints.length + 1;
      card.style.visibility = 'visible';
      void card.offsetWidth;
      card.style.transition = '';
      layout();
    }

    var drag = null;
    deck.addEventListener('pointerdown', function (e) {
      if (flying || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var card = prints[index];
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, v: 0, card: card, live: false };
    });
    deck.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.live) {
        if (Math.abs(dx) < 6) return;
        drag.live = true;
        drag.card.classList.add('is-drag');
        try { deck.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var dt = e.timeStamp - drag.lastT;
      if (dt > 0) drag.v = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX; drag.lastT = e.timeStamp; drag.dx = dx;
      drag.card.style.transform = 'translate3d(' + dx + 'px,' + Math.abs(dx) * -0.03 + 'px,0) rotate(' + dx * 0.05 + 'deg)';
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      if (!d.live) return;
      d.card.classList.remove('is-drag');
      // Conta a distância e a velocidade: um gesto curto e rápido também atira
      if (e.type !== 'pointercancel' && (Math.abs(d.dx) > 80 || Math.abs(d.v) > 0.5)) fling(d.dx < 0 ? -1 : 1);
      else layout();
    }
    deck.addEventListener('pointerup', end);
    deck.addEventListener('pointercancel', end);

    $('#deck-next').addEventListener('click', function () { fling(-1); });
    $('#deck-prev').addEventListener('click', back);
    layout();
  })();

  /* Morada e WhatsApp ----------------------------------------------------- */

  (function () {
    var copyBtn = $('#copy-addr');
    var ADDRESS = 'Casa Rosa, Bem-fica, Projeto Zona Verde, Área do novo hospital privado de Luanda, Bairro 40, junto ao Colégio Danilo';
    var label = copyBtn.textContent;
    copyBtn.addEventListener('click', function () {
      var done = function () {
        copyBtn.textContent = 'Morada copiada';
        buzz(8);
        window.setTimeout(function () { copyBtn.textContent = label; }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ADDRESS).then(done).catch(fallback);
      } else fallback();
      function fallback() {
        var t = doc.createElement('textarea');
        t.value = ADDRESS;
        t.style.cssText = 'position:fixed;opacity:0;font-size:16px';
        doc.body.appendChild(t);
        t.select();
        try { doc.execCommand('copy'); done(); } catch (e) {}
        t.remove();
      }
    });

    var nameInput = $('#rsvp-name');
    var field = nameInput.closest('.field');
    var msg = $('#rsvp-msg');
    nameInput.addEventListener('input', function () { field.classList.remove('is-wrong'); msg.textContent = ''; });
    $$('.js-wa').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var name = nameInput.value.trim();
        if (!name) {
          e.preventDefault();
          field.classList.add('is-wrong');
          msg.textContent = 'Escreva o seu nome, para os noivos saberem quem confirma.';
          buzz(20);
          nameInput.focus();
          return;
        }
        var text = 'Olá! Sou ' + name + ' e confirmo a minha presença no casamento do Honorio e da Ana Eloisa, no dia 28 de Novembro, às 19h, na Casa Rosa.';
        link.href = 'https://wa.me/' + link.getAttribute('data-phone') + '?text=' + encodeURIComponent(text);
      });
    });
  })();

  /* Atalhos do dock: scroll suave até à secção ----------------------------- */

  $$('.dock a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var target = $(a.getAttribute('href'));
      window.scrollTo({ top: pageTop(target) - 10, behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  // Fotos iniciais das cenas e primeira medição
  Object.keys(photos).forEach(function (id) {
    if (window.requestIdleCallback) requestIdleCallback(function () { loadPhoto(id); }, { timeout: 4000 });
    else setTimeout(function () { loadPhoto(id); }, 1500);
  });
  measure();
  queue();
})();
