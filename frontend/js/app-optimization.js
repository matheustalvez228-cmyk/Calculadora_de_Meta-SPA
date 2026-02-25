/**
 * OTIMIZAÇÃO DE PERFORMANCE - Sistema de Inicialização Centralizado
 * Evita múltiplas IIFE rodando simultaneamente
 */

window.AppOptimization = {
  initialized: false,
  isMaster: false,
  isOperator: false,
  token: null,
  payload: null,
  
  // Cache de dados para evitar requisições repetidas
  cache: {
    operatorData: null,
    walletSummary: null,
    operatorsDashboard: null,
    lastCacheTime: {}
  },
  
  /**
   * Inicialização centralizada da aplicação
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Obter token
    this.token = localStorage.getItem('token');
    if (!this.token) return; // Ainda não autenticado
    
    try {
      this.payload = JSON.parse(atob(this.token.split('.')[1] || '{}'));
      this.isMaster = !!this.payload.isMaster;
      this.isOperator = !this.isMaster;
    } catch (e) {
      console.error('Erro ao parsear token:', e);
      return;
    }
    
    // Inicializar baseado no tipo de usuário
    if (this.isMaster) {
      this.initMaster();
    } else {
      this.initOperator();
    }
  },
  
  /**
   * Inicializar seções do master sob demanda (lazy loading)
   */
  initMaster() {
    // Observar quando o usuário muda de tab
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) {
        const tabName = tabBtn.getAttribute('data-tab');
        if (tabName === 'dashboard') {
          this.loadMasterDashboard();
        } else if (tabName === 'area-master') {
          this.loadMasterArea();
        }
      }
    });
  },
  
  /**
   * Lazy load do dashboard do master
   */
  async loadMasterDashboard() {
    const dashboard = document.getElementById('masterDashboardRecebimento');
    if (!dashboard || dashboard.hasAttribute('data-loaded')) return;
    
    try {
      dashboard.innerHTML = '<p style="padding: 20px; color: #999;">Carregando...</p>';
      
      // Usar cache se disponível e recente (< 30 segundos)
      const now = Date.now();
      let summary, operators;
      
      if (this.cache.walletSummary && (now - (this.cache.lastCacheTime.summary || 0)) < 30000) {
        summary = this.cache.walletSummary;
      } else {
        summary = await this.apiCall('/master/wallet-summary');
        this.cache.walletSummary = summary;
        this.cache.lastCacheTime.summary = now;
      }
      
      if (this.cache.operatorsDashboard && (now - (this.cache.lastCacheTime.operators || 0)) < 30000) {
        operators = this.cache.operatorsDashboard;
      } else {
        operators = await this.apiCall('/master/operators-dashboard');
        this.cache.operatorsDashboard = operators;
        this.cache.lastCacheTime.operators = now;
      }
      
      // Renderizar de forma otimizada
      dashboard.innerHTML = this.renderMasterDashboard(summary, operators);
      dashboard.setAttribute('data-loaded', 'true');
    } catch (err) {
      dashboard.innerHTML = `<div class="error-message">Erro ao carregar: ${err.message}</div>`;
    }
  },
  
  /**
   * Lazy load da área master
   */
  async loadMasterArea() {
    const area = document.getElementById('masterAreaMaster');
    if (!area || area.hasAttribute('data-loaded')) return;
    
    try {
      area.innerHTML = '<p style="padding: 20px; color: #999;">Carregando...</p>';
      
      const now = Date.now();
      let summary;
      
      if (this.cache.walletSummary && (now - (this.cache.lastCacheTime.summary || 0)) < 30000) {
        summary = this.cache.walletSummary;
      } else {
        summary = await this.apiCall('/master/wallet-summary');
        this.cache.walletSummary = summary;
        this.cache.lastCacheTime.summary = now;
      }
      
      area.innerHTML = this.renderMasterArea(summary);
      area.setAttribute('data-loaded', 'true');
      
      // Attach event listeners
      this.attachMasterAreaListeners();
    } catch (err) {
      area.innerHTML = `<div class="error-message">Erro ao carregar: ${err.message}</div>`;
    }
  },
  
  /**
   * Renderizar dashboard do master (sem event listeners)
   */
  renderMasterDashboard(summary, operators) {
    const formatCurrency = (v) => {
      const num = Number(v) || 0;
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    const formatPercent = (v) => (Number(v) || 0).toFixed(2) + '%';
    
    let operatorRows = operators.map(op => `
      <tr>
        <td><strong>${op.name}</strong></td>
        <td>R$ ${formatCurrency(op.monthlyGoal)}</td>
        <td>R$ ${formatCurrency(op.actualValue)}</td>
        <td>R$ ${formatCurrency(op.receivedValue)}</td>
        <td>${formatPercent(op.percentualAtingido)}</td>
        <td>R$ ${formatCurrency(op.bonificacao_receber)}</td>
        <td><span class="${op.bateuMeta ? 'status-success' : 'status-warning'}">${op.bateuMeta ? 'Atingiu' : 'Não Atingiu'}</span></td>
      </tr>
    `).join('');
    
    return `
      <div class="master-dashboard-container">
        <div class="summary-cards">
          <div class="card">
            <h3>Recebimento Total</h3>
            <div class="big-value">R$ ${formatCurrency(summary.totalRecebimento)}</div>
          </div>
          <div class="card">
            <h3>Meta da Carteira</h3>
            <div class="big-value">R$ ${formatCurrency(summary.metaCarteira)}</div>
          </div>
          <div class="card">
            <h3>Percentual Atingido</h3>
            <div class="big-value">${formatPercent(summary.percentualAtingido)}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(100, summary.percentualAtingido)}%"></div>
            </div>
          </div>
          <div class="card">
            <h3>Operadores</h3>
            <div class="big-value">${summary.operatorCount}</div>
          </div>
        </div>
        <div class="operators-table-container">
          <h2>Operadores e Recebimentos</h2>
          <table class="master-table">
            <thead>
              <tr>
                <th>Operador</th>
                <th>Meta Individual</th>
                <th>Faturamento</th>
                <th>Recebimento</th>
                <th>% Meta</th>
                <th>Bonificação (Previsão)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${operatorRows}</tbody>
          </table>
        </div>
      </div>
    `;
  },
  
  /**
   * Renderizar área master (sem event listeners)
   */
  renderMasterArea(summary) {
    const formatCurrency = (v) => {
      const num = Number(v) || 0;
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    const formatPercent = (v) => (Number(v) || 0).toFixed(2) + '%';
    
    return `
      <div class="master-area-container">
        <div class="master-section">
          <h2>Dados Gerais da Carteira</h2>
          <div class="wallet-data-container">
            <div class="wallet-data-item">
              <label>Valor Total Recebido</label>
              <div class="data-display">R$ ${formatCurrency(summary.totalRecebimento)}</div>
            </div>
            <div class="wallet-data-item">
              <label>Meta da Carteira (Editável)</label>
              <div class="data-input-group">
                <input type="number" id="inputMetaCarteira" value="${summary.metaCarteira}" placeholder="Valor da meta">
                <button id="btnSaveMetaCarteira" class="btn-action">Salvar Meta</button>
              </div>
            </div>
            <div class="wallet-data-item">
              <label>% Atingido</label>
              <div class="data-display">
                <strong>${formatPercent(summary.percentualAtingido)}</strong>
                <div class="progress-bar-horizontal">
                  <div class="progress-fill" style="width: ${Math.min(100, summary.percentualAtingido)}%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="master-section">
          <h2>Gestão de Bonificação</h2>
          <div class="bonus-management-container">
            <div class="bonus-input-group">
              <label>Valor Total de Bonificação</label>
              <input type="number" id="inputBonificacao" value="0" placeholder="Valor total" step="0.01">
            </div>
            <div id="bonusPreviewContainer" style="display: none; margin-top: 20px;">
              <h3>Prévia de Distribuição Proporcional</h3>
              <table class="bonus-table">
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th>% Meta</th>
                    <th>Peso</th>
                    <th>Bonificação</th>
                  </tr>
                </thead>
                <tbody id="bonusPreviewBody"></tbody>
              </table>
            </div>
            <div class="bonus-button-group">
              <button id="btnCalcularDivisao" class="btn-primary">Calcular Divisão Proporcional</button>
              <button id="btnSalvarBonificacao" class="btn-success" style="display: none;">Salvar Bonificações</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  
  /**
   * Attach event listeners (após renderização)
   */
  attachMasterAreaListeners() {
    document.getElementById('btnSaveMetaCarteira')?.addEventListener('click', () => this.salvarMetaCarteira());
    document.getElementById('btnCalcularDivisao')?.addEventListener('click', () => this.calcularDivisaoProporcional());
    document.getElementById('btnSalvarBonificacao')?.addEventListener('click', () => this.salvarBonificacoes());
  },
  
  /**
   * Salvar meta da carteira
   */
  async salvarMetaCarteira() {
    try {
      const metaInput = document.getElementById('inputMetaCarteira');
      const metaValue = Number(metaInput.value);
      
      if (!metaValue || metaValue <= 0) {
        alert('Por favor, insira um valor válido');
        return;
      }
      
      await this.apiCall('/master/update-cart-meta', 'POST', { metaCarteira: metaValue });
      
      // Invalidar cache
      this.cache.walletSummary = null;
      this.cache.operatorsDashboard = null;
      
      alert('Meta atualizada com sucesso!');
      
      // Recarregar ambas as áreas
      document.getElementById('masterDashboardRecebimento')?.removeAttribute('data-loaded');
      document.getElementById('masterAreaMaster')?.removeAttribute('data-loaded');
      
      this.loadMasterDashboard();
      this.loadMasterArea();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  },
  
  /**
   * Calcular divisão proporcional
   */
  bonusDistributionData: null,
  
  async calcularDivisaoProporcional() {
    try {
      const bonificacaoInput = document.getElementById('inputBonificacao');
      const bonificacaoValue = Number(bonificacaoInput.value);
      
      if (!bonificacaoValue || bonificacaoValue <= 0) {
        alert('Insira um valor para bonificação');
        return;
      }
      
      const result = await this.apiCall('/master/calculate-bonus-proportional', 'POST', {
        bonificacaoTotal: bonificacaoValue
      });
      
      this.bonusDistributionData = result.distribution;
      
      const formatCurrency = (v) => {
        const num = Number(v) || 0;
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      
      const formatPercent = (v) => (Number(v) || 0).toFixed(2) + '%';
      
      const previewBody = document.getElementById('bonusPreviewBody');
      let html = '';
      
      for (const opId in result.distribution) {
        const opData = result.distribution[opId];
        html += `
          <tr>
            <td>${opData.name}</td>
            <td>${formatPercent(opData.percentualAtingido)}</td>
            <td>${opData.weight.toFixed(2)}</td>
            <td>R$ ${formatCurrency(opData.bonusShare)}</td>
          </tr>
        `;
      }
      
      previewBody.innerHTML = html;
      document.getElementById('bonusPreviewContainer').style.display = 'block';
      document.getElementById('btnSalvarBonificacao').style.display = 'inline-block';
      
      if (result.operadoresBeneficiados === 0) {
        alert('Nenhum operador bateu a meta ainda');
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  },
  
  /**
   * Salvar bonificações
   */
  async salvarBonificacoes() {
    try {
      if (!this.bonusDistributionData) {
        alert('Calcule a divisão primeiro');
        return;
      }
      
      const bonificacaoInput = document.getElementById('inputBonificacao');
      const bonificacaoValue = Number(bonificacaoInput.value);
      
      await this.apiCall('/master/save-bonus', 'POST', {
        bonificacaoTotal: bonificacaoValue,
        distribution: this.bonusDistributionData
      });
      
      // Invalidar cache
      this.cache.walletSummary = null;
      this.cache.operatorsDashboard = null;
      
      alert('✓ Bonificações salvas!');
      
      // Reset
      this.bonusDistributionData = null;
      document.getElementById('inputBonificacao').value = '0';
      document.getElementById('bonusPreviewContainer').style.display = 'none';
      document.getElementById('btnSalvarBonificacao').style.display = 'none';
      
      // Recarregar
      document.getElementById('masterDashboardRecebimento')?.removeAttribute('data-loaded');
      this.loadMasterDashboard();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  },
  
  /**
   * Inicializar operador (lazy loading)
   */
  initOperator() {
    // Não fazer requisições imediatas
    // Só carregar quando a view fica visível
  },
  
  /**
   * Fazer requisição com cache automático
   */
  async apiCall(endpoint, method = 'GET', body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.token
      }
    };
    if (body) opts.body = JSON.stringify(body);
    
    const res = await fetch('/api' + endpoint, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }
};

// Inicializar quando o DOM está pronto, mas SEM bloquear rendering
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.AppOptimization.init(), 0);
  });
} else {
  setTimeout(() => window.AppOptimization.init(), 0);
}
