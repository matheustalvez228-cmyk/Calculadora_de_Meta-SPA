/**
 * SPA Navigation and View Management System
 * 
 * Configuração de Carteiras:
 * - BV_RODAS: acesso a ConcRacing e Garagem
 * - BV_CARTAO: acesso a BV Cartões
 * - master: acesso total
 */

// ============================================================================
// CONFIGURAÇÃO DE VISIBILIDADE POR CARTEIRA
// ============================================================================

const WALLET_CONFIG = {
  // BV Cartões - exclusivamente para operadores de cartão
  bv_cartao: {
    name: 'BV Cartões',
    visibleViews: ['view-login', 'view-register', 'view-operator', 'view-recebimento', 'view-bvcartoes', 'view-concduvidas', 'view-operatordata'],
    visibleNavItems: ['view-operator', 'view-recebimento', 'view-bvcartoes', 'view-concduvidas'],
    hideElements: {
      'view-concracing': true,
      'view-garagem': true
    }
  },

  // BV Rodas - exclusivamente para operadores de rodas/conciliação
  bv_rodas: {
    name: 'BV Rodas',
    visibleViews: ['view-login', 'view-register', 'view-operator', 'view-recebimento', 'view-concracing', 'view-garagem', 'view-concduvidas', 'view-operatordata'],
    visibleNavItems: ['view-operator', 'view-recebimento', 'view-concracing', 'view-garagem', 'view-concduvidas'],
    hideElements: {
      'view-bvcartoes': true
    }
  },

  // Master - acesso total (SEM operador)
  master: {
    name: 'Master',
    visibleViews: ['view-login', 'view-register', 'view-master', 'view-master-operadores', 'view-master-meta', 'view-operadores-tabela'],
    visibleNavItems: ['view-master', 'view-master-operadores', 'view-master-meta'],
    hideElements: {}
  }
};

// ============================================================================
// ESTADO DA APLICAÇÃO
// ============================================================================

let appState = {
  currentView: 'view-login',
  currentWallet: null,
  isMaster: false,
  token: null,
  user: null
};

// ============================================================================
// FUNÇÃO PRINCIPAL DE NAVEGAÇÃO
// ============================================================================

/**
 * Carrega o conteúdo da view dinamicamente
 * @param {string} viewId - ID da view
 */
function loadViewContent(viewId) {
  // Load content from the old pages if needed
  if (viewId === 'view-operator') {
    if (window.loadOperator) {
      window.loadOperator();
    }
  } else if (viewId === 'view-recebimento') {
    const recContent = document.getElementById('recebimentoContent');
    if (recContent) {
      if (window.loadRecebimentoPage) {
        window.loadRecebimentoPage();
      } else if (window.loadRecebimento) {
        window.loadRecebimento();
      }
    }
  } else if (viewId === 'view-bvcartoes') {
    if (window.initBVCartoes) {
      window.initBVCartoes();
    }
  } else if (viewId === 'view-concracing') {
    if (window.loadConcRacing) {
      window.loadConcRacing();
    } else if (window.loadConcracing) {
      window.loadConcracing();
    }
  } else if (viewId === 'view-garagem') {
    if (window.loadGaragem) {
      window.loadGaragem();
    }
  } else if (viewId === 'view-concduvidas') {
    if (window.loadConcDuvidas) {
      window.loadConcDuvidas();
    }
  } else if (viewId === 'view-operatordata') {
    if (window.loadOperatorData) {
      window.loadOperatorData();
    }
  } else if (viewId === 'view-master') {
    if (window.loadMasterDashboard) {
      window.loadMasterDashboard();
    }
  } else if (viewId === 'view-master-operadores') {
    if (window.loadMasterOperadores) {
      window.loadMasterOperadores();
    }
  } else if (viewId === 'view-master-meta') {
    if (window.loadMasterMeta) {
      window.loadMasterMeta();
    }
  }
}

/**
 * Muda para a tela especificada
 * @param {string} viewId - ID da view a ser exibida (ex: 'view-operator')
 * @param {boolean} skipValidation - Se true, ignora validações de permissão
 */
function mudartela(viewId, skipValidation = false) {
  // Validar se a view existe
  const viewElement = document.getElementById(viewId);
  if (!viewElement) {
    console.error(`View não encontrada: ${viewId}`);
    return false;
  }

  // Validar permissões se necessário
  if (!skipValidation && !isViewAllowedForWallet(viewId)) {
    console.warn(`Acesso negado à view: ${viewId}`);
    return false;
  }

  // Ocultar todas as views
  document.querySelectorAll('section.view').forEach(view => {
    view.classList.remove('active');
  });

  // Mostrar a view solicitada
  viewElement.classList.add('active');

  // Atualizar estado
  appState.currentView = viewId;

  // Atualizar indicador ativo na touchbar
  updateTouchbarActive(viewId);

  // Log para debug
  console.log(`Navegou para: ${viewId}`);

  return true;
}

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO E PERMISSÃO
// ============================================================================

/**
 * Verifica se a view é permitida para a carteira atual
 * @param {string} viewId - ID da view
 * @returns {boolean}
 */
function isViewAllowedForWallet(viewId) {
  if (!appState.currentWallet && viewId !== 'view-login' && viewId !== 'view-register') {
    return false;
  }

  const config = WALLET_CONFIG[appState.currentWallet];
  if (!config) {
    return viewId === 'view-login' || viewId === 'view-register';
  }

  return config.visibleViews.includes(viewId);
}

/**
 * Obtém a configuração de carteira atual
 * @returns {Object} Configuração da carteira
 */
function getCurrentWalletConfig() {
  return WALLET_CONFIG[appState.currentWallet] || {};
}

/**
 * Atualiza a visibilidade de elementos baseado na carteira atual
 */
function updateWalletVisibility() {
  const config = getCurrentWalletConfig();

  // Ocultar todas as views não permitidas
  document.querySelectorAll('section.view').forEach(view => {
    const viewId = view.id;
    if (!config.visibleViews || !config.visibleViews.includes(viewId)) {
      view.style.display = 'none';
      view.setAttribute('data-wallet-exclusive', 'hidden');
    } else {
      view.style.display = '';
      view.removeAttribute('data-wallet-exclusive');
    }
  });

  // Ocultar itens da touchbar não permitidos
  document.querySelectorAll('.touchbar a').forEach(link => {
    const dataView = link.getAttribute('data-view');
    const walletExclusive = link.getAttribute('data-wallet-exclusive');
    
    // Verificar wallet exclusive
    if (walletExclusive === 'master' && !appState.isMaster) {
      link.style.display = 'none';
      return;
    }
    if (walletExclusive === 'non-master' && appState.isMaster) {
      link.style.display = 'none';
      return;
    }
    if (walletExclusive && walletExclusive !== 'master' && walletExclusive !== 'non-master' && walletExclusive !== appState.currentWallet) {
      link.style.display = 'none';
      return;
    }
    
    if (dataView && config.visibleNavItems && !config.visibleNavItems.includes(dataView)) {
      link.style.display = 'none';
    } else {
      link.style.display = '';
    }
    
    // Atualizar título do botão baseado em se é master ou não
    if (appState.isMaster) {
      const masterLabel = link.getAttribute('data-label-master');
      if (masterLabel) {
        link.title = masterLabel;
      }
    } else {
      const operatorLabel = link.getAttribute('data-label-operator');
      if (operatorLabel) {
        link.title = operatorLabel;
      }
    }
  });

  // Aplicar ocultamento de elementos específicos
  Object.keys(config.hideElements || {}).forEach(elementId => {
    const el = document.getElementById(elementId);
    if (el) {
      el.style.display = 'none';
      el.setAttribute('data-wallet-exclusive', 'hidden');
    }
  });
}

/**
 * Atualiza o indicador ativo da touchbar
 * @param {string} viewId - ID da view ativa
 */
function updateTouchbarActive(viewId) {
  document.querySelectorAll('.touchbar a').forEach(link => {
    const dataView = link.getAttribute('data-view');
    if (dataView === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// ============================================================================
// AUTENTICAÇÃO
// ============================================================================

/**
 * Autentica o usuário e configura a carteira
 * @param {string} token - JWT Token
 */
function authenticateUser(token) {
  if (!token) {
    logout();
    return false;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));

    appState.token = token;
    appState.user = {
      id: payload.id || payload.sub,
      name: payload.name,
      wallet: payload.wallet || payload.carteira,
      isMaster: !!payload.isMaster
    };

    // Use session from JWT for wallet type determination (bv_cartao, bv_rodas)
    appState.isMaster = !!payload.isMaster;
    
    // Se é master, use configuração de master; senão use a carteira específica
    if (appState.isMaster) {
      appState.currentWallet = 'master';
    } else {
      appState.currentWallet = payload.session || payload.wallet || payload.carteira || 'bv_rodas';
    }

    // Salvar token no localStorage
    localStorage.setItem('token', token);

    // Atualizar UI
    updateUserInfo();
    updateWalletVisibility();

    // Redirecionar para dashboard apropriado
    const targetView = appState.isMaster ? 'view-master' : 'view-operator';
    mudartela(targetView, true);

    return true;
  } catch (error) {
    console.error('Erro ao autenticar:', error);
    logout();
    return false;
  }
}

/**
 * Faz logout do usuário
 */
function logout() {
  appState = {
    currentView: 'view-login',
    currentWallet: null,
    isMaster: false,
    token: null,
    user: null
  };

  localStorage.removeItem('token');
  document.getElementById('userInfo').textContent = '';
  mudartela('view-login', true);
}

/**
 * Atualiza as informações do usuário na navbar
 */
function updateUserInfo() {
  const userInfoEl = document.getElementById('userInfo');
  if (appState.user) {
    const wallet = getCurrentWalletConfig().name || appState.currentWallet;
    userInfoEl.textContent = `${appState.user.name} (${wallet})`;
  } else {
    userInfoEl.textContent = '';
  }
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

/**
 * Inicializa a aplicação SPA
 */
function initializeSPA() {
  // Configurar listeners de navegação da touchbar
  document.querySelectorAll('.touchbar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = link.getAttribute('data-view');
      if (viewId) {
        mudartela(viewId);
        // Trigger load of view content
        loadViewContent(viewId);
      }
    });
  });

  // Configurar botão de logout
  document.getElementById('btnLogout').addEventListener('click', logout);

  // Verificar autenticação existente
  const token = localStorage.getItem('token');
  if (token) {
    authenticateUser(token);
  } else {
    mudartela('view-login', true);
  }

  // Configurar eventos de login/registro
  setupAuthEvents();

  console.log('SPA inicializada com sucesso');
}

/**
 * Configura eventos de autenticação
 */
function setupAuthEvents() {
  // Toggle de senha
  const togglePwd = document.getElementById('togglePwd');
  if (togglePwd) {
    togglePwd.addEventListener('click', (e) => {
      e.preventDefault();
      const pwd = document.getElementById('loginPwd');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    });
  }

  const toggleRegPwd = document.getElementById('toggleRegPwd');
  if (toggleRegPwd) {
    toggleRegPwd.addEventListener('click', (e) => {
      e.preventDefault();
      const pwd = document.getElementById('regPwd');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    });
  }

  // Login
  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.addEventListener('click', handleLogin);
  }

  // Mostrar registro
  const btnShowRegister = document.getElementById('btnShowRegister');
  if (btnShowRegister) {
    btnShowRegister.addEventListener('click', () => mudartela('view-register'));
  }

  // Voltar para login
  const btnBackToLogin = document.getElementById('btnBackToLogin');
  if (btnBackToLogin) {
    btnBackToLogin.addEventListener('click', () => mudartela('view-login'));
  }

  // Registrar
  const btnRegister = document.getElementById('btnRegister');
  if (btnRegister) {
    btnRegister.addEventListener('click', handleRegister);
  }
}

/**
 * Manipula o envio do formulário de login
 */
async function handleLogin() {
  const id = document.getElementById('loginId').value.trim();
  const pwd = document.getElementById('loginPwd').value;
  const session = document.getElementById('loginSession').value;

  if (!id || !pwd) {
    alert('Preencha matrícula e senha');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: pwd, session })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      authenticateUser(data.token);
    } else {
      alert(data.error || 'Erro ao fazer login');
    }
  } catch (error) {
    alert('Erro ao fazer login: ' + error.message);
  }
}

/**
 * Manipula o envio do formulário de registro
 */
async function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const id = document.getElementById('regId').value.trim();
  const pwd = document.getElementById('regPwd').value;
  const pwdConfirm = document.getElementById('regPwdConfirm').value;
  const session = document.getElementById('regSession').value;

  if (!name || !id || !pwd || !pwdConfirm) {
    alert('Preencha todos os campos');
    return;
  }

  if (pwd !== pwdConfirm) {
    alert('Senhas não conferem');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id, password: pwd, session })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      alert('Conta criada com sucesso!');
      authenticateUser(data.token);
    } else {
      alert(data.error || 'Erro ao criar conta');
    }
  } catch (error) {
    alert('Erro ao criar conta: ' + error.message);
  }
}

// ============================================================================
// INICIAR QUANDO DOCUMENTO ESTIVER PRONTO
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSPA);
} else {
  initializeSPA();
}

// Exportar funções globais para uso em outros scripts
window.mudartela = mudartela;
window.WALLET_CONFIG = WALLET_CONFIG;
window.appState = appState;
window.authenticateUser = authenticateUser;
window.logout = logout;
window.getCurrentWalletConfig = getCurrentWalletConfig;
window.loadViewContent = loadViewContent;
