/**
 * SISTEMA MASTER - 3 TELAS PRINCIPAIS
 * 1. view-master: Dashboard com resumo da carteira
 * 2. view-master-operadores: Lista de operadores com recebimentos
 * 3. view-master-meta: Configuração de meta e bonificação
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

  // ========== TELA 1: DASHBOARD MASTER ==========
  window.loadMasterDashboard = async function() {
    const container = document.getElementById('view-master');
    if (!container) return;

    try {
      const summary = await apiCall('/master/wallet-summary');
      const operatorsData = await apiCall('/master/operators-dashboard');
      
      // Debug: log dos dados dos operadores
      console.log('Dados dos operadores recebidos:', operatorsData);

      const html = `
        <div class="master-dashboard-container">
          <h2>Resumo da Carteira</h2>
          
          <div class="summary-cards">
            <div class="card card-primary">
              <h3>Recebimento Total</h3>
              <div class="big-value">R$ ${formatCurrency(summary.totalRecebimento)}</div>
              <p class="card-meta">Soma de todos os operadores</p>
            </div>
            <div class="card card-success">
              <h3>Meta da Carteira</h3>
              <div class="big-value">R$ ${formatCurrency(summary.metaCarteira)}</div>
              <p class="card-meta">Meta global definida</p>
            </div>
            <div class="card card-warning">
              <h3>% Atingido</h3>
              <div class="big-value">${formatPercent(summary.percentualAtingido)}</div>
              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min(100, summary.percentualAtingido)}%"></div>
                </div>
              </div>
            </div>
            <div class="card card-info">
              <h3>Total Operadores</h3>
              <div class="big-value">${operatorsData.length}</div>
              <p class="card-meta">Associados à carteira</p>
            </div>
          </div>
          
          <div class="master-actions">
            <button class="btn-primary" onclick="mudartela('view-master-operadores')">
              👥 Ver Operadores e Recebimentos
            </button>
            <button class="btn-secondary" onclick="mudartela('view-master-meta')">
              ⚙️ Configurar Meta e Bonificação
            </button>
          </div>
        </div>
      `;

      container.querySelector('.view-content').innerHTML = html;
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      container.querySelector('.view-content').innerHTML = `<p class="error">Erro: ${err.message}</p>`;
    }
  };

  // ========== TELA 2: OPERADORES E RECEBIMENTOS ==========
  window.loadMasterOperadores = async function() {
    const container = document.getElementById('view-master-operadores');
    if (!container) return;

    try {
      const operatorsData = await apiCall('/master/operators-dashboard');

      let html = `
        <div class="master-operadores-container">
          <h2>Operadores Credenciados e Recebimentos</h2>
          <p class="subtitle">Visualize todos os operadores da sua carteira e seus valores recebidos</p>
          
          <div class="table-responsive">
            <table class="master-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Meta Mensal</th>
                  <th>Recebimento</th>
                  <th>% da Meta</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
      `;

      let totalRecebimento = 0;
      let operadoresAcimaMeta = 0;

      operatorsData.forEach(op => {
        // Garantir que os valores existem
        const monthlyGoal = op.monthlyGoal || 0;
        const receivedValue = op.receivedValue || 0;
        const operatorId = op.id || 'N/A';
        const operatorName = op.name || 'Operador sem nome';
        
        const metaPercent = monthlyGoal > 0 ? (receivedValue / monthlyGoal) * 100 : 0;
        const status = metaPercent >= 100 ? '✓ Meta Atingida' : '✗ Pendente';
        const statusClass = metaPercent >= 100 ? 'status-ok' : 'status-alert';
        
        if (metaPercent >= 100) operadoresAcimaMeta++;
        totalRecebimento += receivedValue || 0;

        html += `
          <tr>
            <td>${operatorId}</td>
            <td>${operatorName}</td>
            <td>R$ ${formatCurrency(monthlyGoal)}</td>
            <td>R$ ${formatCurrency(receivedValue)}</td>
            <td>${formatPercent(metaPercent)}</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
          
          <div class="summary-cards" style="margin-top: 30px;">
            <div class="card card-info">
              <h3>Total Recebido</h3>
              <div class="big-value">R$ ${formatCurrency(totalRecebimento)}</div>
            </div>
            <div class="card card-success">
              <h3>Acima da Meta</h3>
              <div class="big-value">${operadoresAcimaMeta} / ${operatorsData.length}</div>
            </div>
            <div class="card card-warning">
              <h3>Abaixo da Meta</h3>
              <div class="big-value">${operatorsData.length - operadoresAcimaMeta} / ${operatorsData.length}</div>
            </div>
          </div>
        </div>
      `;

      container.querySelector('.view-content').innerHTML = html;
    } catch (err) {
      console.error('Erro ao carregar operadores:', err);
      container.querySelector('.view-content').innerHTML = `<p class="error">Erro: ${err.message}</p>`;
    }
  };

  // ========== TELA 3: META E BONIFICAÇÃO ==========
  window.loadMasterMeta = async function() {
    const container = document.getElementById('view-master-meta');
    if (!container) return;

    try {
      const summary = await apiCall('/master/wallet-summary');
      const operatorsData = await apiCall('/master/operators-dashboard');

      const html = `
        <div class="master-meta-container">
          <h2>Configuração de Meta e Bonificação</h2>
          
          <!-- SEÇÃO 1: META DA CARTEIRA -->
          <div class="master-section">
            <h3>1️⃣ Configurar Meta da Carteira</h3>
            <p class="section-info">Defina o valor total de meta para sua carteira</p>
            
            <div class="form-group">
              <label for="metaCarteira">Meta da Carteira (R$)</label>
              <input 
                type="number" 
                id="metaCarteira" 
                value="${summary.metaCarteira}" 
                step="0.01" 
                min="0"
                class="form-input"
              />
            </div>
            
            <div class="meta-info">
              <p>Recebimento Atual: <strong>R$ ${formatCurrency(summary.totalRecebimento)}</strong></p>
              <p>Progresso: <strong>${formatPercent(summary.percentualAtingido)}</strong></p>
              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${Math.min(100, summary.percentualAtingido)}%"></div>
                </div>
              </div>
            </div>
            
            <button class="btn-primary" id="btnSaveMetaCarteira">
              💾 Salvar Meta da Carteira
            </button>
          </div>

          <!-- SEÇÃO 2: BONIFICAÇÃO -->
          <div class="master-section">
            <h3>2️⃣ Dividir Bonificação</h3>
            <p class="section-info">Defina um valor de bonificação a ser dividido proporcionalmente entre quem atingiu a meta</p>
            
            <div class="form-group">
              <label for="valorBonificacao">Valor Total de Bonificação (R$)</label>
              <input 
                type="number" 
                id="valorBonificacao" 
                placeholder="0.00" 
                step="0.01" 
                min="0"
                class="form-input"
              />
            </div>
            
            <p class="section-info" style="margin-top: 15px;">
              Operadores que atingiram a meta: <strong id="countAcimaMeta">0</strong>
            </p>
            
            <div class="button-group">
              <button class="btn-secondary" id="btnCalculateBonus">
                📊 Calcular Distribuição Proporcional
              </button>
              <button class="btn-primary" id="btnSaveBonus" style="display: none;">
                💾 Salvar Bonificação
              </button>
            </div>

            <!-- Resultado do Cálculo -->
            <div id="bonusCalculationResult" style="display: none; margin-top: 20px;">
              <h4>📋 Resultado da Distribuição</h4>
              <div id="bonusResultTable"></div>
            </div>
          </div>
        </div>
      `;

      container.querySelector('.view-content').innerHTML = html;

      // Contar operadores acima da meta
      const operadoresAcimaMeta = operatorsData.filter(op => (op.recebimento / op.meta_individual) >= 1).length;
      document.getElementById('countAcimaMeta').textContent = operadoresAcimaMeta;

      // Attach event listeners
      attachMetaEvents(operatorsData, operadoresAcimaMeta);
    } catch (err) {
      console.error('Erro ao carregar meta:', err);
      container.querySelector('.view-content').innerHTML = `<p class="error">Erro: ${err.message}</p>`;
    }
  };

  // ========== EVENT HANDLERS ==========
  function attachMetaEvents(operatorsData, operadoresAcimaMeta) {
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
          btnSaveMetaCarteira.disabled = true;
          btnSaveMetaCarteira.textContent = 'Salvando...';
          
          await apiCall('/master/update-cart-meta', 'POST', { meta_carteira: newMeta });
          alert('✓ Meta da carteira atualizada com sucesso!');
          
          btnSaveMetaCarteira.textContent = '💾 Salvar Meta da Carteira';
          btnSaveMetaCarteira.disabled = false;
          
          window.loadMasterMeta(); // Reload
        } catch (err) {
          alert('✗ Erro: ' + err.message);
          btnSaveMetaCarteira.textContent = '💾 Salvar Meta da Carteira';
          btnSaveMetaCarteira.disabled = false;
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

        if (operadoresAcimaMeta === 0) {
          alert('Nenhum operador atingiu a meta ainda');
          return;
        }

        try {
          btnCalculateBonus.disabled = true;
          btnCalculateBonus.textContent = 'Calculando...';
          
          const result = await apiCall('/master/calculate-bonus-proportional', 'POST', {
            bonus_total: valorBonus
          });

          // Mostrar resultado
          const resultDiv = document.getElementById('bonusCalculationResult');
          let table = `
            <div class="table-responsive">
              <table class="bonus-result-table">
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Operador</th>
                    <th>Recebimento</th>
                    <th>% da Meta</th>
                    <th>Bonificação</th>
                  </tr>
                </thead>
                <tbody>
          `;

          result.bonus_breakdown.forEach(op => {
            // Garantir que os valores existem
            const monthlyGoal = op.monthlyGoal || 0;
            const receivedValue = op.receivedValue || 0;
            const bonus = op.bonus_proporcional || 0;
            const operatorId = op.id || 'N/A';
            const operatorName = op.name || 'Operador sem nome';
            
            const metaPercent = monthlyGoal > 0 ? (receivedValue / monthlyGoal) * 100 : 0;
            table += `
              <tr>
                <td>${operatorId}</td>
                <td>${operatorName}</td>
                <td>R$ ${formatCurrency(receivedValue)}</td>
                <td>${formatPercent(metaPercent)}</td>
                <td><strong>R$ ${formatCurrency(bonus)}</strong></td>
              </tr>
            `;
          });

          table += `
                </tbody>
              </table>
            </div>
          `;

          document.getElementById('bonusResultTable').innerHTML = table;
          resultDiv.style.display = 'block';

          // Mostrar botão de salvar
          const btnSaveBonus = document.getElementById('btnSaveBonus');
          btnSaveBonus.style.display = 'block';

          // Store result for save
          window.lastBonusCalculation = result;

          btnCalculateBonus.disabled = false;
          btnCalculateBonus.textContent = '📊 Calcular Distribuição Proporcional';
        } catch (err) {
          alert('✗ Erro: ' + err.message);
          btnCalculateBonus.disabled = false;
          btnCalculateBonus.textContent = '📊 Calcular Distribuição Proporcional';
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
          btnSaveBonus.disabled = true;
          btnSaveBonus.textContent = 'Salvando...';
          
          await apiCall('/master/save-bonus', 'POST', {
            bonus_values: window.lastBonusCalculation.bonus_breakdown
          });

          alert('✓ Bonificações salvas com sucesso!');

          // Limpar cálculo
          window.lastBonusCalculation = null;
          
          btnSaveBonus.disabled = false;
          btnSaveBonus.textContent = '💾 Salvar Bonificação';
          
          window.loadMasterMeta(); // Reload
        } catch (err) {
          alert('✗ Erro: ' + err.message);
          btnSaveBonus.disabled = false;
          btnSaveBonus.textContent = '💾 Salvar Bonificação';
        }
      });
    }
  }

  // ========== AUTO-LOAD QUANDO TELAS FICAM VISÍVEIS ==========
  window.addEventListener('load', () => {
    const observer = new MutationObserver(() => {
      const masterView = document.getElementById('view-master');
      const masterOpView = document.getElementById('view-master-operadores');
      const masterMetaView = document.getElementById('view-master-meta');

      if (masterView && masterView.classList.contains('active') && !masterView.querySelector('.master-dashboard-container')) {
        loadMasterDashboard();
      }

      if (masterOpView && masterOpView.classList.contains('active') && !masterOpView.querySelector('.master-operadores-container')) {
        loadMasterOperadores();
      }

      if (masterMetaView && masterMetaView.classList.contains('active') && !masterMetaView.querySelector('.master-meta-container')) {
        loadMasterMeta();
      }
    });

    observer.observe(document.body, { attributes: true, subtree: true });
  });
})();
