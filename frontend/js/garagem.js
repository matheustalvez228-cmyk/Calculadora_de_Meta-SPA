/**
 * Garagem Manager
 * Gerencia a exibição e desbloqueio de carros
 */

let garagemData = {
  operatorId: null,
  saldoConcCoins: 0,
  carrosDesbloqueados: [],
  carrosPadrao: [
    { id: 'carro_p1', preco: 50000, imagem: '/assets/carros/Padrões/Carro (1).png' },
    { id: 'carro_p13', preco: 55000, imagem: '/assets/carros/Padrões/Carro (13).png' },
    { id: 'carro_p14', preco: 60000, imagem: '/assets/carros/Padrões/Carro (14).png' },
    { id: 'carro_p17', preco: 65000, imagem: '/assets/carros/Padrões/Carro (17).png' },
    { id: 'carro_p18', preco: 70000, imagem: '/assets/carros/Padrões/Carro (18).png' },
    { id: 'carro_p19', preco: 75000, imagem: '/assets/carros/Padrões/Carro (19).png' },
    { id: 'carro_p20', preco: 80000, imagem: '/assets/carros/Padrões/Carro (20).png' },
    { id: 'carro_p21', preco: 85000, imagem: '/assets/carros/Padrões/Carro (21).png' },
    { id: 'carro_p22', preco: 90000, imagem: '/assets/carros/Padrões/Carro (22).png' },
    { id: 'carro_p23', preco: 95000, imagem: '/assets/carros/Padrões/Carro (23).png' },
    { id: 'carro_p24', preco: 100000, imagem: '/assets/carros/Padrões/Carro (24).png' },
    { id: 'carro_p25', preco: 110000, imagem: '/assets/carros/Padrões/Carro (25).png' },
    { id: 'carro_p26', preco: 120000, imagem: '/assets/carros/Padrões/Carro (26).png' },
    { id: 'carro_p27', preco: 130000, imagem: '/assets/carros/Padrões/Carro (27).png' },
    { id: 'carro_p28', preco: 140000, imagem: '/assets/carros/Padrões/Carro (28).png' }
  ],
  carrosEspeciais: [
    { id: 'carro_e1', preco: 300000, imagem: '/assets/carros/Especiais/Carro (1).png' },
    { id: 'carro_e2', preco: 400000, imagem: '/assets/carros/Especiais/Carro (2).png' },
    { id: 'carro_e3', preco: 500000, imagem: '/assets/carros/Especiais/Carro (3).png' }
  ]
};

/**
 * Carrega dados da garagem
 */
async function loadGaragem() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    garagemData.operatorId = payload.id;

    // Buscar saldo de ConcCoins
    try {
      const resBalance = await fetch(`/api/operator/${encodeURIComponent(garagemData.operatorId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (resBalance.ok) {
        const data = await resBalance.json();
        garagemData.saldoConcCoins = data.user?.concBalance || 0;
      }
    } catch (e) {
      console.warn('Erro ao buscar saldo:', e);
    }

    // Buscar carros desbloqueados
    try {
      // Simular dados de carros desbloqueados (em produção viria do servidor)
      const stored = localStorage.getItem(`carros_desbloqueados:${garagemData.operatorId}`);
      if (stored) {
        garagemData.carrosDesbloqueados = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao carregar carros desbloqueados:', e);
    }

    updateGaragemUI();
  } catch (error) {
    console.error('Erro ao carregar garagem:', error);
  }
}

/**
 * Atualiza a UI da garagem
 */
function updateGaragemUI() {
  console.log('updateGaragemUI called');
  
  // Atualizar saldo
  const balanceEl = document.getElementById('garagemBalance');
  if (balanceEl) {
    balanceEl.textContent = `${garagemData.saldoConcCoins} CC`;
    console.log('Balance updated:', garagemData.saldoConcCoins);
  } else {
    console.warn('garagemBalance element not found');
  }

  // Renderizar carros padrões
  console.log('Rendering carrosPadraos:', garagemData.carrosPadrao.length, 'cars');
  renderCarros('carrosPadraos', garagemData.carrosPadrao);

  // Renderizar carros especiais
  console.log('Rendering carrosEspeciais:', garagemData.carrosEspeciais.length, 'cars');
  renderCarros('carrosEspeciais', garagemData.carrosEspeciais);

  // Inicializar event listeners
  initGaragemEvents();
}

/**
 * Renderiza carros em um container
 */
function renderCarros(containerId, carros) {
  console.log(`renderCarros called with containerId: ${containerId}, carros count: ${carros.length}`);
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with ID "${containerId}" not found!`);
    return;
  }

  console.log(`Container found, rendering ${carros.length} cars`);

  container.innerHTML = carros.map(carro => {
    const desbloqueado = garagemData.carrosDesbloqueados.includes(carro.id);
    const bgOverlay = desbloqueado ? '' : 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)';

    return `
      <div class="carro-card" data-carro-id="${carro.id}" style="cursor: pointer; transition: transform 0.2s; width: 120px; height: 140px;">
        <div style="
          border: 2px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 8px;
        ">
          <!-- Imagem do Carro -->
          <div style="
            position: relative;
            width: 100%;
            flex: 1;
            overflow: hidden;
            background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            margin-bottom: 6px;
          ">
            <img
              src="${carro.imagem}"
              alt="Carro"
              style="max-width: 95%; max-height: 95%; object-fit: contain;"
              onerror="this.style.display='none';"
            />
            ${!desbloqueado ? `<div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: ${bgOverlay};
            "></div>` : ''}
          </div>

          <!-- Preço -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 4px;
            background: #fff9e6;
            border-radius: 4px;
            border: 1px solid #ffe58f;
            font-size: 12px;
          ">
            <img
              src="/assets/ConcCoin.png"
              alt="CC"
              style="width: 14px; height: 14px;"
            />
            <span style="font-weight: 700; color: #333;">
              ${carro.preco.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Inicializa event listeners dos carros
 */
function initGaragemEvents() {
  document.querySelectorAll('.carro-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const carroId = e.currentTarget.getAttribute('data-carro-id');
      const carro = [...garagemData.carrosPadrao, ...garagemData.carrosEspeciais].find(c => c.id === carroId);
      
      if (carro) {
        mostrarModalCarro(carro);
      }
    });

    // Efeito hover
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.querySelector('div').style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.querySelector('div').style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
  });
}

/**
 * Mostra modal com informações do carro
 */
function mostrarModalCarro(carro) {
  const desbloqueado = garagemData.carrosDesbloqueados.includes(carro.id);
  const temSaldo = garagemData.saldoConcCoins >= carro.preco;

  let mensagem = '';
  let botao = '';

  if (desbloqueado) {
    mensagem = `<p style="color: #10b981; font-size: 16px; font-weight: 600;">✓ Este carro já foi desbloqueado!</p>`;
    botao = '<button onclick="this.parentElement.parentElement.style.display=\'none\'" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">Fechar</button>';
  } else {
    if (temSaldo) {
      mensagem = `<p style="color: #333; font-size: 14px;">Você tem ${garagemData.saldoConcCoins} CC. Deseja desbloquear este carro?</p>`;
      botao = `
        <button onclick="desbloquearCarro('${carro.id}', ${carro.preco})" style="background: #0077ff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-right: 8px;">Desbloquear</button>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="background: #ccc; color: #333; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Cancelar</button>
      `;
    } else {
      const faltam = carro.preco - garagemData.saldoConcCoins;
      mensagem = `<p style="color: #ff6b6b; font-size: 14px;">Saldo insuficiente. Faltam ${faltam} CC.</p>`;
      botao = '<button onclick="this.parentElement.parentElement.style.display=\'none\'" style="background: #999; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Fechar</button>';
    }
  }

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    ">
      <img src="${carro.imagem}" alt="Carro" style="max-width: 200px; max-height: 150px; object-fit: contain; margin-bottom: 16px;">
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-bottom: 16px;
        font-size: 20px;
        font-weight: 700;
      ">
        <img src="/assets/ConcCoin.png" alt="CC" style="width: 24px; height: 24px;">
        ${carro.preco}
      </div>
      ${mensagem}
      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: center;">
        ${botao}
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  document.body.appendChild(modal);
}

/**
 * Desbloqueia um carro
 */
function desbloquearCarro(carroId, preco) {
  if (garagemData.saldoConcCoins < preco) {
    alert('Saldo insuficiente!');
    return;
  }

  // Atualizar dados locais
  garagemData.carrosDesbloqueados.push(carroId);
  garagemData.saldoConcCoins -= preco;

  // Salvar no localStorage
  localStorage.setItem(
    `carros_desbloqueados:${garagemData.operatorId}`,
    JSON.stringify(garagemData.carrosDesbloqueados)
  );

  // Fechar modal
  document.querySelectorAll('div').forEach(div => {
    if (div.parentElement === document.body && div.style.position === 'fixed') {
      div.remove();
    }
  });

  // Atualizar UI
  updateGaragemUI();
  showToast(`🎉 Carro desbloqueado com sucesso!`, 'success');
}

// Exportar para uso global
window.loadGaragem = loadGaragem;
window.desbloquearCarro = desbloquearCarro;
