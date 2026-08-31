(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const EMBED_STYLE_ID = 'plano-transicao-embedded-style';

  function parentTheme() {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  }

  function routeFromFrame(frame) {
    try {
      const href = frame.contentWindow?.location?.href || '';
      if (href.includes('estudo-por-cargo')) return 'cargo';
      if (href.includes('#/estudar')) return 'estudar';
      if (href.includes('#/revisar')) return 'revisar';
      if (href.includes('#/desempenho')) return 'desempenho';
      return 'inicio';
    } catch { return null; }
  }

  function reflectRoute(frame) {
    const route = routeFromFrame(frame);
    if (!route) return;
    const workspace = $('#studyWorkspace');
    if (workspace) workspace.dataset.studyRoute = route;
    document.querySelectorAll('#studyWorkspace [data-workspace-route]').forEach(button => {
      const active = button.dataset.workspaceRoute === route;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    sessionStorage.setItem('plano.study.route', route);
  }

  function polishFrame(frame) {
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc?.documentElement || !doc.head || !doc.body) return;

      doc.documentElement.setAttribute('data-theme', parentTheme());
      doc.body.dataset.planoEmbedded = 'true';

      let style = doc.getElementById(EMBED_STYLE_ID);
      if (!style) {
        style = doc.createElement('style');
        style.id = EMBED_STYLE_ID;
        style.textContent = `
          html,body{min-height:100%;background:var(--bg,#08131f)!important}
          body[data-plano-embedded="true"]>.topbar,
          body[data-plano-embedded="true"]>.mobile-nav,
          body[data-plano-embedded="true"]>.footer,
          body[data-plano-embedded="true"]>.skip{display:none!important}
          body[data-plano-embedded="true"]>.page,
          body[data-plano-embedded="true"] #app.page{max-width:1480px!important;margin:0 auto!important;padding-top:16px!important;padding-bottom:28px!important;min-height:100vh!important}
          body[data-plano-embedded="true"] .page-heading{padding-top:0!important}
          body[data-plano-embedded="true"] .home-hero{margin-top:0!important}
          @media(max-width:720px){body[data-plano-embedded="true"]>.page,body[data-plano-embedded="true"] #app.page{padding:12px 10px 24px!important}}
        `;
        doc.head.append(style);
      }

      if (!win.__planoEmbeddedRouteListener) {
        win.__planoEmbeddedRouteListener = true;
        win.addEventListener('hashchange', () => reflectRoute(frame));
      }
      reflectRoute(frame);
    } catch (error) {
      console.warn('Não foi possível harmonizar o módulo integrado:', error);
    }
  }

  function bindFrame(frame) {
    if (!frame || frame.dataset.planoPolishBound) return;
    frame.dataset.planoPolishBound = '1';
    frame.addEventListener('load', () => requestAnimationFrame(() => polishFrame(frame)));
    if (frame.contentDocument?.readyState === 'complete') polishFrame(frame);
  }

  function findAndBindFrame() {
    const frame = $('#studyWorkspaceFrame');
    if (frame) bindFrame(frame);
  }

  function syncFrameTheme() {
    const frame = $('#studyWorkspaceFrame');
    if (!frame) return;
    try { frame.contentDocument?.documentElement?.setAttribute('data-theme', parentTheme()); } catch {}
  }

  function installedMode() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function updateInstallState() {
    const button = $('#installBtn');
    if (installedMode()) {
      document.documentElement.dataset.installed = 'true';
      button?.classList.add('hidden');
    } else {
      delete document.documentElement.dataset.installed;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    findAndBindFrame();
    updateInstallState();

    const content = $('#content');
    if (content) {
      new MutationObserver(findAndBindFrame).observe(content, {childList:true, subtree:true});
    }

    new MutationObserver(syncFrameTheme).observe(document.documentElement, {attributes:true, attributeFilter:['class']});
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', updateInstallState);
    window.addEventListener('appinstalled', () => {
      updateInstallState();
      if (typeof window.toast === 'function') window.toast('Plano de Transição instalado.');
    });
  });
})();
