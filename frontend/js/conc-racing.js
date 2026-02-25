/**
 * Conc Racing Manager
 * Gerencia o ranking de operadores BV Rodas na pista de corrida
 */

let concRacingData = {
  operatorId: null,
  operatorName: null,
  operatorPercent: 0,
  allOperators: [],
  topOperators: [],
  loggedOperatorRank: null
};

/**
 * Carrega e processa dados do ranking
 */
async function loadConcRacing() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    concRacingData.operatorId = payload.id;
    concRacingData.operatorName = payload.name;

    console.log('Carregando Conc Racing para operador:', concRacingData.operatorId);

    // Buscar todos os operadores com suas métricas
    const res = await fetch('/api/operator/tabela/todos', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Dados recebidos do servidor:', data);
      
      // Filtrar apenas BV Rodas e calcular percentual
      concRacingData.allOperators = (data.operadores || [])
        .filter(op => op.wallet === 'BV_BOM' || op.wallet === 'BV RODAS' || op.wallet === 'bv_rodas')
        .map(op => ({
          id: op.id,
          name: op.name,
          meta: op.meta,
          valorAtingido: op.valorAtingido,
          percentual: op.percentual
        }))
        .sort((a, b) => b.percentual - a.percentual);

      console.log('Operadores BV RODAS filtrados:', concRacingData.allOperators);

      // Obter top 3
      concRacingData.topOperators = concRacingData.allOperators.slice(0, 3);

      // Encontrar posição do operador logado
      concRacingData.loggedOperatorRank = concRacingData.allOperators.findIndex(
        op => op.id === concRacingData.operatorId
      );

      if (concRacingData.loggedOperatorRank >= 0) {
        concRacingData.operatorPercent = 
          concRacingData.allOperators[concRacingData.loggedOperatorRank].percentual;
      }

      console.log('Top 3:', concRacingData.topOperators);
      console.log('Rank do usuário:', concRacingData.loggedOperatorRank);
    }

    // Carregar a imagem da pista
    carregarPista();

    // Atualizar UI
    updateConcRacingUI();
  } catch (error) {
    console.error('Erro ao carregar conc racing:', error);
  }
}

/**
 * Carrega imagem da pista com fallback para grama
 */
function carregarPista() {
  const pistaContainer = document.querySelector('#view-concracing [style*="flex: 1"] > div:last-child');
  const img = document.getElementById('pistaImage');
  
  if (img) {
    // Definir a imagem da pista
    img.src = '/assets/Pista/Pista_Horizontal.png';
    
    // Adicionar fallback se a imagem não carregar
    img.onerror = () => {
      console.warn('Pista não encontrada, usando grama como fallback');
      
      // Usar grama como background
      if (pistaContainer) {
        pistaContainer.style.backgroundImage = 'url(/assets/Pista/Grama_de_fundo.png)';
        pistaContainer.style.backgroundSize = 'cover';
        pistaContainer.style.backgroundPosition = 'center';
        pistaContainer.style.backgroundRepeat = 'repeat';
      }
      
      img.style.display = 'none';
    };
    
    // Também adicionar grama como background enquanto carrega
    if (pistaContainer) {
      pistaContainer.style.backgroundImage = 'url(/assets/Pista/Grama_de_fundo.png)';
      pistaContainer.style.backgroundSize = 'cover';
      pistaContainer.style.backgroundPosition = 'center';
    }
  }
}

/**
 * Atualiza a interface do ranking
 */
function updateConcRacingUI() {
  const rankingList = document.getElementById('rankingList');
  if (!rankingList) return;

  let html = '';

  // Top 3 operadores
  concRacingData.topOperators.forEach((op, idx) => {
    const medalhas = ['🥇', '🥈', '🥉'];
    const isLoggedUser = op.id === concRacingData.operatorId;
    const bgColor = isLoggedUser ? '#e8f4ff' : '#fafafa';

    html += `
      <div style="background: ${bgColor}; border-radius: 8px; padding: 12px; margin-bottom: 12px; border-left: 4px solid #0077ff;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">${medalhas[idx]}</span>
            <div>
              <div style="font-weight: 600; color: #333; font-size: 14px;">${op.name}</div>
              <div style="font-size: 12px; color: #999;">#${op.id}</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #0077ff; font-size: 18px;">${op.percentual}%</div>
          </div>
        </div>
      </div>
    `;
  });

  // Mostrar operador logado APENAS se não for 1º lugar
  if (concRacingData.loggedOperatorRank > 0) {
    html += `
      <div style="border-top: 1px solid #ddd; margin-top: 16px; padding-top: 16px;">
        <div style="font-size: 12px; color: #999; margin-bottom: 12px; font-weight: 600; text-align: center;">SUA POSIÇÃO</div>
        <div style="background: #fff3cd; border-radius: 8px; padding: 12px; border-left: 4px solid #ffc107;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px;">🎯</span>
              <div>
                <div style="font-weight: 600; color: #333; font-size: 14px;">${concRacingData.operatorName}</div>
                <div style="font-size: 12px; color: #999;">#${concRacingData.operatorId}</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #ff6b35; font-size: 18px;">${concRacingData.operatorPercent}%</div>
              <div style="font-size: 11px; color: #999;">#${concRacingData.loggedOperatorRank + 1}º lugar</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  rankingList.innerHTML = html;
}

/**
 * Recarrega apenas o ranking (sem recarregar tudo)
 */
async function reloadConcRacingRanking() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const res = await fetch('/api/operator/tabela/todos', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Recarregando ranking:', data);
      
      concRacingData.allOperators = (data.operadores || [])
        .filter(op => op.wallet === 'BV_BOM' || op.wallet === 'BV RODAS' || op.wallet === 'bv_rodas')
        .map(op => ({
          id: op.id,
          name: op.name,
          meta: op.meta,
          valorAtingido: op.valorAtingido,
          percentual: op.percentual
        }))
        .sort((a, b) => b.percentual - a.percentual);

      concRacingData.topOperators = concRacingData.allOperators.slice(0, 3);
      concRacingData.loggedOperatorRank = concRacingData.allOperators.findIndex(
        op => op.id === concRacingData.operatorId
      );

      if (concRacingData.loggedOperatorRank >= 0) {
        concRacingData.operatorPercent = 
          concRacingData.allOperators[concRacingData.loggedOperatorRank].percentual;
      }

      console.log('Ranking recarregado:', concRacingData.topOperators);
      updateConcRacingUI();
    }
  } catch (e) {
    console.warn('Erro ao recarregar ranking:', e);
  }
}

// Exportar para uso global
window.loadConcRacing = loadConcRacing;
window.reloadConcRacingRanking = reloadConcRacingRanking;
