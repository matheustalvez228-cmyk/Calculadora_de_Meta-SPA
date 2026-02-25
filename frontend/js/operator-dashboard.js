/**
 * Operator Dashboard Manager
 * Gerencia a exibição e atualização dos dados da área do operador
 */

let operatorData = {
  id: null,
  name: null,
  wallet: null,
  session: null,
  meta: 0,
  recebimento: 0,
  recebimentoData: null
};

/**
 * Carrega os dados do operador do servidor
 */
async function loadOperatorDashboard() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('Não autenticado');
      return;
    }

    // Parse token para obter ID do operador
    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    operatorData.id = payload.id;
    operatorData.name = payload.name;
    operatorData.wallet = payload.wallet;
    operatorData.session = payload.session;

    // Carregar dados do servidor (meta)
    try {
      const res = await fetch(`/api/operator/${encodeURIComponent(operatorData.id)}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        operatorData.meta = data.meta || 0;
      }
    } catch (e) {
      console.warn('Erro ao carregar meta do servidor:', e);
      const stored = localStorage.getItem(`operator_meta:${operatorData.id}`);
      if (stored) {
        operatorData.meta = parseFloat(stored);
      }
    }

    // Carregar dados de recebimento persistidos
    try {
      const resRec = await fetch(`/api/operator/${encodeURIComponent(operatorData.id)}/recebimento`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (resRec.ok) {
        const recData = await resRec.json();
        operatorData.recebimentoData = recData;
        
        // Calcular recebimento total baseado no tipo de carteira
        if (operatorData.session === 'bv_rodas') {
          // BV Rodas: usar rodas_total
          operatorData.recebimento = recData.rodas_total || 0;
        } else if (operatorData.session === 'bv_cartao') {
          // BV Cartões: somar cartoes_cl1 + cartoes_cl2
          operatorData.recebimento = (recData.cartoes_cl1 || 0) + (recData.cartoes_cl2 || 0);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar recebimento do servidor:', e);
      operatorData.recebimento = 0;
    }

    // Atualizar UI
    updateOperatorDashboardUI();
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
  }
}

/**
 * Atualiza a interface do dashboard com os dados carregados
 */
function updateOperatorDashboardUI() {
  // Matrícula
  document.getElementById('operatorMatricula').textContent = operatorData.id || '--';
  document.getElementById('operatorName').textContent = operatorData.name || 'Carregando...';

  // Meta Mensal
  const metaFormatada = formatarMoeda(operatorData.meta);
  document.getElementById('operatorMeta').textContent = metaFormatada;

  // Recebimento Total
  const recFormatado = formatarMoeda(operatorData.recebimento);
  document.getElementById('operatorRecebimento').textContent = recFormatado;

  // Progresso
  const percent = operatorData.meta > 0 ? Math.round((operatorData.recebimento / operatorData.meta) * 100) : 0;
  const percentClamped = Math.min(percent, 100);
  
  document.getElementById('operatorProgressPercent').textContent = `${percent}%`;
  document.getElementById('operatorProgressFill').style.width = `${percentClamped}%`;
}

/**
 * Formata um número como moeda brasileira
 */
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Inicializa os event listeners do dashboard
 */
function initOperatorDashboardEvents() {
  const btnEditarMeta = document.getElementById('btnEditarMeta');
  const btnCancelarMeta = document.getElementById('btnCancelarMeta');
  const btnSalvarMeta = document.getElementById('btnSalvarMeta');
  const modal = document.getElementById('modalEditarMeta');
  const inputNovaMeta = document.getElementById('inputNovaMetaValue');

  if (btnEditarMeta) {
    btnEditarMeta.addEventListener('click', () => {
      inputNovaMeta.value = (operatorData.meta || 0).toString();
      modal.style.display = 'flex';
    });
  }

  if (btnCancelarMeta) {
    btnCancelarMeta.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (btnSalvarMeta) {
    btnSalvarMeta.addEventListener('click', async () => {
      const novaMetaStr = inputNovaMeta.value.trim();
      if (!novaMetaStr) {
        alert('Informe um valor válido');
        return;
      }

      const novaMeta = parseFloat(novaMetaStr);
      if (isNaN(novaMeta) || novaMeta < 0) {
        alert('Valor inválido');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/operator/${encodeURIComponent(operatorData.id)}/meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ meta: novaMeta })
        });

        if (res.ok) {
          operatorData.meta = novaMeta;
          // Salvar no localStorage como backup
          localStorage.setItem(`operator_meta:${operatorData.id}`, novaMeta.toString());
          updateOperatorDashboardUI();
          modal.style.display = 'none';
          showToast('Meta atualizada com sucesso!', 'success');
        } else {
          const err = await res.json();
          alert('Erro: ' + (err.error || 'Falha ao atualizar meta'));
        }
      } catch (error) {
        console.error('Erro ao salvar meta:', error);
        // Salvar localmente mesmo com erro
        operatorData.meta = novaMeta;
        localStorage.setItem(`operator_meta:${operatorData.id}`, novaMeta.toString());
        updateOperatorDashboardUI();
        modal.style.display = 'none';
        showToast('Meta salva localmente (sem conexão com servidor)', 'success');
      }
    });
  }

  // Fechar modal ao clicar fora dele
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

/**
 * Carrega o dashboard quando a view fica ativa
 */
function loadOperator() {
  loadOperatorDashboard();
  initOperatorDashboardEvents();
}

/**
 * Recarrega apenas o recebimento do servidor (sem recarregar tudo)
 */
async function reloadRecebimento() {
  try {
    const token = localStorage.getItem('token');
    if (!token || !operatorData.id) return;

    const resRec = await fetch(`/api/operator/${encodeURIComponent(operatorData.id)}/recebimento`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (resRec.ok) {
      const recData = await resRec.json();
      operatorData.recebimentoData = recData;
      
      // Calcular recebimento total baseado no tipo de carteira
      if (operatorData.session === 'bv_rodas') {
        operatorData.recebimento = recData.rodas_total || 0;
      } else if (operatorData.session === 'bv_cartao') {
        operatorData.recebimento = (recData.cartoes_cl1 || 0) + (recData.cartoes_cl2 || 0);
      }
      
      updateOperatorDashboardUI();
    }
  } catch (e) {
    console.warn('Erro ao recarregar recebimento:', e);
  }
}

// Exportar para uso global
window.loadOperator = loadOperator;
window.loadOperatorDashboard = loadOperatorDashboard;
window.updateOperatorDashboardUI = updateOperatorDashboardUI;
window.reloadRecebimento = reloadRecebimento;
