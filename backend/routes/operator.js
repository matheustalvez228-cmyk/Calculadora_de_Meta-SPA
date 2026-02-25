const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));

function get(sql, params=[]) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => {
    if(err) rej(err); else res(row);
  }));
}

function all(sql, params=[]) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => {
    if(err) rej(err); else res(rows);
  }));
}

// GET /api/operator/tabela/todos -> list all operators with metrics
router.get('/tabela/todos', async (req, res) => {
  try {
    console.log('=== TABELA/TODOS REQUEST ===');
    const users = await all('SELECT id, name, wallet FROM users WHERE isMaster=0');
    console.log('Users found:', users);
    const result = [];
    for(const user of users) {
      const entry = await get('SELECT id, monthlyGoal, actualValue FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1', [user.id]);
      if(entry) {
        const risks = await all('SELECT COUNT(*) as cnt FROM risks WHERE entryId=?', [entry.id]);
        const renegCount = risks[0] ? risks[0].cnt : 0;
        const monthlyGoal = Number(entry.monthlyGoal) || 0;
        const actualValue = Number(entry.actualValue) || 0;
        const percentual = monthlyGoal > 0 ? ((actualValue / monthlyGoal) * 100).toFixed(2) : 0;
        result.push({
          id: user.id,
          name: user.name || user.id,
          wallet: user.wallet,
          meta: monthlyGoal,
          valorAtingido: actualValue,
          percentual: parseFloat(percentual),
          renegociacoes: renegCount
        });
      }
    }
    console.log('Result:', result);
    return res.json({ operadores: result });
  } catch(err) { 
    console.error('=== TABELA/TODOS ERROR ===', err); 
    return res.status(500).json({ error: 'Erro interno', details: err.message }); 
  }
});

// GET /api/operator/:id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const user = await get('SELECT id, name, wallet, isMaster FROM users WHERE id=?', [id]);
    if(!user) return res.status(404).json({ error: 'Operador não encontrado' });

    // fetch ConcCoins balance if present
    const cb = await get('SELECT balance FROM conc_wallets WHERE operatorId=?', [id]);
    const concBalance = cb ? Number(cb.balance) : 0;

    const entry = await get('SELECT id, monthlyGoal, actualValue, receivedValue, timestamp FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1', [id]);
    if(!entry) return res.json({ user, entry: null, risks: [], breakdown: null });

    const risks = await all('SELECT id, riskPremium FROM risks WHERE entryId=?', [entry.id]);
    
    // actualValue = what operator reported as real faturamento
    // receivedValue = calculated ressarciment (base + risks)
    const realFaturamento = Number(entry.actualValue) || 0;
    const riskSum = risks.reduce((sum, r) => sum + (Number(r.riskPremium) || 0), 0);
    
    // If receivedValue already includes risks, extract base value
    const calculatedReceived = Number(entry.receivedValue) || 0;
    const baseValue = Math.max(0, calculatedReceived - riskSum);
    
    // percentual atingido = (realFaturamento / monthlyGoal) * 100
    const monthlyGoal = Number(entry.monthlyGoal) || 0;
    const percentualAtingido = monthlyGoal > 0 ? (realFaturamento / monthlyGoal) * 100 : 0;
    
    return res.json({ 
      user: { ...user, concBalance },
      entry: { 
        ...entry,
        realFaturamento,
        baseValue, 
        riskValue: riskSum,
        percentualAtingido: parseFloat(percentualAtingido.toFixed(2))
      }, 
      risks 
    });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/operator/:id/profile - obter dados do perfil do operador
router.get('/:id/profile', async (req, res) => {
  try {
    const operatorId = req.params.id;
    
    // Obter dados do usuário
    const user = await get('SELECT id, name, wallet FROM users WHERE id=?', [operatorId]);
    if (!user) {
      return res.status(404).json({ error: 'Operador não encontrado' });
    }

    // Obter última entrada (meta e recebimento)
    const entry = await get(
      'SELECT id, monthlyGoal, actualValue FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
      [operatorId]
    );

    const meta = entry ? Number(entry.monthlyGoal) || 0 : 0;
    const recebimento = entry ? Number(entry.actualValue) || 0 : 0;

    res.json({
      id: user.id,
      name: user.name,
      wallet: user.wallet,
      meta: meta,
      recebimento: recebimento
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/operator/:id/meta - atualizar meta mensal
router.post('/:id/meta', async (req, res) => {
  try {
    const operatorId = req.params.id;
    const { meta } = req.body;

    if (meta === undefined || meta === null) {
      return res.status(400).json({ error: 'Meta é obrigatória' });
    }

    const metaValue = Number(meta);
    if (isNaN(metaValue) || metaValue < 0) {
      return res.status(400).json({ error: 'Meta deve ser um número válido' });
    }

    // Obter ou criar entrada para este operador
    let entry = await get(
      'SELECT id FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
      [operatorId]
    );

    if (entry) {
      // Atualizar meta
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE entries SET monthlyGoal=? WHERE id=?',
          [metaValue, entry.id],
          (err) => err ? reject(err) : resolve()
        );
      });
    } else {
      // Criar nova entrada com a meta
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO entries (operatorId, monthlyGoal, actualValue) VALUES (?, ?, 0)',
          [operatorId, metaValue],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    res.json({ ok: true, meta: metaValue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
});

// GET /api/operator/:id/recebimento - obter dados de recebimento persistidos
router.get('/:id/recebimento', async (req, res) => {
  try {
    const operatorId = req.params.id;
    
    // Buscar dados de recebimento do banco
    const entry = await get(
      'SELECT recebimento FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
      [operatorId]
    );

    let recebimento = {
      operatorId: operatorId,
      rodas_total: 0,
      rodas_entregas: 0,
      rodas_reneg: 0,
      cartoes_cl1: 0,
      cartoes_cl2: 0,
      cartoes_propostas: []
    };

    if (entry && entry.recebimento) {
      try {
        recebimento = { ...recebimento, ...JSON.parse(entry.recebimento) };
      } catch (e) {
        console.warn('Erro ao parsear recebimento:', e);
      }
    }

    res.json(recebimento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar recebimento' });
  }
});

// POST /api/operator/:id/recebimento - salvar dados de recebimento persistidos no banco
router.post('/:id/recebimento', async (req, res) => {
  try {
    const operatorId = req.params.id;
    const data = req.body;

    // Validar dados
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const recebimentoJson = JSON.stringify(data);

    // Obter ou criar entrada para este operador
    let entry = await get(
      'SELECT id FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1',
      [operatorId]
    );

    if (entry) {
      // Atualizar recebimento na entrada existente
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE entries SET recebimento=? WHERE id=?',
          [recebimentoJson, entry.id],
          (err) => err ? reject(err) : resolve()
        );
      });
    } else {
      // Criar nova entrada com recebimento
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO entries (operatorId, monthlyGoal, actualValue, recebimento) VALUES (?, 0, 0, ?)',
          [operatorId, recebimentoJson],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    console.log(`Recebimento persistido para ${operatorId}:`, data);
    res.json({ ok: true, message: 'Dados de recebimento salvos' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar recebimento' });
  }
});

module.exports = router;
