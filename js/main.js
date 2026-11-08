/* Convite de Honorio & Eloisa Cabinda. Sem dependências. */
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
  }

  /* Cena ativa ----------------------------------------------------------- */

  var sceneItems = $$('[data-scene-id]');
  var triggers = $$('[data-scene]').map(function (el) {
    var prev = el.previousElementSibling;
    // A seguir a um painel, a cena muda antes de aparecer: nunca se vê a anterior
    return { el: el, id: el.getAttribute('data-scene'), line: prev && prev.classList.contains('panel') ? 1 : 0.55, top: 0 };
  });
  var currentScene = null;
  var videos = $$('video.scene__item');

  function setScene(id) {
    if (id === currentScene) return;
    currentScene = id;
    sceneItems.forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-scene-id') === id);
    });
    loadPhoto(id);
    syncFilm();
  }
  // Como na Empire: o vídeo da cena ativa toca em ciclo; os outros ficam em pausa
  function syncFilm() {
    videos.forEach(function (video) {
      if (video.classList.contains('is-active') && !doc.hidden && !reduced && !saveData) {
        if (!video.getAttribute('src')) video.src = video.getAttribute('data-src');
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () {});
      } else {
        video.pause();
      }
    });
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
  var dockPanels = $$('.panel:not(.album):not(.opening)').map(function (el) { return { el: el, top: 0, bottom: 0 }; });
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

    var p = ramp(y, m.scrubTop, m.scrubTop + m.scrubLen);
    if (!reduced) {
      beats.forEach(function (b) {
        var fadeIn = b.a === 0 ? 1 : ramp(p, b.a, b.a + 0.07);
        var fadeOut = 1 - ramp(p, b.b - 0.07, b.b);
        var o = Math.min(fadeIn, fadeOut);
        b.el.style.opacity = o.toFixed(3);
        var shift = (1 - fadeIn) * 18 - (1 - fadeOut) * 18;
        b.el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
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
      if (window.__arcScroll) window.__arcScroll(y);
      cue.classList.toggle('is-gone', y > 30);
      var mid = y + vh * 0.6;
      var onPanel = dockPanels.some(function (d) { return mid > d.top && mid < d.bottom; });
      var rsvpNear = y + vh > m.rsvpTop + 40;
      dock.classList.toggle('is-on', opened && onPanel && !rsvpNear);
      thread.style.transform = 'scaleY(' + (y / m.max).toFixed(4) + ')';
    }

    if (y !== window.pageYOffset) {
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

  /* Música: leitor oficial do YouTube. Não se vê: só se ouve. Começa com o toque no selo;
     se o telemóvel não deixar, aparece um aviso para tocar e ouvir. */

  var MUSIC_ID = 'vA83MufOCoA';
  var MUSIC_START = 18; // segundo do vídeo em que a música começa
  var music = { player: null, ready: false, wantOn: false, playing: false, failed: false };
  var soundBtn = $('#sound');
  var soundHint = $('#sound-hint');

  function showSoundState() {
    soundBtn.setAttribute('aria-pressed', music.playing ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', music.playing ? 'Parar a música' : 'Tocar a música');
    if (music.playing) soundHint.hidden = true;
  }
  function checkStarted() {
    window.setTimeout(function () {
      if (music.wantOn && !music.playing && !music.failed) soundHint.hidden = false;
    }, 2800);
  }
  function tryPlay() {
    if (!music.ready) return;
    music.player.unMute();
    music.player.setVolume(70);
    music.player.playVideo();
    checkStarted();
  }
  function musicUnavailable() {
    music.failed = true;
    music.wantOn = false;
    soundBtn.hidden = true;
    soundHint.hidden = true;
  }
  window.onYouTubeIframeAPIReady = function () {
    music.player = new YT.Player('yt-player', {
      videoId: MUSIC_ID,
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, start: MUSIC_START, rel: 0, modestbranding: 1 },
      events: {
        onReady: function () {
          music.ready = true;
          if (music.wantOn) tryPlay();
        },
        onStateChange: function (e) {
          music.playing = e.data === YT.PlayerState.PLAYING;
          // No fim volta ao ponto escolhido, não ao início do vídeo
          if (e.data === YT.PlayerState.ENDED && music.wantOn) {
            music.player.seekTo(MUSIC_START, true);
            music.player.playVideo();
          }
          showSoundState();
        },
        onError: function (e) {
          // 101 e 150: o dono do vídeo não permite que toque noutros sites
          if (e.data === 101 || e.data === 150 || e.data === 100) musicUnavailable();
        }
      }
    });
  };
  (function () {
    var tag = doc.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = musicUnavailable;
    doc.head.appendChild(tag);
  })();
  function startMusic() {
    music.wantOn = true;
    soundBtn.hidden = false;
    showSoundState();
    tryPlay();
  }
  soundBtn.addEventListener('click', function () {
    if (music.playing) {
      music.wantOn = false;
      music.player.pauseVideo();
      return;
    }
    music.wantOn = true;
    tryPlay();
  });
  soundHint.addEventListener('click', function () {
    soundHint.hidden = true;
    music.wantOn = true;
    tryPlay();
  });
  doc.addEventListener('visibilitychange', function () {
    syncFilm();
    if (!music.ready) return;
    if (doc.hidden) { if (music.playing) music.player.pauseVideo(); }
    else if (music.wantOn) tryPlay();
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

  /* Álbum em arco: gira com o dedo, abre com um toque --------------------- */

  (function () {
    var PHOTOS = [
      ['retrato', 'Honorio e Eloisa Cabinda de pé, ela com a mão no peito dele'],
      ['rosas', 'Os dois diante de rosas brancas e colunas douradas'],
      ['praia', 'Selfie sorridente junto ao mar'],
      ['sentados', 'Sentados lado a lado, ele a olhar para ela'],
      ['aneis-riso', 'Os dois a rir e a mostrar os anéis'],
      ['pergola', 'Os dois de perfil, debaixo de uma pérgola de madeira'],
      ['praia-beijo', 'Os dois numa selfie à beira-mar, ela a mandar um beijo'],
      ['aneis-beijo', 'Os dois a mostrar os anéis, ela a mandar um beijo']
    ];
    var arc = $('#arc');
    var wheel = $('#wheel');
    var CELLS = PHOTOS.length * 2;
    var STEP = 360 / CELLS;
    var dragRot = 0, scrollRot = 0, velocity = 0, spinning = false, dragged = false;

    // Duas voltas das mesmas fotos: o círculo fica cheio
    var html = '';
    for (var i = 0; i < CELLS; i++) {
      var p = PHOTOS[i % PHOTOS.length];
      html += '<button type="button" class="arc__cell" data-i="' + (i % PHOTOS.length) + '" style="--a:' + (i * STEP) + 'deg"' +
        (i >= PHOTOS.length ? ' tabindex="-1" aria-hidden="true"' : ' aria-label="Ampliar: ' + p[1] + '"') +
        '><img src="img/' + p[0] + '-p.webp" alt="" loading="lazy" decoding="async" draggable="false"></button>';
    }
    wheel.innerHTML = html;

    function paintWheel() { wheel.style.transform = 'rotate(' + (dragRot + scrollRot).toFixed(2) + 'deg)'; }
    paintWheel();

    var arcTop = 0;
    function measureArc() { arcTop = pageTop(arc); }
    window.addEventListener('resize', measureArc);
    window.addEventListener('load', measureArc);
    seal.addEventListener('click', function () { setTimeout(measureArc, 2500); });
    window.__arcScroll = function (y) {
      if (reduced) return;
      if (!arcTop) measureArc();
      if (y + vh < arcTop - vh || y > arcTop + vh * 1.5) return;
      scrollRot = (y - arcTop) * 0.05;
      paintWheel();
    };

    function spin() {
      velocity *= 0.95;
      dragRot += velocity;
      paintWheel();
      if (Math.abs(velocity) > 0.02) requestAnimationFrame(spin);
      else spinning = false;
    }

    var drag = null;
    arc.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('#arc-open')) return;
      velocity = 0;
      dragged = false;
      drag = { id: e.pointerId, x: e.clientX, last: e.clientX, t: e.timeStamp, v: 0, live: false };
    });
    arc.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.live) {
        if (Math.abs(e.clientX - drag.x) < 8) return;
        drag.live = true;
        dragged = true;
        arc.classList.add('is-drag');
        try { arc.setPointerCapture(e.pointerId); } catch (err) {}
      }
      // Um dedo a percorrer o ecrã faz cerca de um terço de volta
      var d = (e.clientX - drag.last) * (360 / (Math.PI * 2 * arc.offsetWidth * 0.585));
      var dt = e.timeStamp - drag.t;
      if (dt > 0) drag.v = d / dt * 16;
      drag.last = e.clientX;
      drag.t = e.timeStamp;
      dragRot += d;
      paintWheel();
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var was = drag;
      drag = null;
      arc.classList.remove('is-drag');
      if (was.live && !reduced && e.type !== 'pointercancel') {
        velocity = clamp(was.v, -6, 6);
        if (!spinning) { spinning = true; requestAnimationFrame(spin); }
      }
    }
    arc.addEventListener('pointerup', endDrag);
    arc.addEventListener('pointercancel', endDrag);

    /* Vista ampliada */
    var box = $('#lightbox');
    var boxImg = $('#lb-img');
    var boxN = $('#lb-n');
    var current = 0;
    function show(i) {
      current = (i + PHOTOS.length) % PHOTOS.length;
      boxImg.src = 'img/' + PHOTOS[current][0] + '.webp';
      boxImg.alt = PHOTOS[current][1];
      boxN.textContent = current + 1;
      // A seguinte já a carregar: a passagem fica imediata
      new Image().src = 'img/' + PHOTOS[(current + 1) % PHOTOS.length][0] + '.webp';
    }
    function open(i) {
      show(i);
      if (box.showModal) box.showModal(); else box.setAttribute('open', '');
      requestAnimationFrame(function () { box.classList.add('is-on'); });
    }
    function close() {
      box.classList.remove('is-on');
      window.setTimeout(function () { if (box.close) box.close(); else box.removeAttribute('open'); }, 220);
    }
    wheel.addEventListener('click', function (e) {
      var cell = e.target.closest('.arc__cell');
      if (!cell || dragged) return;
      open(parseInt(cell.getAttribute('data-i'), 10));
    });
    $('#arc-open').addEventListener('click', function () { open(0); });
    $('#lb-close').addEventListener('click', close);
    $('#lb-next').addEventListener('click', function () { show(current + 1); });
    $('#lb-prev').addEventListener('click', function () { show(current - 1); });
    box.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    doc.addEventListener('keydown', function (e) {
      if (!box.open) return;
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
    // Deslizar na foto ampliada passa à seguinte
    var startX = null;
    box.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    box.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) { buzz(8); show(current + (dx < 0 ? 1 : -1)); }
    });
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
        var text = 'Olá! Sou ' + name + ' e confirmo a minha presença no casamento do Honorio e da Eloisa Cabinda, no dia 28 de Novembro, às 19h, na Casa Rosa.';
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

  /* Vídeos em molduras: tocam sozinhos quando aparecem e param quando saem.
     Se o telemóvel não deixar tocar sozinho (poupança de bateria), aparece o botão. */
  (function () {
    var clips = $$('.clip').map(function (box) {
      return { box: box, video: $('video', box), button: $('.clip__play', box), visible: false, blocked: false };
    });
    function load(c) {
      if (c.video.getAttribute('src')) return;
      c.video.src = c.video.getAttribute('data-src');
      c.video.load();
    }
    function play(c) {
      load(c);
      var playing = c.video.play();
      if (playing && playing.then) {
        playing.then(function () { c.blocked = false; c.button.hidden = true; })
          .catch(function () { c.blocked = true; c.button.hidden = false; });
      }
    }
    function sync() {
      clips.forEach(function (c) {
        if (c.visible && !doc.hidden && !saveData && !reduced) play(c);
        else c.video.pause();
      });
    }
    clips.forEach(function (c) {
      c.button.addEventListener('click', function () { c.visible = true; load(c); c.video.play().then(function () { c.button.hidden = true; }).catch(function () {}); });
      c.video.addEventListener('playing', function () { c.button.hidden = true; });
      c.video.addEventListener('error', function () { c.button.hidden = false; });
      // Com poupança de dados ou movimento reduzido, o vídeo só toca se a pessoa pedir
      if (saveData || reduced) c.button.hidden = false;
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var c = clips.filter(function (x) { return x.box === entry.target; })[0];
          c.visible = entry.isIntersecting;
          // Carrega um pouco antes de aparecer, para não começar em branco
          if (entry.isIntersecting || entry.intersectionRatio > 0) load(c);
        });
        sync();
      }, { rootMargin: '25% 0px 25% 0px', threshold: [0, 0.2] });
      clips.forEach(function (c) { io.observe(c.box); });
    } else {
      clips.forEach(function (c) { c.visible = true; });
      sync();
    }
    doc.addEventListener('visibilitychange', sync);
  })();

  // Fotos iniciais das cenas e primeira medição
  Object.keys(photos).forEach(function (id) {
    if (window.requestIdleCallback) requestIdleCallback(function () { loadPhoto(id); }, { timeout: 4000 });
    else setTimeout(function () { loadPhoto(id); }, 1500);
  });
  measure();
  queue();
})();
