/**
 * SISTEMA MASTER - Telas e Funcionalidades
 * - Dashboard: Lista de operadores com recebimentos vs metas
 * - Área Master: Gerenciamento de meta da carteira e bonificações
 */

(function initMasterSystem() {
  // ========== VERIFICAÇÕES INICIAIS ==========
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    if (!payload.isMaster) return; // Apenas para masters
  } catch (e) {
    return;
  }

  // ========== UTILITÁRIOS ==========
  function formatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatPercent(value) {
    const num = Number(value) || 0;
    return num.toFixed(2) + '%';
  }

  async function apiCall(endpoint, method = 'GET', body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch('/api' + endpoint, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }

  // ========== DASHBOARD - RECEBIMENTO (para masters) ==========
  window.loadMasterDashboard = async function() {
    const container = document.getElementById('view-recebimento');
    if (!container) return;

    try {
      // Fetch data
      const summary = await apiCall('/master/wallet-summary');
      const operatorsData = await apiCall('/master/operators-dashboard');

      // Build HTML
      let html = `
        <div class="master-dashboard-container">
          <h1>Dashboard de Recebimento</h1>
          
          <div class="summary-cards">
            <div class="card">
              <h3>Recebimento Total</h3>
              <div class="big-value" style="color: #0077ff;">R$ ${formatCurrency(summary.totalRecebimento)}</div>
            </div>
            <div class="card">
              <h3>Meta da Carteira</h3>
              <div class="big-value" style="color: #28a745;">R$ ${formatCurrency(summary.metaCarteira)}</div>
            </div>
            <div class="card">
              <h3>% Atingido</h3>
              <div class="big-value" style="color: #ff9800;">${formatPercent(summary.percentualAtingido)}</div>
              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min(100, summary.percentualAtingido)}%"></div>
                </div>
              </div>
            </div>
            <div class="card">
              <h3>Total Operadores</h3>
              <div class="big-value" style="color: #9c27b0;">${operatorsData.length}</div>
            </div>
          </div>

          <div class="operators-table-wrapper">
            <h2>Operadores e Recebimentos</h2>
            <table class="master-operators-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Operador</th>
                  <th>Meta Individual</th>
                  <th>Recebimento</th>
                  <th>% da Meta</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
      `;

      // Add rows
      operatorsData.forEach(op => {
        const metaPercent = (op.recebimento / op.meta_individual) * 100 || 0;
        const status = metaPercent >= 100 ? '✓ Meta Atingida' : '✗ Meta Não Atingida';
        const statusClass = metaPercent >= 100 ? 'status-ok' : 'status-alert';

        html += `
          <tr>
            <td>${op.matricula}</td>
            <td>${op.operator_name}</td>
            <td>R$ ${formatCurrency(op.meta_individual)}</td>
            <td>R$ ${formatCurrency(op.recebimento)}</td>
            <td>${formatPercent(metaPercent)}</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.innerHTML = `<div class="view-content">${html}</div>`;
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      container.innerHTML = `<div class="view-content"><p class="error">Erro ao carregar dados: ${err.message}</p></div>`;
    }
  };

  // ========== ÁREA MASTER - GERENCIAMENTO ==========
  window.loadMasterArea = async function() {
    const container = document.getElementById('view-master');
    if (!container) return;

    try {
      // Fetch summary
      const summary = await apiCall('/master/wallet-summary');

      // Build HTML
      const html = `
        <div class="master-area-container">
          <h1>Área Master - Gerenciamento</h1>

          <!-- SEÇÃO 1: Dados Gerais da Carteira -->
          <div class="master-section">
            <h2>Dados Gerais da Carteira</h2>
            <div class="data-cards">
              <div class="data-card">
                <label>Recebimento Total (Soma)</label>
                <div class="data-value">R$ ${formatCurrency(summary.totalRecebimento)}</div>
              </div>
              <div class="data-card">
                <label>Meta da Carteira (Editável)</label>
                <div class="data-value-edit">
                  <input type="number" id="metaCarteira" value="${summary.metaCarteira}" step="0.01" min="0" />
                  <span class="currency">R$</span>
                </div>
              </div>
              <div class="data-card">
                <label>% de Progresso</label>
                <div class="data-value">
                  ${formatPercent(summary.percentualAtingido)}
                  <div class="progress-bar-small">
                    <div class="progress-fill" style="width: ${Math.min(100, summary.percentualAtingido)}%"></div>
                  </div>
                </div>
              </div>
            </div>
            <button class="btn-primary" id="btnSaveMetaCarteira">
              💾 Salvar Meta da Carteira
            </button>
          </div>

          <!-- SEÇÃO 2: Bonificação dos Operadores -->
          <div class="master-section">
            <h2>Bonificação dos Operadores</h2>
            <p class="section-info">Defina o valor de bonificação para operadores que atingiram/ultrapassaram a meta</p>
            
            <div class="bonus-input-group">
              <div class="bonus-input">
                <label for="valorBonificacao">Valor de Bonificação (R$)</label>
                <input 
                  type="number" 
                  id="valorBonificacao" 
                  placeholder="0.00" 
                  step="0.01" 
                  min="0"
                  value="${summary.currentBonusValue || 0}"
                />
              </div>
            </div>

            <div class="bonus-actions">
              <button class="btn-secondary" id="btnCalculateBonus">
                📊 Dividir Proporcionalmente
              </button>
              <button class="btn-primary" id="btnSaveBonus">
                💾 Salvar Bonificação
              </button>
            </div>

            <!-- Resultado do Cálculo Proporcional -->
            <div id="bonusCalculationResult" style="display: none;">
              <h3>Resultado do Cálculo Proporcional</h3>
              <div id="bonusResultTable"></div>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = `<div class="view-content">${html}</div>`;

      // Attach event listeners
      attachMasterAreaEvents();
    } catch (err) {
      console.error('Erro ao carregar área master:', err);
      container.innerHTML = `<div class="view-content"><p class="error">Erro ao carregar dados: ${err.message}</p></div>`;
    }
  };

  // ========== EVENT HANDLERS ==========
  function attachMasterAreaEvents() {
    // Salvar Meta da Carteira
    const btnSaveMetaCarteira = document.getElementById('btnSaveMetaCarteira');
    if (btnSaveMetaCarteira) {
      btnSaveMetaCarteira.addEventListener('click', async () => {
        const metaInput = document.getElementById('metaCarteira');
        const newMeta = Number(metaInput.value);
        if (isNaN(newMeta) || newMeta < 0) {
          alert('Por favor, insira um valor válido');
          return;
        }

        try {
          await apiCall('/master/update-cart-meta', 'POST', { meta_carteira: newMeta });
          alert('✓ Meta da carteira atualizada com sucesso!');
          loadMasterArea(); // Reload
        } catch (err) {
          alert('✗ Erro ao atualizar meta: ' + err.message);
        }
      });
    }

    // Calcular Bonificação Proporcional
    const btnCalculateBonus = document.getElementById('btnCalculateBonus');
    if (btnCalculateBonus) {
      btnCalculateBonus.addEventListener('click', async () => {
        const valorBonus = Number(document.getElementById('valorBonificacao').value);
        if (isNaN(valorBonus) || valorBonus <= 0) {
          alert('Por favor, insira um valor de bonificação válido');
          return;
        }

        try {
          const result = await apiCall('/master/calculate-bonus-proportional', 'POST', {
            bonus_total: valorBonus
          });

          // Mostrar resultado
          const resultDiv = document.getElementById('bonusCalculationResult');
          let table = `
            <table class="bonus-result-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Operador</th>
                  <th>Meta Individual</th>
                  <th>Recebimento</th>
                  <th>Bonificação Proporcional</th>
                </tr>
              </thead>
              <tbody>
          `;

          result.bonus_breakdown.forEach(op => {
            table += `
              <tr>
                <td>${op.matricula}</td>
                <td>${op.operator_name}</td>
                <td>R$ ${formatCurrency(op.meta_individual)}</td>
                <td>R$ ${formatCurrency(op.recebimento)}</td>
                <td><strong>R$ ${formatCurrency(op.bonus_proporcional)}</strong></td>
              </tr>
            `;
          });

          table += `
              </tbody>
            </table>
          `;

          document.getElementById('bonusResultTable').innerHTML = table;
          resultDiv.style.display = 'block';

          // Store result for save
          window.lastBonusCalculation = result;
        } catch (err) {
          alert('✗ Erro ao calcular bonificação: ' + err.message);
        }
      });
    }

    // Salvar Bonificação
    const btnSaveBonus = document.getElementById('btnSaveBonus');
    if (btnSaveBonus) {
      btnSaveBonus.addEventListener('click', async () => {
        if (!window.lastBonusCalculation) {
          alert('⚠️ Primeiro calcule a distribuição proporcional');
          return;
        }

        try {
          await apiCall('/master/save-bonus', 'POST', {
            bonus_values: window.lastBonusCalculation.bonus_breakdown
          });

          alert('✓ Bonificações salvas com sucesso!');

          // Notificar operadores
          showOperatorNotifications(window.lastBonusCalculation.bonus_breakdown);

          // Limpar cálculo
          window.lastBonusCalculation = null;
          document.getElementById('bonusCalculationResult').style.display = 'none';
          loadMasterArea(); // Reload
        } catch (err) {
          alert('✗ Erro ao salvar bonificação: ' + err.message);
        }
      });
    }
  }

  // ========== NOTIFICAÇÕES PARA OPERADORES ==========
  function showOperatorNotifications(bonusBreakdown) {
    // Limpar notificações anteriores
    document.querySelectorAll('.bonus-notification-master').forEach(n => n.remove());

    // Criar notificação para cada operador que recebeu bonus
    bonusBreakdown.forEach(op => {
      if (op.bonus_proporcional > 0) {
        const notification = document.createElement('div');
        notification.className = 'bonus-notification bonus-notification-master';
        notification.innerHTML = `
          <div class="bonus-notification-content">
            <div class="bonus-notification-icon">🎉</div>
            <div class="bonus-notification-text">
              <strong>Bonificação Atualizada!</strong>
              <p>Você pode receber R$ ${formatCurrency(op.bonus_proporcional)} de bonificação.</p>
              <p style="font-size: 12px; color: #999;">Valor disponível na área de recebimento</p>
            </div>
            <button class="bonus-notification-close" aria-label="Fechar">✕</button>
          </div>
        `;

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
          notification.classList.add('show');
        }, 100);

        // Close button
        notification.querySelector('.bonus-notification-close').addEventListener('click', () => {
          notification.classList.remove('show');
          setTimeout(() => notification.remove(), 300);
        });

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
          }
        }, 10000);
      }
    });
  }

  // ========== AUTO-LOAD QUANDO TELAS FICAM VISÍVEIS ==========
  window.addEventListener('load', () => {
    // Detectar quando view-recebimento fica ativa para masters
    const observer = new MutationObserver(() => {
      const recebimentoView = document.getElementById('view-recebimento');
      const masterView = document.getElementById('view-master');

      if (recebimentoView && recebimentoView.classList.contains('active') && !recebimentoView.querySelector('.master-dashboard-container')) {
        loadMasterDashboard();
      }

      if (masterView && masterView.classList.contains('active') && !masterView.querySelector('.master-area-container')) {
        loadMasterArea();
      }
    });

    observer.observe(document.body, { attributes: true, subtree: true });
  });
})();
