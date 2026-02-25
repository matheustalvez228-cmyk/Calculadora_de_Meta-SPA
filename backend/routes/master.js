const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');

const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function run(sql, params=[]) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { if(err) rej(err); else res(this); }));
}
function get(sql, params=[]) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => { if(err) rej(err); else res(row); }));
}
function all(sql, params=[]) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => { if(err) rej(err); else res(rows); }));
}

// Middleware: verify master
async function verifyMaster(req, res, next) {
  try {
    const h = req.headers['authorization'];
    if(!h) return res.status(401).json({ error: 'missing token' });
    
    const token = h.split(' ')[1];
    const p = jwt.verify(token, SECRET);
    if(!p.isMaster) return res.status(403).json({ error: 'master-only' });
    
    req.user = p;
    next();
  } catch(e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// GET /api/master/wallet-summary
// Returns: total received, meta, %, operators count
router.get('/wallet-summary', verifyMaster, async (req, res) => {
  try {
    const wallet = req.user.wallet;
    
    // Get wallet settings
    const walletData = await get('SELECT bonificacao, taxa, meta_carteira FROM wallets WHERE wallet=?', [wallet]);
    
    // Calculate total recebimento from all operators
    const totalsResult = await get(`
      SELECT SUM(receivedValue) as totalRecebimento 
      FROM entries 
      WHERE operatorId IN (
        SELECT id FROM users WHERE wallet=? AND isMaster=0
      )
    `, [wallet]);
    
    const totalRecebimento = totalsResult ? Number(totalsResult.totalRecebimento || 0) : 0;
    const metaCarteira = walletData ? Number(walletData.meta_carteira || 0) : 0;
    const percentualAtingido = metaCarteira > 0 ? (totalRecebimento / metaCarteira) * 100 : 0;
    
    // Count operators
    const operatorCount = await get(
      'SELECT COUNT(*) as count FROM users WHERE wallet=? AND isMaster=0',
      [wallet]
    );
    
    res.json({
      wallet,
      totalRecebimento,
      metaCarteira,
      percentualAtingido: Number(percentualAtingido.toFixed(2)),
      operatorCount: operatorCount ? operatorCount.count : 0,
      bonificacao: walletData ? Number(walletData.bonificacao || 0) : 0
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/master/operators-dashboard
// Returns list of operators with their recebimento and meta info
router.get('/operators-dashboard', verifyMaster, async (req, res) => {
  try {
    const wallet = req.user.wallet;
    
    const operators = await all(`
      SELECT 
        u.id, u.name, 
        e.id as entryId, e.monthlyGoal, e.actualValue, e.receivedValue, 
        e.bonificacao_receber
      FROM users u
      LEFT JOIN entries e ON u.id = e.operatorId AND e.id = (
        SELECT id FROM entries WHERE operatorId=u.id ORDER BY id DESC LIMIT 1
      )
      WHERE u.wallet=? AND u.isMaster=0
      ORDER BY u.name
    `, [wallet]);
    
    const result = operators.map(op => {
      const monthlyGoal = Number(op.monthlyGoal || 0);
      const actualValue = Number(op.actualValue || 0);
      const receivedValue = Number(op.receivedValue || 0);
      const bonificacao_receber = Number(op.bonificacao_receber || 0);
      const percentualAtingido = monthlyGoal > 0 ? (actualValue / monthlyGoal) * 100 : 0;
      
      return {
        id: op.id,
        name: op.name,
        monthlyGoal,
        actualValue,
        receivedValue,
        bonificacao_receber,
        percentualAtingido: Number(percentualAtingido.toFixed(2)),
        bateuMeta: percentualAtingido >= 100
      };
    });
    
    res.json(result);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/master/update-cart-meta
// Updates wallet meta and returns updated summary
router.post('/update-cart-meta', verifyMaster, async (req, res) => {
  try {
    const wallet = req.user.wallet;
    const { metaCarteira } = req.body;
    
    if(!metaCarteira || metaCarteira <= 0) {
      return res.status(400).json({ error: 'metaCarteira deve ser > 0' });
    }
    
    await run('UPDATE wallets SET meta_carteira=? WHERE wallet=?', [metaCarteira, wallet]);
    
    // Return updated summary
    const walletData = await get('SELECT bonificacao, taxa, meta_carteira FROM wallets WHERE wallet=?', [wallet]);
    
    const totalsResult = await get(`
      SELECT SUM(receivedValue) as totalRecebimento 
      FROM entries 
      WHERE operatorId IN (
        SELECT id FROM users WHERE wallet=? AND isMaster=0
      )
    `, [wallet]);
    
    const totalRecebimento = totalsResult ? Number(totalsResult.totalRecebimento || 0) : 0;
    const percentualAtingido = Number(metaCarteira) > 0 ? (totalRecebimento / Number(metaCarteira)) * 100 : 0;
    
    res.json({
      success: true,
      metaCarteira: Number(metaCarteira),
      totalRecebimento,
      percentualAtingido: Number(percentualAtingido.toFixed(2))
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/master/calculate-bonus-proportional
// Calculates proportional distribution of bonus
router.post('/calculate-bonus-proportional', verifyMaster, async (req, res) => {
  try {
    const wallet = req.user.wallet;
    const { bonificacaoTotal } = req.body;
    
    if(!bonificacaoTotal || bonificacaoTotal <= 0) {
      return res.status(400).json({ error: 'bonificacaoTotal deve ser > 0' });
    }
    
    // Get all operators that reached >= 100% meta
    const operators = await all(`
      SELECT 
        u.id, u.name,
        e.id as entryId, e.monthlyGoal, e.actualValue
      FROM users u
      LEFT JOIN entries e ON u.id = e.operatorId AND e.id = (
        SELECT id FROM entries WHERE operatorId=u.id ORDER BY id DESC LIMIT 1
      )
      WHERE u.wallet=? AND u.isMaster=0 AND e.monthlyGoal IS NOT NULL
    `, [wallet]);
    
    // Calculate weights (percentual - 100 for those >= 100%)
    let totalWeight = 0;
    const operatorWeights = {};
    
    for(const op of operators) {
      const monthlyGoal = Number(op.monthlyGoal || 0);
      const actualValue = Number(op.actualValue || 0);
      
      if(monthlyGoal > 0) {
        const percentualAtingido = (actualValue / monthlyGoal) * 100;
        const weight = Math.max(0, percentualAtingido - 100);
        
        if(weight > 0) {
          operatorWeights[op.id] = {
            name: op.name,
            percentualAtingido: Number(percentualAtingido.toFixed(2)),
            weight,
            entryId: op.entryId
          };
          totalWeight += weight;
        }
      }
    }
    
    // Calculate each operator's bonus share
    const bonusDistribution = {};
    
    if(totalWeight > 0) {
      for(const operatorId in operatorWeights) {
        const opData = operatorWeights[operatorId];
        const bonusShare = (bonificacaoTotal * (opData.weight / totalWeight));
        bonusDistribution[operatorId] = {
          name: opData.name,
          percentualAtingido: opData.percentualAtingido,
          weight: opData.weight,
          bonusShare: Number(bonusShare.toFixed(2))
        };
      }
    }
    
    res.json({
      bonificacaoTotal: Number(bonificacaoTotal),
      totalWeight,
      distribution: bonusDistribution,
      operadoresBeneficiados: Object.keys(bonusDistribution).length
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/master/save-bonus
// Saves the bonus values to each operator's entry
router.post('/save-bonus', verifyMaster, async (req, res) => {
  try {
    const wallet = req.user.wallet;
    const { bonificacaoTotal, distribution } = req.body;
    
    if(!distribution || typeof distribution !== 'object') {
      return res.status(400).json({ error: 'distribution inválido' });
    }
    
    // Update each operator's bonificacao_receber
    const operatorsUpdated = [];
    
    for(const operatorId in distribution) {
      const bonus = Number(distribution[operatorId].bonusShare || 0);
      
      // Get latest entry for this operator
      const latestEntry = await get(
        'SELECT id FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
        [operatorId]
      );
      
      if(latestEntry) {
        await run(
          'UPDATE entries SET bonificacao_receber=? WHERE id=?',
          [bonus, latestEntry.id]
        );
        
        operatorsUpdated.push({
          operatorId,
          name: distribution[operatorId].name,
          bonusAtualizado: bonus
        });
      }
    }
    
    // Also update wallet bonificacao total
    await run('UPDATE wallets SET bonificacao=? WHERE wallet=?', [bonificacaoTotal, wallet]);
    
    res.json({
      success: true,
      operatorsUpdated,
      message: `Bonificações atualizadas para ${operatorsUpdated.length} operadores`
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/master/risks
// Returns renegotiations/risks for operators in the wallet
router.get('/risks', verifyMaster, async (req, res) => {
  try {
    const wallet = req.user.wallet;
    
    // Get risks for all operators in this wallet
    const risks = await all(`
      SELECT 
        r.id,
        r.entryId,
        r.riskPremium,
        r.description,
        r.timestamp,
        u.id as operatorId,
        u.name as operatorName
      FROM risks r
      JOIN entries e ON r.entryId = e.id
      JOIN users u ON e.operatorId = u.id
      WHERE u.wallet = ? AND u.isMaster = 0
      ORDER BY r.timestamp DESC
    `, [wallet]);
    
    res.json(risks || []);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar renegociações' });
  }
});

module.exports = router;
