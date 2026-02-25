(async function initMaster(){
  // Formata número para moeda brasileira: 3000000 -> 3.000.000,00
  function formatCurrency(value) {
      const num = Number(value) || 0;
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const token = localStorage.getItem('token');
  if(!token){ location.href='/login.html'; return; }
  const payload = JSON.parse(atob(token.split('.')[1]||'{}'));
  document.getElementById('masterWallet').value = payload.wallet || '';
  
  async function safeParseResponse(res){
    const ct = (res.headers.get && res.headers.get('content-type')) || '';
    if(ct.includes('application/json')){
      try { return await res.json(); } catch(e){ return { __parseError: e.message } }
    }
    try { const t = await res.text(); return { __text: t }; } catch(e){ return { __parseError: e.message } }
  }
  
  document.getElementById('btnMasterLogout').addEventListener('click', ()=>{ localStorage.removeItem('token'); location.href='/login.html'; });
  document.getElementById('btnVisualizarTabela').addEventListener('click', ()=>{ location.href='/operadores_tabela.html'; });
  // load operators list
  async function load(){
    const res = await fetch('/api/operators?wallet='+payload.wallet, {headers:{'Authorization':'Bearer '+token}});
    const data = await res.json();
    const list = document.getElementById('masterOperatorsList'); list.innerHTML='';
    const sel = document.getElementById('masterSelection'); sel.innerHTML='';
    
    // Fetch detailed data for each operator to get meta % achieved
    for(const u of data) {
      // Fetch operator details to get percentual atingido
      const opRes = await fetch(`/api/operator/${u.id}`, {headers:{'Authorization':'Bearer '+token}});
      const opData = await opRes.json();
      const percentualAtingido = (opData.entry && opData.entry.percentualAtingido) ? Number(opData.entry.percentualAtingido).toFixed(2) : '0.00';
      
      const it = document.createElement('div'); 
      it.className='item'; 
      it.innerHTML = `<div>${u.name} (${u.id})</div><div class="small">Operador - Meta atingida: <strong>${percentualAtingido}%</strong></div>`; 
      list.appendChild(it);
      
      const selIt = document.createElement('div'); 
      selIt.className='item'; 
      selIt.innerHTML = `<input type="checkbox" data-id="${u.id}"><div>${u.name} (${u.id}) - <strong>${percentualAtingido}%</strong></div><input type="number" data-id="${u.id}" value="0" style="width:80px">`; 
      sel.appendChild(selIt);
    }
  }
  await load();
  document.getElementById('btnSaveWalletSettings').addEventListener('click', async ()=>{
    try {
      const bonif = parseFloat(document.getElementById('masterBonificacao').value)||0;
      const taxa = parseFloat(document.getElementById('masterTax').value)||0;
      const selItems = Array.from(document.querySelectorAll('#masterSelection .item'));
      const allocations = {};
      selItems.forEach(it=>{ const id = it.querySelector('input[type="checkbox"]').dataset.id; const pct = parseFloat(it.querySelector('input[type="number"]').value)||0; if(pct>0) allocations[id]=pct; });
      
      const btn = document.getElementById('btnSaveWalletSettings');
      const originalText = btn.textContent;
      btn.textContent = 'Salvando...';
      btn.disabled = true;
      
      const res = await fetch('/api/wallets/'+payload.wallet,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({bonificacao:bonif,taxa,allocations})});
      const data = await safeParseResponse(res);
      
      btn.textContent = originalText;
      btn.disabled = false;
      
      if(res.ok) {
        alert('Configurações salvas e operadores atualizados!');
        await load(); // reload to show any changes
      } else {
        alert('Erro: '+(data.error || data.__text || data.__parseError || JSON.stringify(data)));
      }
    } catch(e) {
      alert('Erro: '+e.message);
      document.getElementById('btnSaveWalletSettings').disabled = false;
      document.getElementById('btnSaveWalletSettings').textContent = 'Salvar';
    }
  });
  document.getElementById('btnAutoSplit').addEventListener('click', ()=>{
    const checks = Array.from(document.querySelectorAll('#masterSelection input[type="checkbox"]')).filter(c=>c.checked);
    if(checks.length===0) return alert('Marque ao menos 1'); 
    const pct = Math.floor((100/checks.length)*100)/100; 
    checks.forEach(c=>{ 
      const id=c.dataset.id; 
      const inp = document.querySelector(`#masterSelection input[type="number"][data-id="${id}"]`); 
      if(inp) inp.value=pct; 
    });
  });

  // Divisão Proporcional: distribui baseado na % de meta ultrapassada
  document.getElementById('btnProportionalSplit').addEventListener('click', async ()=>{
    const checks = Array.from(document.querySelectorAll('#masterSelection input[type="checkbox"]')).filter(c=>c.checked);
    if(checks.length===0) return alert('Marque ao menos 1');
    
    // Fetch data for each checked operator to get their percentual atingido
    const operatorData = [];
    for(const check of checks) {
      const id = check.dataset.id;
      try {
        const opRes = await fetch(`/api/operator/${id}`, {headers:{'Authorization':'Bearer '+token}});
        const opData = await opRes.json();
        const percentualAtingido = (opData.entry && opData.entry.percentualAtingido) ? Number(opData.entry.percentualAtingido) : 0;
        
        // Peso = max(0, percentual - 100) -> só conta o que passou de 100%
        const weight = Math.max(0, percentualAtingido - 100);
        operatorData.push({ id, percentualAtingido, weight });
      } catch(e) {
        console.error('Erro ao buscar dados do operador', id, e);
      }
    }
    
    // Calcular total de pesos
    const totalWeight = operatorData.reduce((sum, op) => sum + op.weight, 0);
    
    if(totalWeight === 0) {
      return alert('Nenhum operador ultrapassou 100% de meta!');
    }
    
    // Distribuir proporcionalmente: cada um recebe (seu peso / peso total) * 100
    operatorData.forEach(op => {
      const allocPct = (op.weight / totalWeight) * 100;
      const inp = document.querySelector(`#masterSelection input[type="number"][data-id="${op.id}"]`);
      if(inp) inp.value = parseFloat(allocPct.toFixed(2));
    });
  });

  document.getElementById('btnComputeShare').addEventListener('click', async ()=>{
    // just compute preview from wallet settings stored
    const res = await fetch('/api/wallets/'+payload.wallet,{headers:{'Authorization':'Bearer '+token}});
    const data = await res.json();
    const totalGanho = (parseFloat(data.bonificacao)||0) * ((parseFloat(data.taxa)||0)/100);
    const shareList = document.getElementById('masterResult');
    let out = `<p><strong>Total ganho:</strong> R$ ${formatCurrency(totalGanho)}</p><ul>`;
    Object.keys(data.allocations||{}).forEach(id=>{ const pct = data.allocations[id]; const s = totalGanho*(pct/100); out+=`<li>${id}: ${pct}% → R$ ${formatCurrency(s)}</li>`; });
    out += '</ul>';
    shareList.innerHTML = out;
  });
})();