/**
 * Recebimento Dashboard Manager
 * Gerencia campos de recebimento cadastrais (persistentes no banco de dados)
 */

let recebimentoData = {
  operatorId: null,
  session: null, // 'bv_rodas' ou 'bv_cartao'
  // BV Rodas
  rodas_total: 0,
  rodas_entregas: 0,
  rodas_reneg: 0,
  // BV Cartões
  cartoes_cl1: 0,
  cartoes_cl2: 0,
  cartoes_propostas: [],
  // Bonificação
  bonificacao_receber: 0
};

let currentEditField = null;

/**
 * Carrega os dados de recebimento do servidor
 */
async function loadRecebimentoDashboard() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    recebimentoData.operatorId = payload.id;
    recebimentoData.session = payload.session;

    // Buscar dados do servidor
    const res = await fetch(`/api/operator/${encodeURIComponent(recebimentoData.operatorId)}/recebimento`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      recebimentoData = { ...recebimentoData, ...data };
    }

    updateRecebimentoUI();
  } catch (error) {
    console.error('Erro ao carregar recebimento:', error);
  }
}

/**
 * Formata número como moeda
 */
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Atualiza a interface com os dados carregados
 */
function updateRecebimentoUI() {
  if (recebimentoData.session === 'bv_rodas') {
    updateBVRodasUI();
  } else if (recebimentoData.session === 'bv_cartao') {
    updateBVCartoesUI();
  }
}

/**
 * Atualiza interface BV Rodas
 */
function updateBVRodasUI() {
  document.getElementById('recebimento-rodas-section').style.display = 'block';
  document.getElementById('recebimento-cartoes-section').style.display = 'none';

  // Valor Total
  document.getElementById('rec-rodas-total').textContent = formatarMoeda(recebimentoData.rodas_total);

  // Entregas Amigáveis
  const entregasValor = recebimentoData.rodas_entregas * 100;
  document.getElementById('rec-rodas-entregas').textContent = recebimentoData.rodas_entregas;
  document.getElementById('rec-rodas-entregas-valor').textContent = `= ${formatarMoeda(entregasValor)}`;

  // Renegociação e Bônus
  const bonus = calcularBonusRenegociacao(recebimentoData.rodas_reneg);
  document.getElementById('rec-rodas-reneg').textContent = formatarMoeda(recebimentoData.rodas_reneg);
  document.getElementById('rec-rodas-reneg-bonus').textContent = `Bônus: ${formatarMoeda(bonus)}`;
  
  // Bonificação do Master (Previsão)
  const bonificacaoReceber = Number(recebimentoData.bonificacao_receber || 0);
  const bonificacaoElement = document.getElementById('rec-rodas-bonificacao');
  if (bonificacaoElement) {
    bonificacaoElement.textContent = formatarMoeda(bonificacaoReceber);
  }
}

/**
 * Atualiza interface BV Cartões
 */
function updateBVCartoesUI() {
  document.getElementById('recebimento-rodas-section').style.display = 'none';
  document.getElementById('recebimento-cartoes-section').style.display = 'block';

  // CL1 e CL2
  document.getElementById('rec-cartoes-cl1').textContent = formatarMoeda(recebimentoData.cartoes_cl1);
  document.getElementById('rec-cartoes-cl2').textContent = formatarMoeda(recebimentoData.cartoes_cl2);

  // Propostas
  updatePropostasLista();
}

/**
 * Calcula bônus de renegociação
 */
function calcularBonusRenegociacao(valor) {
  if (valor < 60000) return valor > 0 ? 20 : 0;
  return 30;
}

/**
 * Atualiza lista de propostas
 */
function updatePropostasLista() {
  const container = document.getElementById('rec-cartoes-propostas-list');
  
  if (!recebimentoData.cartoes_propostas || recebimentoData.cartoes_propostas.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Nenhuma proposta pendente</div>';
    return;
  }

  container.innerHTML = recebimentoData.cartoes_propostas.map((prop, idx) => `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 600; color: #333;">${formatarMoeda(prop.valor)}</div>
        <div style="font-size: 12px; color: #999;">${prop.descricao || 'Sem descrição'}</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button data-remove-proposta="${idx}" style="background: #ff6b6b; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;">✕ Remover</button>
        <button data-confirm-proposta="${idx}" style="background: #10b981; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;">✓ Confirmar</button>
      </div>
    </div>
  `).join('');

  // Adicionar listeners
  document.querySelectorAll('[data-remove-proposta]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-remove-proposta'));
      recebimentoData.cartoes_propostas.splice(idx, 1);
      saveRecebimentoAndServer();
      updatePropostasLista();
    });
  });

  document.querySelectorAll('[data-confirm-proposta]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-confirm-proposta'));
      const proposta = recebimentoData.cartoes_propostas[idx];
      // Adicionar ao CL1 ou CL2
      recebimentoData.cartoes_cl1 += proposta.valor;
      recebimentoData.cartoes_propostas.splice(idx, 1);
      saveRecebimentoAndServer();
      updatePropostasLista();
      updateBVCartoesUI();
      showToast(`Proposta confirmada e adicionada a CL1`, 'success');
    });
  });
}

/**
 * Inicializa event listeners
 */
function initRecebimentoEvents() {
  const modal = document.getElementById('modalRecebimento');
  const modalReneg = document.getElementById('modalRenegociacao');
  const modalProposta = document.getElementById('modalProposta');

  // Botões de editar/adicionar
  document.querySelectorAll('[data-edit], [data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const field = e.target.getAttribute('data-edit') || e.target.getAttribute('data-add');
      const isAdd = !!e.target.getAttribute('data-add');
      
      if (field === 'rodas_reneg') {
        openModalRenegociacao();
      } else if (field === 'cartoes_propostas') {
        openModalProposta();
      } else {
        openModalRecebimento(field, isAdd);
      }
    });
  });

  // Modal Recebimento
  document.getElementById('btnCancelarRecebimento').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('btnSalvarRecebimento').addEventListener('click', async () => {
    const valor = parseFloat(document.getElementById('inputRecebimentoValue').value);
    if (isNaN(valor) || valor < 0) {
      alert('Valor inválido');
      return;
    }

    if (currentEditField === 'rodas_entregas') {
      recebimentoData[currentEditField] = Math.round(valor);
    } else if (document.getElementById('inputRecebimentoValue').getAttribute('data-is-add') === 'true') {
      // Modo ADICIONAR: somar ao valor existente
      recebimentoData[currentEditField] += valor;
    } else {
      // Modo EDITAR: substituir valor
      recebimentoData[currentEditField] = valor;
    }

    await saveRecebimentoAndServer();
    updateRecebimentoUI();
    modal.style.display = 'none';
  });

  // Modal Renegociação
  document.getElementById('btnCancelarReneg').addEventListener('click', () => {
    modalReneg.style.display = 'none';
  });

  document.getElementById('inputRenegValue').addEventListener('input', (e) => {
    const valor = parseFloat(e.target.value) || 0;
    const bonus = calcularBonusRenegociacao(valor);
    document.getElementById('renegBonusInfo').textContent = `Bônus estimado: ${formatarMoeda(bonus)}`;
  });

  document.getElementById('btnSalvarReneg').addEventListener('click', async () => {
    const valor = parseFloat(document.getElementById('inputRenegValue').value);
    if (isNaN(valor) || valor < 0) {
      alert('Valor inválido');
      return;
    }

    recebimentoData.rodas_reneg = valor;
    await saveRecebimentoAndServer();
    updateRecebimentoUI();
    modalReneg.style.display = 'none';
  });

  // Modal Proposta
  document.getElementById('btnCancelarProposta').addEventListener('click', () => {
    modalProposta.style.display = 'none';
  });

  document.getElementById('btnSalvarProposta').addEventListener('click', async () => {
    const valor = parseFloat(document.getElementById('inputPropostaValue').value);
    const desc = document.getElementById('inputPropostaDesc').value.trim();

    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido');
      return;
    }

    recebimentoData.cartoes_propostas.push({
      valor: valor,
      descricao: desc || 'Proposta bancária',
      data: new Date().toISOString()
    });

    await saveRecebimentoAndServer();
    updateRecebimentoUI();
    modalProposta.style.display = 'none';
  });

  // Fechar modais ao clicar fora
  [modal, modalReneg, modalProposta].forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.style.display = 'none';
    });
  });
}

function openModalRecebimento(field, isAdd) {
  const modal = document.getElementById('modalRecebimento');
  const title = document.getElementById('modalRecebimentoTitle');
  const label = document.getElementById('modalRecebimentoLabel');
  const input = document.getElementById('inputRecebimentoValue');

  const fieldNames = {
    'rodas_total': 'Valor Total Atingido',
    'rodas_entregas': 'Entregas Amigáveis Realizadas',
    'cartoes_cl1': 'Valor Atingido CL1',
    'cartoes_cl2': 'Valor Atingido CL2'
  };

  currentEditField = field;
  title.textContent = isAdd ? `Adicionar a ${fieldNames[field]}` : `Editar ${fieldNames[field]}`;
  label.textContent = `${isAdd ? 'Valor a adicionar' : 'Novo valor'} (R$)`;
  input.value = '';
  input.setAttribute('data-is-add', isAdd.toString());
  input.focus();
  modal.style.display = 'flex';
}

function openModalRenegociacao() {
  const modal = document.getElementById('modalRenegociacao');
  const input = document.getElementById('inputRenegValue');
  input.value = recebimentoData.rodas_reneg;
  const bonus = calcularBonusRenegociacao(recebimentoData.rodas_reneg);
  document.getElementById('renegBonusInfo').textContent = `Bônus estimado: ${formatarMoeda(bonus)}`;
  input.focus();
  modal.style.display = 'flex';
}

function openModalProposta() {
  const modal = document.getElementById('modalProposta');
  document.getElementById('inputPropostaValue').value = '';
  document.getElementById('inputPropostaDesc').value = '';
  document.getElementById('inputPropostaValue').focus();
  modal.style.display = 'flex';
}

/**
 * Salva recebimento no servidor
 */
async function saveRecebimentoAndServer() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/operator/${encodeURIComponent(recebimentoData.operatorId)}/recebimento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(recebimentoData)
    });

    if (!res.ok) {
      console.warn('Erro ao salvar no servidor');
    } else {
      // Recarregar o recebimento na tela do operador
      if (window.reloadRecebimento) {
        window.reloadRecebimento();
      }
    }
  } catch (e) {
    console.warn('Erro ao conectar ao servidor:', e);
  }
}

/**
 * Carrega o recebimento
 */
function loadRecebimento() {
  loadRecebimentoDashboard();
  initRecebimentoEvents();
}

// Exportar para uso global
window.loadRecebimento = loadRecebimento;
window.loadRecebimentoDashboard = loadRecebimentoDashboard;
