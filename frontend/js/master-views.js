/**
 * Master Views Loader - Carrega conteúdo das abas de Master
 * - Operadores e Recebimentos
 * - Meta & Bonificação
 */

(function initMasterViews() {
  // Aguarda o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMasterViews);
  } else {
    setupMasterViews();
  }

  function setupMasterViews() {
    setTimeout(() => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
        if (!payload.isMaster) return;

        // Observar vista-master-operadores
        observeViewAndLoad('view-master-operadores', () => loadOperadoresView(token, payload));
        
        // Observar vista-master-meta
        observeViewAndLoad('view-master-meta', () => loadMetaView(token, payload));
      } catch (e) {
        console.error('Erro ao inicializar master views:', e);
      }
    }, 500);
  }

  function observeViewAndLoad(viewId, callback) {
    const view = document.getElementById(viewId);
    if (!view) return;

    // Se já está ativa, carregar direto
    if (view.classList.contains('active')) {
      callback();
      return;
    }

    // Observar para mudanças
    const observer = new MutationObserver(() => {
      if (view.classList.contains('active')) {
        callback();
        observer.disconnect();
      }
    });

    observer.observe(view, { attributes: true });
  }

  async function loadOperadoresView(token, payload) {
    try {
      const container = document.getElementById('masterOperadoresContent');
      if (!container) return;

      container.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">Carregando operadores...</p>';

      // Buscar dados
      const [summaryRes, opsRes, risksRes] = await Promise.all([
        fetch('/api/master/wallet-summary', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/master/operators-dashboard', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/master/risks', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!summaryRes.ok || !opsRes.ok) throw new Error('Erro ao buscar dados');

      const summary = await summaryRes.json();
      const operators = await opsRes.json();
      const risks = await risksRes.json();

      // Montar HTML
      let html = `
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 30px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
          <h2 style="margin-top: 0;">Resumo da Carteira</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
              <div style="color: #666; font-size: 12px; margin-bottom: 5px;">Total Recebido</div>
              <div style="font-size: 24px; font-weight: bold; color: #0077ff;">${formatCurrency(summary.totalRecebimento)}</div>
            </div>
            <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
              <div style="color: #666; font-size: 12px; margin-bottom: 5px;">Meta da Carteira</div>
              <div style="font-size: 24px; font-weight: bold; color: #0077ff;">${formatCurrency(summary.metaCarteira)}</div>
            </div>
            <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
              <div style="color: #666; font-size: 12px; margin-bottom: 5px;">% Atingido</div>
              <div style="font-size: 24px; font-weight: bold; color: ${Number(summary.percentualAtingido) >= 100 ? '#4CAF50' : '#f44336'};">${summary.percentualAtingido.toFixed(1)}%</div>
            </div>
            <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
              <div style="color: #666; font-size: 12px; margin-bottom: 5px;">Operadores Ativos</div>
              <div style="font-size: 24px; font-weight: bold; color: #0077ff;">${operators.length}</div>
            </div>
          </div>
        </div>

        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1); margin-bottom: 30px;">
          <div style="padding: 20px; background: #f5f5f5; border-bottom: 1px solid #eee;">
            <h2 style="margin: 0;">Detalhes dos Operadores</h2>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9f9f9;">
                <th style="padding: 15px; text-align: left; font-weight: 600; border-bottom: 1px solid #eee;">Operador</th>
                <th style="padding: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #eee;">Meta Individual</th>
                <th style="padding: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #eee;">Realizado</th>
                <th style="padding: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #eee;">Recebimento</th>
                <th style="padding: 15px; text-align: center; font-weight: 600; border-bottom: 1px solid #eee;">% Meta</th>
                <th style="padding: 15px; text-align: center; font-weight: 600; border-bottom: 1px solid #eee;">Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (!Array.isArray(operators) || operators.length === 0) {
        html += '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">Nenhum operador cadastrado</td></tr>';
      } else {
        for (const op of operators) {
          const meta = Number(op.monthlyGoal) || 0;
          const realizado = Number(op.actualValue) || 0;
          const recebimento = Number(op.receivedValue) || 0;
          const percentual = meta > 0 ? ((realizado / meta) * 100) : 0;
          const statusText = percentual >= 100 ? '✓ Atingiu' : percentual >= 80 ? '⚠ Próximo' : '❌ Abaixo';
          const statusColor = percentual >= 100 ? '#4CAF50' : percentual >= 80 ? '#ff9800' : '#f44336';

          html += `
            <tr style="border-bottom: 1px solid #eee; hover: background #fafafa;">
              <td style="padding: 15px;"><strong>${op.name}</strong><br><small style="color: #999;">${op.id}</small></td>
              <td style="padding: 15px; text-align: right;">${formatCurrency(meta)}</td>
              <td style="padding: 15px; text-align: right;">${formatCurrency(realizado)}</td>
              <td style="padding: 15px; text-align: right;">${formatCurrency(recebimento)}</td>
              <td style="padding: 15px; text-align: center; font-weight: 600;">${percentual.toFixed(1)}%</td>
              <td style="padding: 15px; text-align: center;"><span style="background: ${statusColor}33; color: ${statusColor}; padding: 6px 12px; border-radius: 12px; font-weight: 600; font-size: 12px;">${statusText}</span></td>
            </tr>
          `;
        }
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      // Seção de renegociações
      html += `
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
          <h2 style="margin-top: 0;">Renegociações em Aberto</h2>
      `;

      if (!Array.isArray(risks) || risks.length === 0) {
        html += '<p style="color: #999; text-align: center;">✓ Nenhuma renegociação em aberto</p>';
      } else {
        html += `<div style="display: grid; gap: 10px;">`;
        for (const risk of risks) {
          const premium = Number(risk.riskPremium) || 0;
          html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fafafa; border-radius: 8px; border-left: 3px solid #f44336;">
              <div>
                <strong>${risk.operatorId}</strong><br>
                <small style="color: #999;">${risk.description}</small>
              </div>
              <div style="color: #f44336; font-weight: bold; font-size: 16px;">${formatCurrency(premium)}</div>
            </div>
          `;
        }
        html += `</div>`;
      }

      html += `</div>`;

      container.innerHTML = html;
    } catch (e) {
      console.error('Erro ao carregar operadores:', e);
      const container = document.getElementById('masterOperadoresContent');
      if (container) {
        container.innerHTML = `<div style="padding: 20px; color: #f44336; text-align: center;">❌ Erro ao carregar operadores: ${e.message}</div>`;
      }
    }
  }

  async function loadMetaView(token, payload) {
    try {
      const container = document.getElementById('masterMetaContent');
      if (!container) return;

      container.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">Carregando configurações...</p>';

      // Buscar dados
      const summaryRes = await fetch('/api/master/wallet-summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!summaryRes.ok) throw new Error('Erro ao buscar dados');

      const summary = await summaryRes.json();
      const opsRes = await fetch('/api/master/operators-dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const operators = await opsRes.json();

      // Montar HTML
      let html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          
          <!-- Esquerda: Configuração de Meta -->
          <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0;">Configuração de Meta da Carteira</h2>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Meta Atual</label>
              <div style="font-size: 28px; font-weight: bold; color: #0077ff; padding: 12px; background: #f5f5f5; border-radius: 8px;">${formatCurrency(summary.metaCarteira)}</div>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Nova Meta (R$)</label>
              <input type="number" id="masterMetaInput" value="${summary.metaCarteira}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;" />
            </div>

            <button onclick="salvarMetaMaster(this)" style="width: 100%; padding: 12px; background: #0077ff; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              ✓ Salvar Nova Meta
            </button>

            <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 3px solid #0077ff;">
              <div style="color: #0077ff; font-weight: 600; margin-bottom: 5px;">ℹ️ Informação</div>
              <div style="color: #555; font-size: 13px;">A meta da carteira é o objetivo total que todos os operadores devem atingir. Esta é usada para calcular o percentual de atingimento.</div>
            </div>
          </div>

          <!-- Direita: Bonificação -->
          <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0;">Distribuição de Bonificação</h2>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Valor Total a Distribuir (R$)</label>
              <input type="number" id="bonusTotalInput" value="0" placeholder="0,00" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;" />
            </div>

            <button onclick="calcularDistribuicaoBonus()" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-bottom: 15px; transition: all 0.2s;">
              🧮 Calcular Distribuição
            </button>

            <div id="bonusPreviewContainer" style="display: none; margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
              <h3 style="margin-top: 0;">Prévia de Distribuição Proporcional</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #e0e0e0;">
                    <th style="padding: 8px; text-align: left;">Operador</th>
                    <th style="padding: 8px; text-align: right;">% Meta</th>
                    <th style="padding: 8px; text-align: right;">Bônus</th>
                  </tr>
                </thead>
                <tbody id="bonusPreviewBody" style="background: white;"></tbody>
              </table>
              
              <button onclick="salvarDistribuicaoBonus()" style="width: 100%; margin-top: 15px; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                💾 Salvar Distribuição
              </button>
            </div>

            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 3px solid #ff9800;">
              <div style="color: #ff9800; font-weight: 600; margin-bottom: 5px;">⚠️ Aviso</div>
              <div style="color: #555; font-size: 13px;">A bonificação será distribuída proporcionalmente entre os operadores que atingiram a meta.</div>
            </div>
          </div>

        </div>

        <!-- Tabela de Operadores para Distribuição -->
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
          <h2>Operadores - Base para Cálculo</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9f9f9;">
                <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #eee;">Operador</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; border-bottom: 1px solid #eee;">Meta Individual</th>
                <th style="padding: 12px; text-align: right; font-weight: 600; border-bottom: 1px solid #eee;">Realizado</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; border-bottom: 1px solid #eee;">% da Meta</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; border-bottom: 1px solid #eee;">Elegível</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (!Array.isArray(operators) || operators.length === 0) {
        html += '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">Nenhum operador</td></tr>';
      } else {
        for (const op of operators) {
          const meta = Number(op.monthlyGoal) || 0;
          const realizado = Number(op.actualValue) || 0;
          const percentual = meta > 0 ? ((realizado / meta) * 100) : 0;
          const elegivel = percentual >= 100 ? '✓ Sim' : '❌ Não';
          const elegivelColor = percentual >= 100 ? '#4CAF50' : '#999';

          html += `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px;"><strong>${op.name}</strong></td>
              <td style="padding: 12px; text-align: right;">${formatCurrency(meta)}</td>
              <td style="padding: 12px; text-align: right;">${formatCurrency(realizado)}</td>
              <td style="padding: 12px; text-align: center; font-weight: 600;">${percentual.toFixed(1)}%</td>
              <td style="padding: 12px; text-align: center; color: ${elegivelColor}; font-weight: 600;">${elegivel}</td>
            </tr>
          `;
        }
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      container.innerHTML = html;
    } catch (e) {
      console.error('Erro ao carregar meta:', e);
      const container = document.getElementById('masterMetaContent');
      if (container) {
        container.innerHTML = `<div style="padding: 20px; color: #f44336; text-align: center;">❌ Erro ao carregar: ${e.message}</div>`;
      }
    }
  }

  // Funções globais para botões
  window.salvarMetaMaster = async function(btn) {
    const input = document.getElementById('masterMetaInput');
    const newMeta = Number(input.value);

    if (!newMeta || newMeta <= 0) {
      alert('Por favor, insira um valor válido para a meta');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = '⏳ Salvando...';

      const token = localStorage.getItem('token');
      const res = await fetch('/api/master/update-cart-meta', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metaCarteira: newMeta })
      });

      if (!res.ok) throw new Error('Erro ao salvar meta');

      alert('✓ Meta salva com sucesso!');
      btn.textContent = '✓ Salvar Nova Meta';
      btn.disabled = false;
    } catch (e) {
      alert('Erro: ' + e.message);
      btn.textContent = '✓ Salvar Nova Meta';
      btn.disabled = false;
    }
  };

  window.calcularDistribuicaoBonus = async function() {
    try {
      const bonusTotal = Number(document.getElementById('bonusTotalInput').value);
      if (!bonusTotal || bonusTotal <= 0) {
        alert('Por favor, insira um valor válido para o bônus');
        return;
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/master/operators-dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Erro ao buscar operadores');

      const operators = await res.json();
      let totalPercentual = 0;
      const elegveis = operators.filter(op => {
        const meta = Number(op.monthlyGoal) || 0;
        const realizado = Number(op.actualValue) || 0;
        const percentual = meta > 0 ? ((realizado / meta) * 100) : 0;
        if (percentual >= 100) {
          totalPercentual += percentual;
          return true;
        }
        return false;
      });

      if (elegveis.length === 0) {
        alert('Nenhum operador atingiu 100% da meta ainda');
        return;
      }

      // Montar preview
      let previewHtml = '';
      let totalBonus = 0;

      for (const op of elegveis) {
        const meta = Number(op.monthlyGoal) || 0;
        const realizado = Number(op.actualValue) || 0;
        const percentual = meta > 0 ? ((realizado / meta) * 100) : 0;
        const peso = percentual / totalPercentual;
        const bonusOp = bonusTotal * peso;
        totalBonus += bonusOp;

        previewHtml += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px;">${op.name}</td>
            <td style="padding: 8px; text-align: right;">${percentual.toFixed(1)}%</td>
            <td style="padding: 8px; text-align: right; font-weight: 600; color: #4CAF50;">${formatCurrency(bonusOp)}</td>
          </tr>
        `;
      }

      document.getElementById('bonusPreviewBody').innerHTML = previewHtml;
      document.getElementById('bonusPreviewContainer').style.display = 'block';

      // Guardar dados para salvar depois
      window.bonusDistributionData = {
        total: bonusTotal,
        elegveis: elegveis.map(op => ({
          id: op.id,
          name: op.name,
          percentual: ((Number(op.actualValue) / (Number(op.monthlyGoal) || 1)) * 100),
          bonus: bonusTotal * ((Number(op.actualValue) / (Number(op.monthlyGoal) || 1)) / totalPercentual)
        }))
      };

      alert(`✓ Cálculo realizado para ${elegveis.length} operador(es)\nTotal a distribuir: ${formatCurrency(totalBonus)}`);
    } catch (e) {
      alert('Erro ao calcular: ' + e.message);
    }
  };

  window.salvarDistribuicaoBonus = async function() {
    if (!window.bonusDistributionData) {
      alert('Calcule a distribuição primeiro');
      return;
    }

    try {
      alert(`✓ Distribuição salva com sucesso!\n\nTotal: ${formatCurrency(window.bonusDistributionData.total)}\nOperadores: ${window.bonusDistributionData.elegveis.length}`);
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  function formatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
})();
