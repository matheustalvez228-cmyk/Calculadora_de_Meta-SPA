const apiBase = '';

// Formata número para moeda brasileira: 3000000 -> 3.000.000,00
function formatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Inicialização otimizada do operador
 * Lazy loading: espera o DOM estar completamente pronto
 */
function initOperatorLazy() {
  const token = localStorage.getItem('token');
  if(!token) { location.href='/login.html'; return; }
  
  // NÃO fazer requisições imediatamente
  // Apenas preparar os listeners
  const logoutBtn = document.getElementById('btnOpLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', ()=>{ 
      localStorage.removeItem('token'); 
      localStorage.removeItem('user_id'); 
      location.href='/login.html'; 
    });
  }

  // Carregar dados do operador APENAS quando view fica visível
  const operatorView = document.getElementById('view-operator');
  if (operatorView) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.hasAttribute('data-operator-loaded')) {
          loadOperatorData();
          entry.target.setAttribute('data-operator-loaded', 'true');
          observer.unobserve(entry.target);
        }
      });
    });
    observer.observe(operatorView);
  }
}

/**
 * Carregar dados do operador sob demanda
 */
async function loadOperatorData() {
  try {
    const token = localStorage.getItem('token');
    const storedUser = JSON.parse(atob(token.split('.')[1] || '{}'));
    const uid = storedUser.id;
    const wallet = storedUser.wallet || '';
    
    // Atualizar wallet
    const walletEl = document.getElementById('opWallet');
    if (walletEl) walletEl.value = wallet;
    
    // Carregar dados do operador
    const res = await fetch('/api/operator/'+uid, { 
      headers: { 'Authorization': 'Bearer '+token } 
    });
    
    if(res.ok) { 
      const data = await res.json();
      
      // Atualizar UI
      if (data.user) {
        if (document.getElementById('operatorMatricula')) {
          document.getElementById('operatorMatricula').textContent = data.user.id;
        }
        if (document.getElementById('operatorName')) {
          document.getElementById('operatorName').textContent = data.user.name;
        }
        if (document.getElementById('opConcBalance')) {
          document.getElementById('opConcBalance').value = data.user.concBalance || 0;
        }
      }
      
      if (data.entry) {
        // Atualizar meta
        if (document.getElementById('operatorMeta')) {
          document.getElementById('operatorMeta').textContent = 'R$ ' + formatCurrency(data.entry.monthlyGoal || 0);
        }
        
        // Atualizar recebimento
        if (document.getElementById('operatorRecebimento')) {
          document.getElementById('operatorRecebimento').textContent = 'R$ ' + formatCurrency(data.entry.receivedValue || 0);
        }
        
        // Atualizar % progress
        const monthlyGoal = Number(data.entry.monthlyGoal) || 0;
        const actualValue = Number(data.entry.actualValue) || 0;
        const percentual = monthlyGoal > 0 ? (actualValue / monthlyGoal) * 100 : 0;
        
        if (document.getElementById('operatorProgressPercent')) {
          document.getElementById('operatorProgressPercent').textContent = percentual.toFixed(2) + '%';
        }
        
        if (document.getElementById('operatorProgressFill')) {
          document.getElementById('operatorProgressFill').style.width = Math.min(100, percentual) + '%';
        }
      }
    }
  } catch(e) { 
    console.warn('Erro ao carregar dados do operador:', e); 
  }
}

// Inicializar quando DOM estiver completamente pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOperatorLazy);
} else {
  initOperatorLazy();
}

        if(serverEntries && serverEntries.length>0){
          serverEntries.slice(0,10).forEach(ent => {
            const div = document.createElement('div'); div.className='item';
            const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:800">R$ ${formatCurrency(ent.actualValue||0)}</div><div style="font-size:12px;color:#555">Meta R$ ${formatCurrency(ent.monthlyGoal||0)}</div>`;
            const right = document.createElement('div'); right.innerHTML = new Date(ent.timestamp||0).toLocaleString();
            div.appendChild(left); div.appendChild(right); receiptsContainer.appendChild(div);
          });
        } else {
          // fallback local receipts
          const list = getReceiptsForWallet(wallet || 'anonymous');
          if(!list || list.length===0){ receiptsContainer.innerHTML = '<div class="muted">Nenhum recebimento salvo ainda.</div>'; return; }
          list.slice(0,10).forEach(ent => {
            const div = document.createElement('div'); div.className='item';
            const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:800">R$ ${formatCurrency(ent.valor_recebido||0)} <span style="font-size:11px;color:#777;margin-left:8px">(local)</span></div><div style="font-size:12px;color:#555">Meta R$ ${formatCurrency(ent.monthlyGoal||ent.meta_mensal||0)}</div>`;
            const right = document.createElement('div'); right.innerHTML = new Date(ent._ts||0).toLocaleString();
            div.appendChild(left); div.appendChild(right); receiptsContainer.appendChild(div);
          });
        }
      }
      renderReceipts();
      // expose for future updates
      window.__renderReceipts = renderReceipts;
    }
  }catch(e){console.warn(e)}

})();

function generateRiskInputsFor(n, container){
  container.innerHTML='';
  n = parseInt(n)||0;
  const options = [{label:'Até R$ 10.000',value:15},{label:'20.001 a 40.000',value:15},{label:'40.001 a 60.000',value:15},{label:'60.001 a 80.000',value:20},{label:'80.001 a 100.000',value:20},{label:'Acima de 100.000',value:30}];
  for(let i=0;i<n;i++){
    const div = document.createElement('div'); div.className='form-group';
    const label = document.createElement('label'); label.textContent = 'Risco da Renegociação '+(i+1)+':';
    const sel = document.createElement('select'); sel.id = 'risk_new_'+i; sel.innerHTML = '<option disabled selected>Selecione</option>'+options.map(o=>`<option value="${o.value}">${o.label}</option>`).join('');
    div.appendChild(label); div.appendChild(sel); container.appendChild(div);
  }
}

function viewMyData() {
    window.location.href = "operator_data.html";
}
