/**
 * FOUC Prevention Script
 * 
 * Script leve que executa IMEDIATAMENTE para:
 * 1. Mostrar esqueleto da navbar
 * 2. Mostrar placeholders de carregamento
 * 3. Garantir que o usuário vê conteúdo estruturado logo de cara
 */

(function() {
  'use strict';

  // Performance mark
  const startTime = performance.now();

  // 1. Inicializar estado de carregamento
  document.documentElement.setAttribute('data-loading', 'true');

  // 2. Criar estilos críticos inline para evitar FOUC
  function injectCriticalStyles() {
    try {
      const style = document.createElement('style');
      style.textContent = `
        /* CRITICAL: Prevent FOUC - Load these first */
        html, body {
          margin: 0;
          padding: 0;
          min-height: 100%;
        }

        body {
          display: flex;
          flex-direction: column;
        }

        .spa-view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .spa-navbar {
          background: #fff;
          border-bottom: 1px solid #e0e0e0;
          z-index: 1000;
          flex-shrink: 0;
        }

        .spa-views-container {
          flex: 1;
          overflow: hidden;
          background: #dceeff;
        }

        /* Hide content while loading for smooth reveal */
        html[data-loading="true"] section.view.active > div {
          opacity: 0;
          transition: opacity 0.3s ease-in;
        }

        html:not([data-loading="true"]) section.view.active > div {
          opacity: 1;
        }

        /* Skeleton animation */
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .skeleton-placeholder {
          background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 8px;
        }
      `;
      document.head.appendChild(style);
    } catch (err) {
      console.warn('[FOUC Prevention] Erro ao injetar estilos críticos:', err);
    }
  }

  // 3. Setup de limpeza
  function setupLoadingCleanup() {
    const cleanup = function() {
      try {
        document.documentElement.removeAttribute('data-loading');
      } catch (err) {
        console.warn('[FOUC Prevention] Erro ao remover data-loading:', err);
      }
    };

    // Quando documento carregar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(cleanup, 100);
      });
    }

    // Quando página completamente carregar
    window.addEventListener('load', cleanup);
  }

  // 4. Monitorar performance
  function monitorLoadingMetrics() {
    try {
      if (window.PerformanceObserver) {
        try {
          const observer = new PerformanceObserver(function(list) {
            const entries = list.getEntries();
            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              if (entry.entryType === 'paint') {
                console.log('[PERF] ' + entry.name + ': ' + entry.startTime.toFixed(2) + 'ms');
              }
            }
          });
          observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        } catch (e) {
          // PerformanceObserver não suportado ou erro
        }
      }
    } catch (err) {
      console.warn('[FOUC Prevention] Erro ao monitorar performance:', err);
    }
  }

  // 5. Prevenir flashes indesejados
  function preventFlashes() {
    try {
      const views = document.querySelectorAll('section.view');
      for (let i = 0; i < views.length; i++) {
        const view = views[i];
        if (!view.classList.contains('active')) {
          view.style.display = 'none';
        }
      }
    } catch (err) {
      console.warn('[FOUC Prevention] Erro ao prevenir flashes:', err);
    }
  }

  // Executar setup crítico
  try {
    injectCriticalStyles();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        preventFlashes();
        setupLoadingCleanup();
        monitorLoadingMetrics();
      });
    } else {
      preventFlashes();
      setupLoadingCleanup();
      monitorLoadingMetrics();
    }
  } catch (err) {
    console.error('[FOUC Prevention] Erro geral:', err);
  }

  // Expor função para remover loading manualmente
  window.hideLoadingState = function() {
    try {
      document.documentElement.removeAttribute('data-loading');
    } catch (err) {
      console.warn('[FOUC Prevention] Erro ao remover loading state:', err);
    }
  };

  // Log de performance ao final
  window.addEventListener('load', function() {
    try {
      const navTiming = performance.getEntriesByType('navigation')[0];
      const perfData = {
        loadTime: (performance.now() - startTime).toFixed(2) + 'ms',
        domInteractive: navTiming ? navTiming.domInteractive.toFixed(2) + 'ms' : 'N/A',
        resourceCount: performance.getEntriesByType('resource').length
      };
      console.log('[FOUC Prevention] Performance Metrics:', perfData);
    } catch (err) {
      console.warn('[FOUC Prevention] Erro ao registrar métricas:', err);
    }
  });
})();
