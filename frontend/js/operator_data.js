/**
 * Operador Data Loader
 * Carrega dados do operador quando necessário
 */

(function() {
  'use strict';

  // Formata número para moeda brasileira
  function formatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Função principal de carregamento
  async function loadData() {
    try {
      const token = localStorage.getItem("token");
      const id = localStorage.getItem("user_id") || localStorage.getItem("userId");

      if (!token || !id) {
        console.warn('[operator_data.js] Token ou ID não encontrado');
        return;
      }

      // Esperar elemento estar disponível
      const dadosElement = document.getElementById("dados");
      if (!dadosElement) {
        console.warn('[operator_data.js] Elemento #dados não encontrado no DOM');
        return;
      }

      const res = await fetch(`/api/operator/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        console.error('[operator_data.js] Erro na resposta:', err);
        alert('Erro ao obter dados: ' + (err.error || JSON.stringify(err)));
        if (res.status === 401) {
          window.location.href = 'login.html';
        }
        return;
      }

      const data = await res.json();
      let out = '';

      if (data.user) {
        const u = data.user;
        const e = data.entry || {};
        const renegs = (data.risks || []);
        const realFaturamento = Number(e.realFaturamento || 0);
        const baseValue = Number(e.baseValue || 0);
        const riskValue = Number(e.riskValue || 0);
        const totalValue = Number(e.receivedValue || 0);
        const percentualAtingido = Number(e.percentualAtingido || 0);
        const monthlyGoal = Number(e.monthlyGoal || 0);

        out = `
          <p><strong>ID:</strong> ${u.id}</p>
          <p><strong>Carteira:</strong> ${u.wallet || u.carteira || ''}</p>
          <p><strong>Meta Mensal:</strong> R$ ${formatCurrency(monthlyGoal)}</p>
          <p><strong>Faturamento Realizado:</strong> R$ ${formatCurrency(realFaturamento)}</p>
          <p><strong>% da Meta Atingida:</strong> ${percentualAtingido.toFixed(2)}%</p>
          <hr style="margin: 15px 0;">
          <p style="font-size: 1.2em;"><strong>VALOR TOTAL A SER RECEBIDO: R$ ${formatCurrency(totalValue)}</strong></p>
          <ul style="margin-left: 20px; margin-top: 5px;">
            <li><strong>Valor Base (Rateio proporcional):</strong> R$ ${formatCurrency(baseValue)}</li>
            <li><strong>Valor Renegociações:</strong> R$ ${formatCurrency(riskValue)}</li>
          </ul>
          <p><strong>Renegociações Realizadas:</strong> ${renegs.length}</p>
        `;

        if (renegs.length > 0) {
          out += '<ul style="margin-left: 20px;">';
          renegs.forEach((r, idx) => {
            out += `<li>Renegociação ${idx + 1}: R$ ${formatCurrency(Number(r.riskPremium))}</li>`;
          });
          out += '</ul>';
        }
      } else {
        out = `
          <p><strong>ID:</strong> ${data.id}</p>
          <p><strong>Carteira:</strong> ${data.carteira || data.wallet}</p>
          <p><strong>Meta Mensal:</strong> R$ ${formatCurrency(data.meta || data.monthlyGoal || 0)}</p>
          <p><strong>Valor Recebido:</strong> R$ ${formatCurrency(data.recebido || data.receivedValue || 0)}</p>
          <p><strong>Renegociações:</strong> ${data.renegs || ''}</p>
        `;
      }

      // Atualizar DOM com segurança
      const element = document.getElementById("dados");
      if (element) {
        element.innerHTML = out;
      }
    } catch (err) {
      console.error('[operator_data.js] Erro ao carregar dados:', err);
    }
  }

  // Executar quando DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Pequeno delay para garantir que todos elementos estão prontos
      setTimeout(loadData, 100);
    });
  } else {
    // Documento já carregado
    setTimeout(loadData, 100);
  }

  // Expor função globalmente para debug
  window.loadOperatorDataNow = loadData;

})();
