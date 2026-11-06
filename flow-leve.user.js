// ==UserScript==
// @name         Flow Leve
// @namespace    https://github.com/Gabrielbatman266
// @version      1.2
// @description  Deixa o Google Flow mais leve no celular: sem animações, prévias de vídeo pausadas, memória liberada e tela sempre ligada enquanto gera.
// @match        https://labs.google/fx/*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/Gabrielbatman266/Flow-leve
// @updateURL    https://raw.githubusercontent.com/Gabrielbatman266/Flow-leve/main/flow-leve.user.js
// @downloadURL  https://raw.githubusercontent.com/Gabrielbatman266/Flow-leve/main/flow-leve.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Só age nas páginas do Flow
  if (!/\/tools\/flow/.test(location.pathname)) return;

  const KEY = 'flowLeveCfg';
  const cfg = Object.assign(
    { ligado: true, liberarMemoria: true, telaLigada: false, protegerVoltar: true },
    (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })()
  );
  const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  // ---------- 0. Botão voltar não tira mais você do projeto ----------
  // Fica numa "trava" no histórico: voltar fecha menus/janelas primeiro;
  // pra sair do projeto de verdade, toque voltar 2x seguidas.
  const emProjeto = () => /\/tools\/flow\/.+/.test(location.pathname);
  let travado = false;
  let urlTrava = '';
  let ultimoVoltar = 0;

  function armarTrava() {
    if (!cfg.protegerVoltar || travado || !emProjeto()) return;
    // copia o estado atual (o site precisa dele) e duplica a entrada
    history.pushState(history.state, '', location.href);
    travado = true;
    urlTrava = location.href;
  }

  // Quando o próprio site navega, a trava antiga fica pra trás: rearma na nova página
  const pushOriginal = history.pushState.bind(history);
  history.pushState = function (...args) {
    const r = pushOriginal(...args);
    if (!armando) { travado = false; setTimeout(armarSeguro, 300); }
    return r;
  };
  let armando = false;
  function armarSeguro() { armando = true; try { armarTrava(); } finally { armando = false; } }

  function fecharAlgo() {
    // 1º: painéis do próprio script
    for (const id of ['flow-leve-painel', 'flow-leve-menu']) {
      const el = document.getElementById(id);
      if (el && el.style.display === 'block') { el.style.display = 'none'; return true; }
    }
    // 2º: janelas/menus abertos do Flow → manda "Esc"
    const aberto = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"]')]
      .some((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
    if (aberto) {
      const alvo = document.activeElement || document.body;
      ['keydown', 'keyup'].forEach((tipo) =>
        alvo.dispatchEvent(new KeyboardEvent(tipo, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })));
      return true;
    }
    return false;
  }

  window.addEventListener('popstate', (e) => {
    if (!travado || !cfg.protegerVoltar) return;
    travado = false;
    if (location.href !== urlTrava) return; // não foi a nossa trava: deixa o site agir
    e.stopImmediatePropagation(); // o site nem fica sabendo desse "voltar"
    if (fecharAlgo()) { armarSeguro(); return; }
    const agora = Date.now();
    if (agora - ultimoVoltar < 2000) { history.back(); return; } // 2º toque: sai de verdade
    ultimoVoltar = agora;
    avisar('Toque voltar de novo pra sair do projeto');
    armarSeguro();
  }, true);

  // Navegadores ignoram entradas de histórico criadas sem toque do usuário,
  // então arma a trava (de novo) no primeiro toque na tela também
  window.addEventListener('pointerdown', (e) => { if (!ehNossaUI(e.target)) armarSeguro(); }, true);

  // ---------- 1. CSS: corta animações, desfoques e sombras ----------
  const css = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
    * {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    img { content-visibility: auto; }
  `;
  // Estilo dos botões/painéis do script (sempre ativo, mesmo com modo leve desligado)
  const cssUI = `
    #flow-leve-btn {
      position: fixed; right: 10px; bottom: 90px; z-index: 2147483647;
      width: 44px; height: 44px; border-radius: 50%;
      border: none; font-size: 22px; line-height: 44px; text-align: center;
      background: #1a73e8; color: #fff; opacity: .85;
    }
    #flow-leve-btn.off { background: #555; }
    #flow-leve-menu {
      position: fixed; right: 10px; bottom: 140px; z-index: 2147483647;
      background: #202124; color: #fff; border-radius: 12px; padding: 10px 12px;
      font: 15px/1.4 sans-serif; display: none; min-width: 210px;
    }
    #flow-leve-menu label { display: flex; gap: 8px; align-items: center; padding: 6px 0; }
    #flow-leve-menu small { color: #aaa; }
    #flow-leve-pbtn {
      position: fixed; right: 10px; bottom: 140px; z-index: 2147483647;
      width: 44px; height: 44px; border-radius: 50%; border: none;
      font-size: 24px; line-height: 44px; text-align: center;
      background: #188038; color: #fff; opacity: .85;
    }
    #flow-leve-menu { bottom: 190px; }
    #flow-leve-painel {
      position: fixed; left: 8px; right: 8px; bottom: 190px; z-index: 2147483647;
      max-height: 55vh; overflow-y: auto; display: none;
      background: #202124; color: #fff; border-radius: 12px; padding: 8px 10px;
      font: 15px/1.35 sans-serif;
    }
    #flow-leve-painel .fl-topo { display: flex; justify-content: space-between; align-items: center; padding: 2px 0 6px; }
    #flow-leve-painel small { color: #aaa; }
    #flow-leve-painel .fl-item { display: flex; gap: 6px; align-items: flex-start; border-top: 1px solid #3c4043; padding: 8px 0; }
    #flow-leve-painel .fl-txt {
      flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    }
    #flow-leve-painel .fl-acoes { display: flex; gap: 2px; }
    #flow-leve-painel .fl-mini, #flow-leve-painel .fl-topo .fl-mini {
      background: #3c4043; color: #fff; border: none; border-radius: 8px;
      min-width: 34px; height: 34px; font-size: 16px;
    }
    #flow-leve-aviso {
      position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 2147483647;
      background: #323232; color: #fff; padding: 8px 14px; border-radius: 20px;
      font: 14px sans-serif; display: none;
    }
  `;
  const estiloUI = document.createElement('style');
  estiloUI.id = 'flow-leve-ui';
  estiloUI.textContent = cssUI;
  (document.head || document.documentElement).appendChild(estiloUI);
  let estilo = null;
  function aplicarCSS() {
    if (cfg.ligado && !estilo) {
      estilo = document.createElement('style');
      estilo.id = 'flow-leve-css';
      estilo.textContent = css;
      (document.head || document.documentElement).appendChild(estilo);
    } else if (!cfg.ligado && estilo) {
      estilo.remove(); estilo = null;
    }
  }
  aplicarCSS();

  // ---------- 2. Vídeos: sem autoplay, pausa fora da tela, libera memória ----------
  const tratados = new WeakSet();

  const visibilidade = new IntersectionObserver((entradas) => {
    if (!cfg.ligado) return;
    for (const e of entradas) {
      const v = e.target;
      if (e.isIntersecting) {
        restaurar(v);
      } else {
        if (!v.paused) v.pause();
        if (cfg.liberarMemoria) descarregar(v);
      }
    }
  }, { rootMargin: '300px 0px' });

  function descarregar(v) {
    // Tira o vídeo da memória (decodificador) quando está longe da tela
    if (v.dataset.leveSrc !== undefined) return;
    const src = v.getAttribute('src');
    if (!src) return;
    v.dataset.leveSrc = src;
    v.removeAttribute('src');
    try { v.load(); } catch (e) {}
  }

  function restaurar(v) {
    if (v.dataset.leveSrc === undefined) return;
    v.setAttribute('src', v.dataset.leveSrc);
    delete v.dataset.leveSrc;
    v.preload = 'metadata';
  }

  function tratarVideo(v) {
    if (tratados.has(v)) return;
    tratados.add(v);
    // Prévias da galeria costumam ser autoplay + mudo + loop: essas param
    const ehPrevia = v.autoplay || v.hasAttribute('autoplay') || (v.muted && v.loop);
    if (cfg.ligado && ehPrevia) {
      v.autoplay = false;
      v.removeAttribute('autoplay');
      v.preload = 'none';
      if (!v.paused) v.pause();
      // Se o site tentar dar play sozinho, segura (a não ser que você toque)
      v.addEventListener('play', () => {
        if (cfg.ligado && !v.dataset.leveToque) v.pause();
      });
      v.addEventListener('pointerdown', () => { v.dataset.leveToque = '1'; }, { once: true });
      v.addEventListener('click', () => { v.dataset.leveToque = '1'; }, { once: true });
    }
    visibilidade.observe(v);
  }

  function tratarImg(img) {
    if (img.loading !== 'lazy') img.loading = 'lazy';
    img.decoding = 'async';
  }

  function varrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.tagName === 'VIDEO') tratarVideo(raiz);
    if (raiz.tagName === 'IMG') tratarImg(raiz);
    raiz.querySelectorAll('video').forEach(tratarVideo);
    raiz.querySelectorAll('img').forEach(tratarImg);
  }

  // Agrupa mudanças do DOM pra não pesar (o Flow muda a página o tempo todo)
  let pendentes = [];
  let agendado = false;
  const obs = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) pendentes.push(n);
    if (!agendado) {
      agendado = true;
      setTimeout(() => {
        const lista = pendentes; pendentes = []; agendado = false;
        lista.forEach(varrer);
      }, 250);
    }
  });

  // ---------- 3. Tela ligada (evita o celular dormir e a aba congelar no meio da geração) ----------
  let wakeLock = null;
  async function pedirTelaLigada() {
    if (!cfg.telaLigada || !('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {}
  }
  function soltarTelaLigada() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pedirTelaLigada();
  });

  // ---------- 4. Botão ⚡ com menu ----------
  function montarBotao() {
    if (document.getElementById('flow-leve-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'flow-leve-btn';
    btn.textContent = '⚡';
    btn.title = 'Flow Leve';

    const menu = document.createElement('div');
    menu.id = 'flow-leve-menu';
    menu.innerHTML = `
      <b>Flow Leve</b>
      <label><input type="checkbox" data-k="ligado"> Modo leve</label>
      <label><input type="checkbox" data-k="liberarMemoria"> Liberar memória dos vídeos fora da tela</label>
      <label><input type="checkbox" data-k="telaLigada"> Manter tela ligada</label>
      <label><input type="checkbox" data-k="protegerVoltar"> Voltar não sai do projeto</label>
      <small>Desligar o modo leve recarrega a página.</small>
    `;

    menu.querySelectorAll('input').forEach((inp) => {
      const k = inp.dataset.k;
      inp.checked = !!cfg[k];
      inp.addEventListener('change', () => {
        cfg[k] = inp.checked;
        salvar();
        if (k === 'ligado') {
          if (!cfg.ligado) { location.reload(); return; }
          aplicarCSS(); varrer(document.body);
        }
        if (k === 'telaLigada') cfg.telaLigada ? pedirTelaLigada() : soltarTelaLigada();
        btn.classList.toggle('off', !cfg.ligado);
      });
    });

    btn.addEventListener('click', () => {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    btn.classList.toggle('off', !cfg.ligado);
    document.body.appendChild(menu);
    document.body.appendChild(btn);
  }

  // ---------- 5. Prompts: histórico com reutilização em 1 toque ----------
  const KEY_P = 'flowLevePrompts';
  const MAX_P = 40;
  let prompts = (() => { try { return JSON.parse(localStorage.getItem(KEY_P)) || []; } catch (e) { return []; } })();
  const salvarPrompts = () => { try { localStorage.setItem(KEY_P, JSON.stringify(prompts)); } catch (e) {} };

  const ehNossaUI = (el) => !!(el && el.closest && el.closest('#flow-leve-btn, #flow-leve-menu, #flow-leve-pbtn, #flow-leve-painel'));

  // Acha a caixa de prompt: a maior textarea/campo editável visível da página
  function caixaPrompt() {
    const cands = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')]
      .filter((el) => !ehNossaUI(el) && el.offsetParent !== null);
    if (!cands.length) return null;
    const foco = document.activeElement;
    if (foco && cands.includes(foco)) return foco;
    return cands.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
  }
  const textoDe = (el) => (el ? (el.value !== undefined && el.tagName === 'TEXTAREA' ? el.value : el.innerText) : '').trim();

  function guardarPrompt(t) {
    if (!t || t.length < 3) return;
    prompts = prompts.filter((p) => p.t !== t);
    const fixo = false;
    prompts.unshift({ t, fixo });
    // mantém os fixados mesmo passando do limite
    const fixos = prompts.filter((p) => p.fixo);
    const soltos = prompts.filter((p) => !p.fixo).slice(0, MAX_P);
    prompts = [...fixos, ...soltos];
    salvarPrompts();
  }

  // Coloca o texto na caixa de um jeito que o site (React) perceba
  function colocarPrompt(t) {
    const el = caixaPrompt();
    if (!el) { navigator.clipboard && navigator.clipboard.writeText(t); avisar('Caixa não achada — prompt copiado'); return; }
    el.focus();
    if (el.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, t);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, t);
    }
    avisar('Prompt colocado ✓');
  }

  function avisar(msg) {
    let a = document.getElementById('flow-leve-aviso');
    if (!a) { a = document.createElement('div'); a.id = 'flow-leve-aviso'; document.body.appendChild(a); }
    a.textContent = msg; a.style.display = 'block';
    clearTimeout(avisar.t); avisar.t = setTimeout(() => { a.style.display = 'none'; }, 1600);
  }

  // Grava o prompt quando você envia: Enter na caixa ou toque num botão com texto na caixa
  let ultimoTexto = '';
  document.addEventListener('input', (e) => {
    if (ehNossaUI(e.target)) return;
    const t = textoDe(caixaPrompt());
    if (t) ultimoTexto = t;
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !ehNossaUI(e.target)) guardarPrompt(textoDe(caixaPrompt()) || ultimoTexto);
  }, true);
  document.addEventListener('click', (e) => {
    if (ehNossaUI(e.target)) return;
    const b = e.target.closest && e.target.closest('button, [role="button"]');
    if (!b) return;
    const t = textoDe(caixaPrompt());
    if (t) guardarPrompt(t);
  }, true);

  function montarPrompts() {
    if (document.getElementById('flow-leve-pbtn')) return;
    const btn = document.createElement('button');
    btn.id = 'flow-leve-pbtn';
    btn.textContent = '↺';
    btn.title = 'Reutilizar prompt';

    const painel = document.createElement('div');
    painel.id = 'flow-leve-painel';

    function desenhar() {
      painel.innerHTML = '';
      const topo = document.createElement('div');
      topo.className = 'fl-topo';
      topo.innerHTML = '<b>Prompts</b>';
      const fechar = document.createElement('button');
      fechar.textContent = '✕'; fechar.className = 'fl-mini';
      fechar.onclick = () => { painel.style.display = 'none'; };
      topo.appendChild(fechar);
      painel.appendChild(topo);

      if (!prompts.length) {
        const v = document.createElement('small');
        v.textContent = 'Nenhum prompt ainda. Gere um vídeo e ele aparece aqui.';
        painel.appendChild(v);
        return;
      }
      const ordenados = [...prompts.filter((p) => p.fixo), ...prompts.filter((p) => !p.fixo)];
      ordenados.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'fl-item';
        const txt = document.createElement('div');
        txt.className = 'fl-txt';
        txt.textContent = (p.fixo ? '★ ' : '') + p.t;
        txt.onclick = () => { colocarPrompt(p.t); painel.style.display = 'none'; };
        const acoes = document.createElement('div');
        acoes.className = 'fl-acoes';
        const bFixo = document.createElement('button'); bFixo.className = 'fl-mini';
        bFixo.textContent = p.fixo ? '★' : '☆';
        bFixo.onclick = () => { p.fixo = !p.fixo; salvarPrompts(); desenhar(); };
        const bCopiar = document.createElement('button'); bCopiar.className = 'fl-mini';
        bCopiar.textContent = '📋';
        bCopiar.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(p.t); avisar('Copiado'); };
        const bApagar = document.createElement('button'); bApagar.className = 'fl-mini';
        bApagar.textContent = '🗑';
        bApagar.onclick = () => { prompts = prompts.filter((x) => x !== p); salvarPrompts(); desenhar(); };
        acoes.append(bFixo, bCopiar, bApagar);
        item.append(txt, acoes);
        painel.appendChild(item);
      });
    }

    btn.addEventListener('click', () => {
      const abrir = painel.style.display !== 'block';
      if (abrir) desenhar();
      painel.style.display = abrir ? 'block' : 'none';
      const m = document.getElementById('flow-leve-menu'); if (m) m.style.display = 'none';
    });

    document.body.appendChild(painel);
    document.body.appendChild(btn);
  }

  function iniciar() {
    montarBotao();
    montarPrompts();
    armarSeguro();
    if (cfg.ligado) varrer(document.body);
    obs.observe(document.body, { childList: true, subtree: true });
    pedirTelaLigada();
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();
