const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));

function run(sql, params=[]) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { if(err) rej(err); else res(this); }));
}
function get(sql, params=[]) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => { if(err) rej(err); else res(row); }));
}
function all(sql, params=[]) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => { if(err) rej(err); else res(rows); }));
}

// GET /api/wallets/:wallet
router.get('/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const w = await get('SELECT wallet, bonificacao, taxa FROM wallets WHERE wallet=?', [wallet]);
    if(!w) return res.status(404).json({ error: 'Carteira não encontrada' });
    
    // get allocations from allocations table (if populated)
    const allocs = await all('SELECT operatorId, percent FROM allocations WHERE wallet=?', [wallet]);
    const allocations = {};
    allocs.forEach(a => { allocations[a.operatorId] = a.percent; });
    
    res.json({ wallet: w.wallet, bonificacao: w.bonificacao, taxa: w.taxa, allocations });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/wallets/:wallet -> save settings and auto-update operators
router.post('/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const { bonificacao, taxa, allocations } = req.body;
    
    // update wallet settings
    await run('UPDATE wallets SET bonificacao=?, taxa=? WHERE wallet=?', [bonificacao || 0, taxa || 0, wallet]);
    
    // clear old allocations for this wallet
    await run('DELETE FROM allocations WHERE wallet=?', [wallet]);
    
    // calculate total bonus to distribute = bonificacao * taxa%
    const B = (Number(bonificacao) || 0) * ((Number(taxa) || 0) / 100);
    
    // STEP 1: collect all operator data and calculate weights
    const operatorDataMap = {};
    let totalWeight = 0;
    
    if(allocations && typeof allocations === 'object') {
      for(const operatorId in allocations) {
        const alocacaoPct = allocations[operatorId];
        if(alocacaoPct > 0) {
          await run('INSERT INTO allocations(wallet, operatorId, percent) VALUES (?, ?, ?)', [wallet, operatorId, alocacaoPct]);
          
          // get last entry for this operator
          const entry = await get(
            'SELECT id, monthlyGoal, actualValue FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
            [operatorId]
          );
          
          if(entry) {
            const monthlyGoal = Number(entry.monthlyGoal) || 0;
            const realFaturamento = Number(entry.actualValue) || 0;
            const percentualAtingido = monthlyGoal > 0 ? (realFaturamento / monthlyGoal) * 100 : 0;
            
            // Calculate weight: max(0, Mi - 100) where Mi is percentualAtingido
            // Only operators with >= 100% get weight > 0
            const weight = Math.max(0, percentualAtingido - 100);
            
            operatorDataMap[operatorId] = {
              entryId: entry.id,
              monthlyGoal,
              realFaturamento,
              percentualAtingido,
              weight
            };
            
            totalWeight += weight;
          }
        }
      }
    }
    
    // STEP 2: distribute bonus proportionally by weight (meritocracy)
    for(const operatorId in operatorDataMap) {
      const opData = operatorDataMap[operatorId];
      
      // get risk premiums for this operator
      const risksResult = await get('SELECT SUM(riskPremium) as totalRisks FROM risks WHERE entryId=?', [opData.entryId]);
      const riskValue = (risksResult && risksResult.totalRisks) ? Number(risksResult.totalRisks) : 0;
      
      // calculate operator's bonus share based on their weight
      // Bonificação_i = B * (Peso_i / Σ Pesos)
      let baseValue = 0;
      if(totalWeight > 0 && opData.weight > 0) {
        baseValue = B * (opData.weight / totalWeight);
      }
      
      // final receivedValue = baseValue (bonus) + riskValue
      const newReceivedValue = baseValue + riskValue;
      
      console.log(`[WALLETS] Op ${operatorId}: percentual=${opData.percentualAtingido}%, weight=${opData.weight}, totalWeight=${totalWeight}, B=${B}, baseValue=${baseValue}, riskValue=${riskValue}, total=${newReceivedValue}`);
      
      await run('UPDATE entries SET receivedValue=? WHERE id=?', [newReceivedValue, opData.entryId]);
    }
    
    const w = await get('SELECT wallet, bonificacao, taxa FROM wallets WHERE wallet=?', [wallet]);
    const allocs = await all('SELECT operatorId, percent FROM allocations WHERE wallet=?', [wallet]);
    const allocsOut = {};
    allocs.forEach(a => { allocsOut[a.operatorId] = a.percent; });
    
    res.json({ ok: true, wallet: w.wallet, bonificacao: w.bonificacao, taxa: w.taxa, allocations: allocsOut, bonusTotal: B });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
