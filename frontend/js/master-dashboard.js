/**
 * Master Dashboard - Carregamento seguro integrado com SPA
 * Carrega dados quando a view-master ficar visível
 */

(function initMasterDashboard() {
  // Aguarda o DOM estar completamente pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMasterDashboard);
  } else {
    setupMasterDashboard();
  }

  function setupMasterDashboard() {
    // Aguarda um pouco para SPA inicializar
    setTimeout(() => {
      const viewMaster = document.getElementById('view-master');
      if (!viewMaster) return; // View não existe

      // Buscar token
      const token = localStorage.getItem('token');
      if (!token) return; // Sem token

      try {
        // Verificar se é master
        const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
        if (!payload.isMaster) return; // Não é master

        // Carregar dados quando view ficar visível
        const observer = new MutationObserver(() => {
          if (viewMaster.classList.contains('active')) {
            loadMasterData(token, payload);
            observer.disconnect(); // Parar de observar
          }
        });

        observer.observe(viewMaster, { attributes: true });

        // Se já está ativa, carregar direto
        if (viewMaster.classList.contains('active')) {
          loadMasterData(token, payload);
        }
      } catch (e) {
        console.error('Erro ao inicializar dashboard master:', e);
      }
    }, 500);
  }

  async function loadMasterData(token, payload) {
    try {
      const wallet = payload.wallet;
      const walletNameEl = document.getElementById('masterWalletName');
      if (walletNameEl) walletNameEl.textContent = wallet;

      // Carregar dados
      await Promise.all([
        loadWalletSummary(token),
        loadOperators(token),
        loadRisks(token)
      ]);
    } catch (e) {
      console.error('Erro ao carregar dados do master:', e);
    }
  }

  async function loadWalletSummary(token) {
    try {
      const res = await fetch('/api/master/wallet-summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      
      const data = await res.json();
      
      setElementText('totalRecebimento', formatCurrency(data.totalRecebimento));
      setElementText('metaCarteira', formatCurrency(data.metaCarteira));
      
      const percentual = Number(data.percentualAtingido) || 0;
      const percentualEl = document.getElementById('percentualAtingido');
      if (percentualEl) {
        percentualEl.textContent = percentual.toFixed(1) + '%';
        percentualEl.style.color = percentual >= 100 ? '#4CAF50' : percentual >= 80 ? '#ff9800' : '#f44336';
      }
      
      setElementText('operatorCount', data.operatorCount || 0);
    } catch (e) {
      console.error('Erro ao carregar resumo:', e);
    }
  }

  async function loadOperators(token) {
    try {
      const res = await fetch('/api/master/operators-dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      
      const operators = await res.json();
      const tbody = document.getElementById('operatorsTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!Array.isArray(operators) || operators.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Nenhum operador</td></tr>';
        return;
      }

      for (const op of operators) {
        const meta = Number(op.monthlyGoal) || 0;
        const realizado = Number(op.actualValue) || 0;
        const recebimento = Number(op.receivedValue) || 0;
        const percentual = meta > 0 ? ((realizado / meta) * 100) : 0;

        let statusClass = 'ok';
        let statusText = '✓ Ok';
        if (percentual < 80) {
          statusClass = 'warning';
          statusText = '⚠ Abaixo';
        }

        const fillPercent = Math.min(percentual, 100);
        const fillClass = percentual > 100 ? '' : percentual > 80 ? 'warning' : 'danger';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${op.name}</strong><br><small style="color: #999;">${op.id}</small></td>
          <td>${formatCurrency(meta)}</td>
          <td>${formatCurrency(realizado)}</td>
          <td>${formatCurrency(recebimento)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="progress-bar">
                <div class="progress-bar-fill ${fillClass}" style="width: ${fillPercent}%"></div>
              </div>
              <strong>${percentual.toFixed(1)}%</strong>
            </div>
          </td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(row);
      }
    } catch (e) {
      console.error('Erro ao carregar operadores:', e);
    }
  }

  async function loadRisks(token) {
    try {
      const res = await fetch('/api/master/risks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      
      const risks = await res.json();
      const section = document.getElementById('risksSection');
      if (!section) return;

      if (!Array.isArray(risks) || risks.length === 0) {
        section.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">✓ Nenhuma renegociação</p>';
        return;
      }

      let html = '';
      for (const risk of risks) {
        const operadorId = risk.operatorId || 'N/A';
        const premium = Number(risk.riskPremium) || 0;
        const desc = risk.description || 'Sem descrição';

        html += `
          <div class="risk-item">
            <div class="desc">
              <strong>${operadorId}</strong><br>
              <small style="color: #999;">${desc}</small>
            </div>
            <div class="value">${formatCurrency(premium)}</div>
          </div>
        `;
      }
      section.innerHTML = html;
    } catch (e) {
      console.error('Erro ao carregar riscos:', e);
    }
  }

  function formatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
})();
      const bonificacaoValue = Number(bonificacaoInput.value);
      
      if (!bonificacaoValue || bonificacaoValue <= 0) {
        alert('Por favor, insira um valor para a bonificação');
        return;
      }
      
      // Chamar API
      const result = await apiCall('/master/calculate-bonus-proportional', 'POST', { 
        bonificacaoTotal: bonificacaoValue 
      });
      
      bonusDistributionData = result.distribution;
      
      // Montar tabela de preview
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
        alert('Atenção: Nenhum operador bateu a meta ainda.');
      } else {
        alert(`Cálculo realizado para ${result.operadoresBeneficiados} operadores`);
      }
      
    } catch (err) {
      alert('Erro ao calcular distribuição: ' + err.message);
    }
  }
  
  async function salvarBonificacoes() {
    try {
      if (!bonusDistributionData) {
        alert('Por favor, calcule a divisão proporcional primeiro');
        return;
      }
      
      const bonificacaoInput = document.getElementById('inputBonificacao');
      const bonificacaoValue = Number(bonificacaoInput.value);
      
      // Chamar API para salvar
      const result = await apiCall('/master/save-bonus', 'POST', {
        bonificacaoTotal: bonificacaoValue,
        distribution: bonusDistributionData
      });
      
      alert('✓ Bonificações salvas com sucesso!\n\n' + result.message);
      
      // Notificar operadores (WebSocket ou Polling)
      notificarOperadores(result.operatorsUpdated);
      
      // Limpar e recarregar
      bonusDistributionData = null;
      document.getElementById('inputBonificacao').value = '0';
      document.getElementById('bonusPreviewContainer').style.display = 'none';
      document.getElementById('btnSalvarBonificacao').style.display = 'none';
      
      // Recarregar dados
      await Promise.all([loadDashboardRecebimento(), loadAreaMaster()]);
      
    } catch (err) {
      alert('Erro ao salvar bonificações: ' + err.message);
    }
  }
  
  function notificarOperadores(operatorsUpdated) {
    // Simular notificação via polling para os operadores
    // Em produção, usar WebSocket seria melhor
    
    // Mostrar popup local
    const popup = document.createElement('div');
    popup.className = 'bonus-notification-popup';
    popup.innerHTML = `
      <div class="popup-content">
        <h3>✓ Bonificações Atualizadas</h3>
        <p>As bonificações foram atualizadas para ${operatorsUpdated.length} operador(es):</p>
        <ul>
          ${operatorsUpdated.map(op => `
            <li>${op.name}: R$ ${formatCurrency(op.bonusAtualizado)}</li>
          `).join('')}
        </ul>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">
          Os operadores receberão uma notificação em suas telas.
        </p>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 300);
    }, 5000);
  }
  
  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================
  
  // Verificar se estamos na view-master
  function initMasterUI() {
    const masterContent = document.getElementById('masterContent');
    if (!masterContent) return;
    
    // Criar HTML das duas abas
    const html = `
      <div class="master-tabs">
        <div class="tabs-header">
          <button id="tabDashboard" class="tab-button active" data-tab="dashboard">
            📊 Dashboard de Recebimento
          </button>
          <button id="tabAreaMaster" class="tab-button" data-tab="area-master">
            ⚙️ Área Master
          </button>
        </div>
        
        <div class="tabs-content">
          <div id="masterDashboardRecebimento" class="tab-content active" data-tab="dashboard">
            <p>Carregando...</p>
          </div>
          <div id="masterAreaMaster" class="tab-content" data-tab="area-master">
            <p>Carregando...</p>
          </div>
        </div>
      </div>
    `;
    
    masterContent.innerHTML = html;
    
    // Event listeners para abas
    document.getElementById('tabDashboard')?.addEventListener('click', function() {
      switchTab('dashboard');
      loadDashboardRecebimento();
    });
    
    document.getElementById('tabAreaMaster')?.addEventListener('click', function() {
      switchTab('area-master');
      loadAreaMaster();
    });
    
    function switchTab(tabName) {
      // Remover active de todos
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      // Adicionar active ao selecionado
      document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
      document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
    }
    
    // Carregar primeira aba
    loadDashboardRecebimento();
  }
  
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMasterUI);
  } else {
    initMasterUI();
  }
  
})();
