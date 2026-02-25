/**
 * EXEMPLO DE INTEGRAÇÃO - Como migrar conteúdo dos HTMLs antigos
 * 
 * Este arquivo demonstra como integrar os scripts existentes
 * com o novo sistema SPA de navegação.
 */

// ============================================================================
// PADRÃO 1: SCRIPTS QUE PRECISAM RODAR QUANDO VIEW FICA ATIVA
// ============================================================================

/**
 * Exemplo: Se o conteúdo de bvcartoes.html carrega dados assincronamente,
 * você pode usar um observador para detectar quando a view fica ativa:
 */

const viewObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'class') {
      const view = mutation.target;
      if (view.classList.contains('active')) {
        // View ficou ativa! Execute inicialização
        const viewId = view.id;
        
        switch(viewId) {
          case 'view-bvcartoes':
            console.log('BV Cartões view ativada');
            // Chamar função que carrega dados de ranking
            if (typeof loadBVCRanking === 'function') {
              loadBVCRanking();
            }
            break;
            
          case 'view-garagem':
            console.log('Garagem view ativada');
            // Chamar função que carrega garagem
            if (typeof loadGaragem === 'function') {
              loadGaragem();
            }
            break;
            
          case 'view-concracing':
            console.log('ConcRacing view ativada');
            // Chamar função que carrega ConcRacing
            if (typeof loadConcRacing === 'function') {
              loadConcRacing();
            }
            break;
            
          case 'view-operator':
            console.log('Operator view ativada');
            // Chamar função que carrega dados do operador
            if (typeof loadOperator === 'function') {
              loadOperator();
            }
            break;
        }
      }
    }
  });
});

// Observar todas as views para mudanças de classe
document.querySelectorAll('section.view').forEach(view => {
  viewObserver.observe(view, { attributes: true, attributeFilter: ['class'] });
});

// ============================================================================
// PADRÃO 2: REDIRECIONAR CLIQUES ANTIGOS PARA NOVAS VIEWS
// ============================================================================

/**
 * Se código antigo faz location.href='/garagem.html',
 * você pode interceptar com listener e usar mudartela() em vez disso:
 */

// Exemplo: Botão que antes redirecionava para garagem.html
const btnGoToGaragem = document.getElementById('btnGaragem');
if (btnGoToGaragem) {
  btnGoToGaragem.addEventListener('click', (e) => {
    // Ao invés de: location.href = '/garagem.html'
    // Agora usa:
    e.preventDefault();
    mudartela('view-garagem');
  });
}

// Ou criar função helper que substitui location.href
const legacyNavigate = (path) => {
  const viewMap = {
    '/operator.html': 'view-operator',
    '/recebimento.html': 'view-recebimento',
    '/garagem.html': 'view-garagem',
    '/conc_racing.html': 'view-concracing',
    '/bvcartoes.html': 'view-bvcartoes',
    '/conc_duvidas.html': 'view-concduvidas',
    '/operator_data.html': 'view-operatordata',
    '/master.html': 'view-master',
    '/operadores_tabela.html': 'view-operadores-tabela'
  };
  
  const viewId = viewMap[path];
  if (viewId) {
    mudartela(viewId);
  } else {
    // Fallback para navegação real
    location.href = path;
  }
};

// Usar em scripts antigos: legacyNavigate('/garagem.html')

// ============================================================================
// PADRÃO 3: ADAPTAR SCRIPTS QUE FAZEM LOCATION.HREF
// ============================================================================

/**
 * Solução: Criar wrapper que intercepta location.href
 * (Cuidado: isso é invasivo, use com moderação)
 */

// OPÇÃO A: Substituir location.href em scripts específicos manualmente
// OPÇÃO B: Usar MutationObserver para detectar tentativas de navegação
// OPÇÃO C: Refatorar scripts para usar mudartela() diretamente

// Exemplo do padrão C (RECOMENDADO):
// No script antigo, ao invés de:
//   location.href = '/garagem.html'
// 
// Use:
//   mudartela('view-garagem');

// ============================================================================
// PADRÃO 4: COMPARTILHAR ESTADO ENTRE VIEWS
// ============================================================================

/**
 * Se múltiplos scripts precisam acessar dados comuns,
 * armazene em um objeto global compartilhado:
 */

const SPASharedState = {
  // Dados de autenticação (já em appState)
  get currentWallet() { return appState.currentWallet; },
  get currentUser() { return appState.user; },
  get token() { return appState.token; },
  
  // Dados específicos da aplicação
  garageData: null,
  operatorData: null,
  bvcRankingData: null,
  
  // Métodos auxiliares
  saveGarageData(data) {
    this.garageData = data;
    localStorage.setItem('spa:garage', JSON.stringify(data));
  },
  
  loadGarageData() {
    const cached = localStorage.getItem('spa:garage');
    return cached ? JSON.parse(cached) : null;
  }
};

// Usar em scripts:
// SPASharedState.saveGarageData(myData);
// const data = SPASharedState.loadGarageData();

// ============================================================================
// PADRÃO 5: MIGRAÇÃO GRADUAL
// ============================================================================

/**
 * Você pode migrar os arquivos gradualmente:
 * 
 * Dia 1: Criar index.html com views e spa.js (FEITO ✓)
 * Dia 2: Mover conteúdo de operator.html para view-operator
 * Dia 3: Mover conteúdo de bvcartoes.html para view-bvcartoes
 * Dia 4: Mover conteúdo de garagem.html para view-garagem
 * etc...
 * 
 * Enquanto isso, manter arquivos antigos como fallback.
 */

// Exemplo: Versão que funciona com ambos os sistemas
const loadOperatorPage = () => {
  if (typeof mudartela === 'function') {
    // Sistema SPA está ativo
    mudartela('view-operator');
  } else {
    // Fallback para sistema antigo
    location.href = '/operator.html';
  }
};

// ============================================================================
// PADRÃO 6: TESTAR PERMISSÕES ANTES DE NAVEGAR
// ============================================================================

/**
 * Validar se usuário tem acesso a uma view específica
 */

function canUserAccessView(viewId) {
  const config = getCurrentWalletConfig();
  if (!config || !config.visibleViews) {
    return false;
  }
  return config.visibleViews.includes(viewId);
}

// Exemplo de uso:
if (canUserAccessView('view-bvcartoes')) {
  console.log('Usuário pode acessar BV Cartões');
} else {
  console.log('Acesso negado');
  showToast('Você não tem acesso a este recurso', 'error');
}

// ============================================================================
// PADRÃO 7: EXECUTAR CÓDIGO QUANDO VIEW MUDA
// ============================================================================

/**
 * Se você precisa executar algo toda vez que a navegação muda,
 * pode criar seu próprio observador:
 */

class ViewChangeListener {
  constructor(callback) {
    this.callback = callback;
    this.currentView = null;
    this.startObserving();
  }
  
  startObserving() {
    setInterval(() => {
      if (appState.currentView !== this.currentView) {
        this.currentView = appState.currentView;
        this.callback(this.currentView);
      }
    }, 100);
  }
}

// Usar:
new ViewChangeListener((viewId) => {
  console.log(`View mudou para: ${viewId}`);
  // Executar lógica aqui
});

// ============================================================================
// PADRÃO 8: CRIAR ALIASES PARA COMPATIBILIDADE
// ============================================================================

/**
 * Se scripts antigos usam nomes diferentes, criar aliases:
 */

// Compatibilidade com código antigo
window.irParaGaragem = () => mudartela('view-garagem');
window.irParaOperador = () => mudartela('view-operator');
window.irParaConcRacing = () => mudartela('view-concracing');
window.irParaBVCartoes = () => mudartela('view-bvcartoes');

// Usar em HTML antigo:
// <button onclick="irParaGaragem()">Ir para Garagem</button>

// ============================================================================
// EXEMPLO COMPLETO: INTEGRAR CONTEÚDO DE bvcartoes.html
// ============================================================================

/**
 * Este é um exemplo de como você integraria o script
 * que está em bvcartoes.html no novo sistema SPA.
 * 
 * ANTES (arquivo separado):
 * 
 * bvcartoes.html:
 * <body>
 *   <div id="bvcRanking"></div>
 *   <script src="/js/bvcartoes-script.js"></script>
 * </body>
 * 
 * bvcartoes-script.js:
 * (async function() {
 *   const ranking = await fetch('/api/conc/ranking/BV_CARTAO');
 *   // ... código de renderização
 * })();
 * 
 * DEPOIS (integrado em SPA):
 * 
 * index.html:
 * <section class="view" id="view-bvcartoes">
 *   <div id="bvcRanking"></div>
 * </section>
 * 
 * spa-bvcartoes-integration.js:
 */

async function initBVCartoeView() {
  // Só executar se estamos no sistema SPA
  if (typeof mudartela === 'undefined') return;
  
  // Configurar observador para quando a view ficar ativa
  const viewElement = document.getElementById('view-bvcartoes');
  if (viewElement) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('active')) {
          loadBVCRankingData();
        }
      });
    });
    
    observer.observe(viewElement, { attributes: true });
  }
}

async function loadBVCRankingData() {
  try {
    const token = localStorage.getItem('token');
    const wallet = appState.currentWallet;
    
    const response = await fetch(
      `/api/conc/ranking/${encodeURIComponent(wallet)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    
    if (!response.ok) throw new Error('Failed to fetch ranking');
    
    const data = await response.json();
    renderBVCRanking(data.ranking || []);
  } catch (error) {
    console.error('Erro ao carregar ranking:', error);
    showToast('Erro ao carregar dados', 'error');
  }
}

function renderBVCRanking(ranking) {
  const listEl = document.getElementById('bvcRanking');
  if (!listEl) return;
  
  listEl.innerHTML = ranking.map((item, idx) => `
    <div class="item">
      <span>#${idx + 1}</span>
      <span>${item.name}</span>
      <span>${item.value}</span>
    </div>
  `).join('');
}

// Inicializar quando SPA carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBVCartoeView);
} else {
  initBVCartoeView();
}

// ============================================================================
// CONCLUSÃO
// ============================================================================

/**
 * A migração para SPA não é um processo tudo-ou-nada.
 * Você pode:
 * 
 * 1. Manter mudartela() simples para início
 * 2. Migrar views uma por uma
 * 3. Manter compatibilidade com código antigo
 * 4. Refatorar scripts conforme necessário
 * 
 * Principais benefícios:
 * ✓ Navegação mais rápida (sem reload de página)
 * ✓ Estado persistente entre views
 * ✓ Controle de acesso centralizado
 * ✓ Código mais organizado e manutenível
 */
