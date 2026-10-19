/* ============================================================
   RETRO ARCADE — Sistema de Ranking MUNDIAL (Supabase)
   ------------------------------------------------------------
   - Fonte principal: tabela "scores" no Supabase (via REST API).
   - Usa apenas a Publishable Key (segura no frontend).
   - Fallback: localStorage quando o Supabase está indisponível.
   - Valida: nickname (1-16), score (número >= 0), jogo válido.
   - Não altera a pontuação dos jogos; apenas a registra.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.RETRO_CONFIG || {};
  var BASE = CFG.SUPABASE_URL || '';
  var KEY = CFG.SUPABASE_PUBLISHABLE_KEY || '';
  var TABLE = CFG.SCORES_TABLE || 'scores';
  var VALID = CFG.VALID_GAMES || ['breakout', 'pong', 'asteroids', 'snake'];

  var NICK_KEY = 'retro_nick';
  var SCORES_KEY = 'retro_scores';       // fallback local
  var REMOTE_CACHE = 'retro_scores_rem';  // cache do ranking mundial

  var MAX_NICK = 16;

  function dbReady() { return !!(BASE && KEY); }

  function headers(extra) {
    var h = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  /* ---------------- Nickname ---------------- */
  function getNick() {
    try { return localStorage.getItem(NICK_KEY) || ''; } catch (e) { return ''; }
  }
  function setNick(nick) {
    nick = String(nick || '').trim().slice(0, MAX_NICK);
    if (!nick) return ''; // não apaga nickname já salvo
    try { localStorage.setItem(NICK_KEY, nick); } catch (e) {}
    return nick;
  }

  /* ---------------- Validações ---------------- */
  function validGame(game) {
    return VALID.indexOf(String(game || '').toLowerCase()) !== -1;
  }
  function validScore(score) {
    return typeof score === 'number' && isFinite(score) && score >= 0;
  }

  /* ---------------- Fallback local ---------------- */
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || []; } catch (e) { return []; }
  }
  function saveLocal(list) {
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(list.slice(-200))); } catch (e) {}
  }

  /* Melhor pontuação local por jogo (mantida como antes) */
  function submitLocal(game, score, nick) {
    var list = loadLocal();
    list.push({ g: game, n: nick, s: Math.round(score), t: Date.now() });
    var best = {};
    list.forEach(function (e) {
      if (!best[e.g] || e.s > best[e.g].s) best[e.g] = e;
    });
    saveLocal(Object.keys(best).map(function (k) { return best[k]; }));
  }

  /* ---------------- Supabase ---------------- */
  /* Envia pontuação. Retorna Promise<boolean>. */
  function pushRemote(game, score, nick) {
    if (!dbReady()) return Promise.resolve(false);
    return fetch(BASE + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ nickname: nick, game: game, score: Math.round(score) })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  /* Busca top N mundial de um jogo (ou todos). Retorna Promise<array|null>. */
  function fetchTop(game, limit, cb) {
    if (!dbReady()) { cb(null); return; }
    var q = BASE + '/rest/v1/' + TABLE +
      '?select=nickname,game,score' +
      (validGame(game) ? '&game=eq.' + encodeURIComponent(game) : '') +
      '&order=score.desc&limit=' + (limit || 10);
    fetch(q, { headers: headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (rows) {
          try { localStorage.setItem(REMOTE_CACHE, JSON.stringify(rows)); } catch (e) {}
        }
        cb(rows);
      })
      .catch(function () { cb(null); });
  }

  /* Cache do ranking mundial para exibição offline */
  function loadRemoteCache() {
    try { return JSON.parse(localStorage.getItem(REMOTE_CACHE)) || null; } catch (e) { return null; }
  }

  /* ---------------- API pública ---------------- */
  /* Envia pontuação ao fim de partida. Guarda local sempre; remoto best-effort. */
  function submit(game, score) {
    var nick = getNick();
    game = String(game || '').toLowerCase();
    if (!nick || !validScore(score) || !validGame(game)) return null;
    submitLocal(game, score, nick);           // fallback local
    pushRemote(game, score, nick);            // fonte principal (assíncrono)
    return { nick: nick, score: Math.round(score) };
  }

  /* Top N: tenta Supabase; se indisponível, usa cache local, depois local. */
  function top(game, limit, cb) {
    fetchTop(game, limit || 10, function (rows) {
      if (rows && rows.length !== undefined) { cb(rows, 'supabase'); return; }
      var cache = loadRemoteCache();
      if (cache && cache.length) {
        var c = validGame(game) ? cache.filter(function (e) { return e.game === game; }) : cache;
        if (c.length) { cb(c.slice(0, limit || 10), 'cache'); return; }
      }
      var loc = loadLocal();
      if (validGame(game)) loc = loc.filter(function (e) { return e.g === game; });
      cb(loc.sort(function (a, b) { return b.s - a.s; }).slice(0, limit || 10)
        .map(function (e) { return { nickname: e.n, game: e.g, score: e.s }; }), 'local');
    });
  }

  /* Renomeia campos do ranking local para o formato comum */
  function normalize(rows) {
    return (rows || []).map(function (e) {
      return { nickname: e.nickname || e.n, game: e.game || e.g, score: e.score || e.s };
    });
  }

  /* ---------------- Modal de nickname (fim de jogo) ---------------- */
  function promptNick(game, score, onSent) {
    if (document.getElementById('rr-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'rr-overlay';
    ov.className = 'overlay';
    ov.style.zIndex = '200';
    ov.innerHTML =
      '<h2 style="font-size:22px">RANKING MUNDIAL</h2>' +
      '<p>PONTUAÇÃO: <b style="color:#ffd800">' + Math.round(score) + '</b><br>' +
      'Digite seu nickname (máx. 16 caracteres):</p>' +
      '<input id="rr-nick" maxlength="16" ' +
      'style="font-family:inherit;font-size:14px;padding:12px;background:#16162b;' +
      'color:#39ff14;border:3px solid #2a2a4a;text-align:center;outline:none;width:260px">' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' +
      '<button id="rr-ok">★ ENVIAR AO RANKING</button>' +
      '<button id="rr-skip" style="background:#444;color:#fff">PULAR</button></div>' +
      '<p id="rr-status" style="font-size:9px;color:#00e5ff;margin-top:8px"></p>';
    document.body.appendChild(ov);

    var input = ov.querySelector('#rr-nick');
    var status = ov.querySelector('#rr-status');
    input.value = getNick();
    input.focus();

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }

    ov.querySelector('#rr-ok').addEventListener('click', function () {
      var nick = setNick(input.value);
      if (!nick) { input.style.borderColor = '#ff2d95'; status.textContent = 'DIGITE UM NICKNAME VÁLIDO.'; return; }
      status.textContent = 'ENVIANDO...';
      var res = submit(game, score);
      if (!res) { status.textContent = 'ERRO AO ENVIAR.'; return; }
      status.textContent = '✓ PONTUAÇÃO ENVIADA AO RANKING MUNDIAL!';
      setTimeout(close, 900);
      if (onSent) onSent(nick);
    });
    ov.querySelector('#rr-skip').addEventListener('click', close);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') ov.querySelector('#rr-ok').click();
    });
  }

  window.RetroRanking = {
    getNick: getNick,
    setNick: setNick,
    submit: submit,
    top: top,
    normalize: normalize,
    prompt: promptNick
  };
})();
