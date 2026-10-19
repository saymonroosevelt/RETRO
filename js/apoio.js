/* ============================================================
   RETRO ARCADE — APOIE O CRIADOR (Pix / INSERT COIN)
   ------------------------------------------------------------
   - Chave Pix vem da configuração central (js/config.js).
   - QR Code Pix gerado como payload EMV/BR Code REAL
     (formato do Banco Central, com CRC16), compatível com
     pagamento — não é apenas o texto da chave.
   - Modal abre sem recarregar a página.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.RETRO_CONFIG || {};
  var PIX_KEY = CFG.PIX_KEY || '';
  var MODAL_ID = 'apoio-overlay';
  var inserted = false;

  /* ---------------- Payload EMV / BR Code (Pix Copia e Cola) ---------------- */
  function emv(id, value) {
    var v = String(value);
    return id + (v.length < 10 ? '0' : '') + v.length + v;
  }

  /* CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF) — exigido pelo BR Code */
  function crc16(str) {
    var crc = 0xFFFF;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }

  function buildPixPayload() {
    if (!PIX_KEY) return '';
    var body =
      emv('00', '01') +                                  // Payload Format Indicator
      emv('01', '11') +                                  // Point of Initiation (estático)
      emv('26', emv('00', 'BR.GOV.BCB.PIX') + emv('01', PIX_KEY)) + // Merchant Account (chave Pix)
      emv('52', '0000') +                                // Merchant Category Code
      emv('53', '986') +                                 // Moeda: BRL
      emv('58', 'BR') +                                  // País
      emv('59', 'RETRO ARCADE') +                        // Nome do recebedor (<=25)
      emv('60', 'BRASIL') +                              // Cidade (<=15)
      emv('62', emv('05', 'RETROARC')) +                 // TXID
      '6304';                                            // CRC16 placeholder
    return body + crc16(body);
  }

  /* ---------------- Modal ---------------- */
  function openModal(opts) {
    if (document.getElementById(MODAL_ID)) return;
    opts = opts || {};
    var ov = document.createElement('div');
    ov.id = MODAL_ID;
    ov.className = 'overlay';
    ov.style.zIndex = '300';

    var gameOverLine = opts.gameOver
      ? '<p class="apoio-gameover">Mais uma tentativa? 👾 Se você está curtindo o jogo,<br>considere apoiar o criador.</p>'
      : '';

    ov.innerHTML =
      '<div class="apoio-modal">' +
      '<h2>❤️ Gostou do jogo?</h2>' +
      gameOverLine +
      '<p class="apoio-texto">Este é um projeto independente.<br><br>' +
      'Se você quiser ajudar a manter o jogo online e apoiar novas fases,<br>' +
      'modos e melhorias, pode contribuir com qualquer valor via Pix.<br><br>' +
      'Toda ajuda mantém o projeto vivo. 🕹️</p>' +
      '<div class="apoio-pix">' +
      '<div id="apoio-qr" class="apoio-qr" aria-label="QR Code Pix"></div>' +
      '<p class="apoio-qr-hint">Aponte a câmera do banco para pagar</p>' +
      '<p class="apoio-chave-label">CHAVE PIX:</p>' +
      '<p class="apoio-chave" id="apoio-chave">' + PIX_KEY + '</p>' +
      '<button id="apoio-copy" class="apoio-copy">COPIAR CHAVE PIX</button>' +
      '<p id="apoio-feedback" class="apoio-feedback" role="status"></p>' +
      '</div>' +
      '<button id="apoio-close" class="apoio-close">✕ FECHAR</button>' +
      '</div>';
    document.body.appendChild(ov);
    inserted = true;

    // QR Code real (payload EMV). Se a lib não carregar, só fica sem o QR.
    try {
      if (window.qrcode && PIX_KEY) {
        var qr = qrcode(0, 'M');
        qr.addData(buildPixPayload());
        qr.make();
        document.getElementById('apoio-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1 });
      } else {
        document.getElementById('apoio-qr').classList.add('hidden');
      }
    } catch (e) {
      var el = document.getElementById('apoio-qr');
      if (el) el.classList.add('hidden');
    }

    document.getElementById('apoio-copy').addEventListener('click', function () {
      copyText(PIX_KEY);
    });
    document.getElementById('apoio-close').addEventListener('click', closeModal);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    document.addEventListener('keydown', escClose);
  }

  function escClose(e) { if (e.key === 'Escape') closeModal(); }

  function closeModal() {
    var ov = document.getElementById(MODAL_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    document.removeEventListener('keydown', escClose);
  }

  /* Copia com fallback para navegadores sem Clipboard API (http/file) */
  function copyText(text) {
    var fb = document.getElementById('apoio-feedback');
    function ok() { if (fb) { fb.textContent = '✓ Chave Pix copiada!'; fb.className = 'apoio-feedback ok'; } }
    function fail() { if (fb) { fb.textContent = 'Selecione e copie manualmente: ' + text; fb.className = 'apoio-feedback err'; } }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok).catch(fail);
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var done = document.execCommand('copy');
      document.body.removeChild(ta);
      done ? ok() : fail();
    } catch (e) { fail(); }
  }

  /* ---------------- Botões INSERT COIN ---------------- */
  function open(opts) { openModal(opts); }

  function autoBind() {
    // Botões declarados no HTML
    var ids = ['btnCoinMenu', 'btnCoinRank', 'btnCoinFooter', 'btnCoinGameover'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el._bound) {
        el._bound = true;
        el.addEventListener('click', function () {
          open({ gameOver: id === 'btnCoinGameover' });
        });
      }
    });
    // Botões genéricos com classe
    var list = document.querySelectorAll('.btn-coin:not([data-bound])');
    for (var i = 0; i < list.length; i++) {
      list[i].setAttribute('data-bound', '1');
      (function (b) {
        b.addEventListener('click', function () { open({}); });
      })(list[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBind);
  } else {
    autoBind();
  }
  // Liga também os botões adicionados depois (telas de jogo)
  window.addEventListener('load', autoBind);

  window.RetroApoio = {
    open: open,
    openGameOver: function () { open({ gameOver: true }); },
    bind: autoBind,
    payload: buildPixPayload
  };
})();
