// ==UserScript==
// @name         Flow Leve
// @namespace    https://github.com/Gabrielbatman266
// @version      1.0
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
    { ligado: true, liberarMemoria: true, telaLigada: false },
    (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })()
  );
  const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

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
  `;
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

  function iniciar() {
    montarBotao();
    if (cfg.ligado) varrer(document.body);
    obs.observe(document.body, { childList: true, subtree: true });
    pedirTelaLigada();
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();
