/**
 * Master Dashboard System
 * Carrega e exibe dados do dashboard para usuários masters
 */

(async function initMasterDashboard() {
  const token = localStorage.getItem('token');
  if (!token) {
    location.href = '/index.html';
    return;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    if (!payload.isMaster) {
      location.href = '/index.html';
      return;
    }

    const wallet = payload.wallet;
    document.getElementById('masterWalletName').textContent = wallet;

    // Função para formatar valores em moeda
    function formatCurrency(value) {
      const num = Number(value) || 0;
      return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    }

    // Função para formatar números simples
    function formatNumber(value) {
      const num = Number(value) || 0;
      return num.toLocaleString('pt-BR');
    }

    // Buscar resumo da carteira
    async function loadWalletSummary() {
      try {
        const res = await fetch('/api/master/wallet-summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        document.getElementById('totalRecebimento').textContent = formatCurrency(data.totalRecebimento);
        document.getElementById('metaCarteira').textContent = formatCurrency(data.metaCarteira);
        
        const percentual = Number(data.percentualAtingido) || 0;
        const percentualEl = document.getElementById('percentualAtingido');
        percentualEl.textContent = percentual.toFixed(1) + '%';
        
        // Mudar cor baseado na performance
        if (percentual >= 100) {
          percentualEl.style.color = '#4CAF50'; // Verde
        } else if (percentual >= 80) {
          percentualEl.style.color = '#ff9800'; // Laranja
        } else {
          percentualEl.style.color = '#f44336'; // Vermelho
        }

        document.getElementById('operatorCount').textContent = data.operatorCount || 0;
      } catch (e) {
        console.error('Erro ao carregar resumo:', e);
      }
    }

    // Buscar operadores e performance
    async function loadOperators() {
      try {
        const res = await fetch(`/api/master/operators-dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const operators = await res.json();

        const tbody = document.getElementById('operatorsTableBody');
        tbody.innerHTML = '';

        if (!Array.isArray(operators) || operators.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Nenhum operador encontrado</td></tr>';
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

          const row = document.createElement('tr');
          row.innerHTML = `
            <td><strong>${op.name}</strong><br><small style="color: #999;">${op.id}</small></td>
            <td>${formatCurrency(meta)}</td>
            <td>${formatCurrency(realizado)}</td>
            <td>${formatCurrency(recebimento)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="progress-bar">
                  <div class="progress-bar-fill ${percentual > 100 ? '' : percentual > 80 ? 'warning' : 'danger'}" 
                       style="width: ${Math.min(percentual, 100)}%"></div>
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
        document.getElementById('operatorsTableBody').innerHTML = 
          '<tr><td colspan="6" style="text-align: center; color: #f44336; padding: 20px;">Erro ao carregar dados</td></tr>';
      }
    }

    // Buscar renegociações/riscos
    async function loadRisks() {
      try {
        const res = await fetch(`/api/master/risks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const risks = await res.json();

        const section = document.getElementById('risksSection');

        if (!Array.isArray(risks) || risks.length === 0) {
          section.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">✓ Nenhuma renegociação pendente</p>';
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
              <div class="value">Ref: ${formatCurrency(premium)}</div>
            </div>
          `;
        }
        section.innerHTML = html;
      } catch (e) {
        console.error('Erro ao carregar riscos:', e);
        document.getElementById('risksSection').innerHTML = 
          '<p style="color: #f44336; text-align: center; padding: 20px;">Erro ao carregar renegociações</p>';
      }
    }

    // Carregar todos os dados
    await loadWalletSummary();
    await loadOperators();
    await loadRisks();

  } catch (e) {
    console.error('Erro geral:', e);
  }
})();
