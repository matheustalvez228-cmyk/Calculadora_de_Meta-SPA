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

// Helper: recalculate receivedValue for an operator based on wallet settings
const { calculateReceivedForCard } = require('../utils/bv_calculos');

async function recalculateReceivedValue(operatorId, entryId) {
  try {
    // get operator's user info to find wallet
    const user = await get('SELECT wallet FROM users WHERE id=?', [operatorId]);
    if(!user) return;

    const wallet = user.wallet;

    // get wallet settings
    const walletSettings = await get('SELECT bonificacao, taxa, session_type FROM wallets WHERE wallet=?', [wallet]);
    if(!walletSettings) return;

    // BV CARTÃO specialized logic
    if (walletSettings.session_type === 'bv_cartao') {
      // For BV_CARTAO: each operator's latest entry determines receivedValue based on dias_atraso, acordo and boleto_value
      const operators = await all(`
        SELECT DISTINCT u.id FROM users u 
        WHERE u.wallet=? AND u.isMaster=0
      `, [wallet]);

      for(const op of operators) {
        const entry = await get(
          'SELECT id, monthlyGoal, actualValue, dias_atraso, acordo, acordo_performance, boleto_value FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
          [op.id]
        );
        if(!entry) continue;

        const newReceivedValue = calculateReceivedForCard(entry);
        await run('UPDATE entries SET receivedValue=? WHERE id=?', [newReceivedValue, entry.id]);

        // Award ConcCoins similarly to other wallets (uses actualValue; risks will typically be zero for BV_CARTAO)
        try {
          const COIN_DIVISOR = 1000;
          const COIN_PER_RENEG = 2;

          // BV_CARTAO: no renegociações — do not count risks
          const numReneg = 0;

          const rawAward = Math.floor((Number(entry.actualValue) || 0) / COIN_DIVISOR) + (numReneg * COIN_PER_RENEG);
          const award = Math.max(0, rawAward);

          const entryRow = await get('SELECT conc_awarded FROM entries WHERE id=?', [entry.id]);
          const already = entryRow ? Number(entryRow.conc_awarded || 0) : 0;
          const delta = award - already;
          if(delta > 0) {
            const existing = await get('SELECT balance FROM conc_wallets WHERE operatorId=?', [op.id]);
            if(existing) {
              await run('UPDATE conc_wallets SET balance=? WHERE operatorId=?', [Number(existing.balance) + delta, op.id]);
            } else {
              await run('INSERT INTO conc_wallets(operatorId,balance) VALUES(?,?)', [op.id, delta]);
            }
            await run('UPDATE entries SET conc_awarded=? WHERE id=?', [award, entry.id]);
          }
        } catch(e) { console.error('[CONC AWARD ERROR BV_CARTAO]', e); }
      }

      return; // done for BV_CARTAO
    }

    // Default BV RODAS logic
    // calculate total bonus pool
    const B = (Number(walletSettings.bonificacao) || 0) * ((Number(walletSettings.taxa) || 0) / 100);

    // get all operators in this wallet with their latest entries
    const operators = await all(`
      SELECT DISTINCT u.id FROM users u 
      WHERE u.wallet=? AND u.isMaster=0
    `, [wallet]);

    // collect all operators' data and calculate total weight
    let totalWeight = 0;
    const operatorDataMap = {};

    for(const op of operators) {
      const entry = await get(
        'SELECT id, monthlyGoal, actualValue FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
        [op.id]
      );
      if(entry) {
        const monthlyGoal = Number(entry.monthlyGoal) || 0;
        const actualValue = Number(entry.actualValue) || 0;
        const percentualAtingido = monthlyGoal > 0 ? (actualValue / monthlyGoal) * 100 : 0;
        const weight = Math.max(0, percentualAtingido - 100);

        operatorDataMap[op.id] = {
          entryId: entry.id,
          weight,
          actualValue,
          monthlyGoal,
          percentualAtingido
        };

        totalWeight += weight;
      }
    }

    // now recalculate receivedValue for all operators
    for(const opId in operatorDataMap) {
      const opData = operatorDataMap[opId];

      // get risks for this operator
      const risksResult = await get('SELECT SUM(riskPremium) as totalRisks FROM risks WHERE entryId=?', [opData.entryId]);
      const riskValue = (risksResult && risksResult.totalRisks) ? Number(risksResult.totalRisks) : 0;

      // calculate base value
      let baseValue = 0;
      if(totalWeight > 0 && opData.weight > 0) {
        baseValue = B * (opData.weight / totalWeight);
      }

      const newReceivedValue = baseValue + riskValue;

      console.log(`[RECALC] Op ${opId}: pct=${opData.percentualAtingido.toFixed(2)}%, weight=${opData.weight.toFixed(2)}, baseValue=${baseValue.toFixed(2)}, risks=${riskValue}, total=${newReceivedValue.toFixed(2)}`);

      await run('UPDATE entries SET receivedValue=? WHERE id=?', [newReceivedValue, opData.entryId]);

      // Award ConcCoins based on actualValue and number of renegotiations (idempotent):
      try {
        // Configurable parameters: 1 ConcCoin per COIN_DIVISOR currency units, plus COIN_PER_RENEG per renegotiation
        const COIN_DIVISOR = 1000; // 1 CC per 1000 units of faturamento
        const COIN_PER_RENEG = 2; // 2 CC per renegotiation

        // count renegotiations for this entry (number of risk rows)
        const renegCountRow = await get('SELECT COUNT(*) as cnt FROM risks WHERE entryId=?', [opData.entryId]);
        const numReneg = (renegCountRow && renegCountRow.cnt) ? Number(renegCountRow.cnt) : 0;

        const rawAward = Math.floor((Number(opData.actualValue) || 0) / COIN_DIVISOR) + (numReneg * COIN_PER_RENEG);
        const award = Math.max(0, rawAward);

        // ensure we don't award more than once: use entries.conc_awarded to track what has been awarded for this entry
        const entryRow = await get('SELECT conc_awarded FROM entries WHERE id=?', [opData.entryId]);
        const already = entryRow ? Number(entryRow.conc_awarded || 0) : 0;
        const delta = award - already;
        if(delta > 0) {
          const existing = await get('SELECT balance FROM conc_wallets WHERE operatorId=?', [opId]);
          if(existing) {
            await run('UPDATE conc_wallets SET balance=? WHERE operatorId=?', [Number(existing.balance) + delta, opId]);
          } else {
            await run('INSERT INTO conc_wallets(operatorId,balance) VALUES(?,?)', [opId, delta]);
          }
          // persist awarded amount for this entry
          await run('UPDATE entries SET conc_awarded=? WHERE id=?', [award, opData.entryId]);
          console.log(`[CONC AWARD] Op ${opId} awarded ${delta} ConcCoins (total for entry ${award})`);
        }
      } catch(e) { console.error('[CONC AWARD ERROR]', e); }
    }
  } catch(err) {
    console.error('[RECALC ERROR]', err);
  }
}

// GET /api/operators/:id/entries -> list recent entries for operator
router.get('/:id/entries', async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await all('SELECT id, monthlyGoal, actualValue, receivedValue, dias_atraso, acordo, acordo_performance, boleto_value, conc_awarded, timestamp FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 50', [id]);
    // attach risks per entry
    for(const r of rows){ r.risks = await all('SELECT id, riskPremium FROM risks WHERE entryId=?', [r.id]); }
    res.json({ ok:true, entries: rows });
  } catch(err) { console.error(err); res.status(500).json({ error:'Erro interno' }); }
});

// POST /api/operators/:id/entries  -> create new entry
router.post('/:id/entries', async (req, res) => {
  try {
    const id = req.params.id;
    const { monthlyGoal, receivedValue, risks, dias_atraso, acordo, acordo_performance, boleto_value } = req.body;
    const now = new Date().toLocaleString();
    // Store receivedValue as actualValue (what operator reports as faturamento)
    const r = await run('INSERT INTO entries(operatorId,monthlyGoal,actualValue,receivedValue,dias_atraso,acordo,acordo_performance,boleto_value,timestamp) VALUES (?,?,?,?,?,?,?,?,?)', [id, monthlyGoal || 0, receivedValue || 0, 0, dias_atraso || 0, acordo ? 1 : 0, acordo_performance || 0, boleto_value || 0, now]);
    const entryId = r.lastID;
    // Only insert risks if this wallet/session allows renegociações (not BV_CARTAO)
    const userRow = await get('SELECT wallet FROM users WHERE id=?', [id]);
    const walletRow = userRow ? await get('SELECT session_type FROM wallets WHERE wallet=?', [userRow.wallet]) : null;
    // consider BV_CARTAO either by explicit session_type or by wallet name BV_CARTAO
    const isBVCard = (userRow && userRow.wallet && String(userRow.wallet).toUpperCase().includes('CARTAO')) || (walletRow && walletRow.session_type === 'bv_cartao');

    console.log(`[DEBUG POST] id=${id}, wallet=${userRow && userRow.wallet}, isBVCard=${isBVCard}, risks=${JSON.stringify(risks)}`);

    if(!isBVCard && Array.isArray(risks) && risks.length>0) {
      const stmt = db.prepare('INSERT INTO risks(entryId,riskPremium) VALUES (?,?)');
      for(const rr of risks) {
        console.log('[INFO INSERT] inserting risk for entry', entryId, rr);
        stmt.run(entryId, Number(rr));
      }
      stmt.finalize();
    } else if (isBVCard && Array.isArray(risks) && risks.length>0) {
      console.log('[INFO] Skipping insertion of risks for BV_CARTAO entry', entryId);
    }

    // Defensive cleanup: ensure no risks remain for BV_CARTAO entries
    if (isBVCard) {
      try {
        await run('DELETE FROM risks WHERE entryId=?', [entryId]);
        console.log('[INFO] Ensured no risks for BV_CARTAO entry', entryId);
      } catch(e) { console.error('[CLEANUP ERROR] Could not delete risks for BV_CARTAO', e); }
    }
    // Recalculate receivedValue for all operators in wallet
    await recalculateReceivedValue(id, entryId);
    
    const entry = await get('SELECT id, monthlyGoal, actualValue, receivedValue, dias_atraso, acordo, acordo_performance, boleto_value, timestamp FROM entries WHERE id=?', [entryId]);
    const allRisks = await all('SELECT id, riskPremium FROM risks WHERE entryId=?', [entryId]);
    res.json({ ok: true, entry, risks: allRisks });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/operators?wallet=WALLET -> list users for a wallet
router.get('/', async (req, res) => {
  try {
    const wallet = req.query.wallet;
    if(!wallet) return res.status(400).json({ error: 'wallet query required' });
    const rows = await all('SELECT id, name, wallet FROM users WHERE wallet=?', [wallet]);
    return res.json(rows || []);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/operators/:id/entries/last -> delete last entry
router.delete('/:id/entries/last', async (req, res) => {
  try {
    const id = req.params.id;
    const last = await get('SELECT id FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1', [id]);
    if(!last) return res.status(404).json({ error: 'Nenhuma entrada para apagar' });
    await run('DELETE FROM risks WHERE entryId=?', [last.id]);
    await run('DELETE FROM entries WHERE id=?', [last.id]);
    res.json({ ok: true, deletedEntryId: last.id });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/operators/:id/entries/last -> patch last entry (add actualValue, add risks)
router.patch('/:id/entries/last', async (req, res) => {
  try {
    const id = req.params.id;
    const { addReceivedValue, newRisks } = req.body;
    const last = await get('SELECT id, actualValue FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1', [id]);
    if(!last) return res.status(404).json({ error: 'Nenhuma entrada para atualizar' });
    // Add to actualValue (real faturamento), NOT receivedValue
    const newValue = (Number(last.actualValue) || 0) + (Number(addReceivedValue) || 0);
    await run('UPDATE entries SET actualValue=?, timestamp=? WHERE id=?', [newValue, new Date().toLocaleString(), last.id]);
    // Insert new risks only if wallet allows renegociações
    const userRowPatch = await get('SELECT wallet FROM users WHERE id=?', [id]);
    const walletRowPatch = userRowPatch ? await get('SELECT session_type FROM wallets WHERE wallet=?', [userRowPatch.wallet]) : null;
    const isBVCardPatch = (userRowPatch && userRowPatch.wallet && String(userRowPatch.wallet).toUpperCase().includes('CARTAO')) || (walletRowPatch && walletRowPatch.session_type === 'bv_cartao');

    if(!isBVCardPatch && Array.isArray(newRisks) && newRisks.length>0) {
      const stmt = db.prepare('INSERT INTO risks(entryId,riskPremium) VALUES (?,?)');
      for(const r of newRisks) stmt.run(last.id, Number(r));
      stmt.finalize();
    } else if (isBVCardPatch && Array.isArray(newRisks) && newRisks.length>0) {
      console.log('[INFO] Skipping insertion of new risks for BV_CARTAO entry', last.id);
    }
    // Defensive cleanup for BV_CARTAO: ensure no risks exist for this entry
    if (isBVCardPatch) {
      try {
        await run('DELETE FROM risks WHERE entryId=?', [last.id]);
        console.log('[INFO] Ensured no risks for BV_CARTAO entry', last.id);
      } catch(e) { console.error('[CLEANUP ERROR] Could not delete new risks for BV_CARTAO', e); }
    }
    // Recalculate receivedValue for all operators in wallet
    await recalculateReceivedValue(id, last.id);
    
    const updatedEntry = await get('SELECT id, monthlyGoal, actualValue, receivedValue, timestamp FROM entries WHERE id=?', [last.id]);
    const risks = await all('SELECT id, riskPremium FROM risks WHERE entryId=?', [last.id]);
    res.json({ ok: true, entry: updatedEntry, risks });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
