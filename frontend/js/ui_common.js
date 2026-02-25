/* UI common helpers: toast and localStorage receipts */
function showToast(message, type = 'success', duration = 2800) {
  let el = document.getElementById('globalToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalToast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show ' + (type === 'success' ? 'success' : '');
  clearTimeout(el.__hideTimeout);
  el.__hideTimeout = setTimeout(() => {
    el.className = 'toast';
  }, duration);
}

function saveReceiptForWallet(wallet, entry) {
  if (!wallet) wallet = 'anonymous';
  const key = 'recebimentos:' + wallet;
  const raw = localStorage.getItem(key);
  const arr = raw ? JSON.parse(raw) : [];
  entry._ts = Date.now();
  arr.unshift(entry);
  localStorage.setItem(key, JSON.stringify(arr));
  return arr;
}

function getReceiptsForWallet(wallet) {
  if (!wallet) wallet = 'anonymous';
  const key = 'recebimentos:' + wallet;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function setActiveTouchbarLink() {
  try{
    const links = document.querySelectorAll('.touchbar a');
    const href = location.pathname.split('/').pop();
    links.forEach(a => { a.classList.toggle('active', a.getAttribute('href') === ('/' + href) || a.getAttribute('href') === href); });
  }catch(e){}
}

// init highlight on DOM ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', setActiveTouchbarLink);
}

/* Garage helpers */
function _getWalletFromToken(){ try{ const t = localStorage.getItem('token'); if(!t) return null; const p = JSON.parse(atob(t.split('.')[1]||'{}')); return p.wallet || p.carteira || null; }catch(e){return null} }
function getUnlockedCarsForWallet(wallet){ if(!wallet) wallet = _getWalletFromToken() || 'anonymous'; const key = 'garage:unlocked:'+wallet; const raw = localStorage.getItem(key); return raw?JSON.parse(raw):[]; }
function unlockCarForWallet(wallet, carPath){ if(!wallet) wallet = _getWalletFromToken() || 'anonymous'; const key = 'garage:unlocked:'+wallet; const arr = getUnlockedCarsForWallet(wallet); if(!arr.includes(carPath)) arr.push(carPath); localStorage.setItem(key, JSON.stringify(arr)); return arr; }
function isCarUnlockedForWallet(wallet, carPath){ const arr = getUnlockedCarsForWallet(wallet); return arr.includes(carPath); }
function getSelectedCarLocal(operatorId){ if(!operatorId) return null; return localStorage.getItem('selectedCar:'+operatorId) || null; }

async function getSelectedCarForOperator(operatorId){ if(!operatorId) return null; // prefer local storage (fast) but keep remote as source of truth if available
  const local = getSelectedCarLocal(operatorId);
  try{
    const token = localStorage.getItem('token');
    if(token) {
      const res = await fetch('/api/conc/' + encodeURIComponent(operatorId) + '/profile', { headers: { Authorization: 'Bearer ' + token } });
      if(res.ok){ const j = await res.json(); if(j.selectedCar) { localStorage.setItem('selectedCar:'+operatorId, j.selectedCar); return j.selectedCar; } }
    }
  }catch(e){}
  return local;
}

async function setSelectedCarForOperator(operatorId, carPath){ if(!operatorId) return null; // try server first
  try{
    const token = localStorage.getItem('token');
    if(token){
      const res = await fetch('/api/conc/' + encodeURIComponent(operatorId) + '/select', {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ carPath })
      });
      if(res.ok){ const j = await res.json(); localStorage.setItem('selectedCar:'+operatorId, j.selectedCar || carPath); return j.selectedCar || carPath; }
    }
  }catch(e){ console.warn('select car remote failed', e); }
  // fallback local
  localStorage.setItem('selectedCar:'+operatorId, carPath); return carPath; }
