const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
console.log('[CONC ROUTES] module loaded');

const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function run(sql, params=[]) { return new Promise((res, rej) => db.run(sql, params, function(err){ if(err) rej(err); else res(this); })); }
function get(sql, params=[]) { return new Promise((res, rej) => db.get(sql, params, (err,row)=>{ if(err) rej(err); else res(row); })); }

async function isMasterFromReq(req){ try{ const h = req.headers['authorization']; if(!h) return false; const token = h.split(' ')[1]; const p = jwt.verify(token, SECRET); return p && p.isMaster; }catch(e){ return false; } }

// debug POST stub
router.post('/debug-post', async (req,res)=>{ console.log('[CONC DEBUG POST] body', req.body); res.json({ok:true}); });

// GET /api/conc/:operatorId/balance
router.get('/:operatorId/balance', async (req, res) => {
  try {
    const id = req.params.operatorId;
    const row = await get('SELECT balance FROM conc_wallets WHERE operatorId=?', [id]);
    const balance = row ? Number(row.balance) : 0;
    return res.json({ operatorId: id, balance });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/conc/:operatorId/unlocks -> list unlocked carPaths
router.get('/:operatorId/unlocks', async (req, res) => {
  try {
    const id = req.params.operatorId;
    const rows = await new Promise((res2, rej2) => db.all('SELECT carPath, cost, timestamp FROM unlocks WHERE operatorId=?', [id], (err, rows) => { if(err) rej2(err); else res2(rows); }));
    return res.json({ operatorId: id, unlocks: rows || [] });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/conc/ranking/:wallet -> list operators in wallet ordered by conc balance (points)
router.get('/ranking/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const rows = await new Promise((res2, rej2) => db.all(`
      SELECT u.id as operatorId, u.name as name, COALESCE(c.balance,0) as points, u.selectedCar as selectedCar
      FROM users u
      LEFT JOIN conc_wallets c ON c.operatorId = u.id
      WHERE u.wallet = ? AND u.isMaster = 0
      LIMIT 100
    `, [wallet], (err, rows) => { if(err) rej2(err); else res2(rows); }));

    // load optional custom order
    const orderRows = await new Promise((res3, rej3) => db.all('SELECT operatorId, rank FROM wallet_rankings WHERE wallet=?', [wallet], (err, rows) => { if(err) rej3(err); else res3(rows); }));
    const orderMap = {};
    if(Array.isArray(orderRows) && orderRows.length>0) orderRows.forEach(r=> orderMap[r.operatorId] = r.rank);

    // sort: operators with explicit rank first (by rank asc), then by points desc
    rows.sort((a,b)=>{
      const ra = orderMap[a.operatorId];
      const rb = orderMap[b.operatorId];
      if(ra !== undefined && rb !== undefined) return ra - rb;
      if(ra !== undefined) return -1;
      if(rb !== undefined) return 1;
      return (Number(b.points) || 0) - (Number(a.points) || 0);
    });

    return res.json({ wallet, ranking: rows || [] });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/conc/:operatorId/unlock  { carPath, cost }
router.post('/:operatorId/unlock', async (req, res) => {
  try {
    const id = req.params.operatorId;
    const { carPath, cost } = req.body;
    const c = Number(cost) || 0;
    if(c <= 0) return res.status(400).json({ error: 'cost required' });

    const row = await get('SELECT balance FROM conc_wallets WHERE operatorId=?', [id]);
    const balance = row ? Number(row.balance) : 0;
    if(balance < c) return res.status(400).json({ error: 'Saldo insuficiente' });

    const newBal = balance - c;
    if(row) await run('UPDATE conc_wallets SET balance=? WHERE operatorId=?', [newBal, id]);
    else await run('INSERT INTO conc_wallets(operatorId,balance) VALUES(?,?)', [id, newBal]);

    await run('INSERT INTO unlocks(operatorId,carPath,cost,timestamp) VALUES(?,?,?,?)', [id, carPath, c, new Date().toLocaleString()]);

    return res.json({ ok:true, balance: newBal });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/conc/:operatorId/select  { carPath }
router.post('/:operatorId/select', async (req, res) => {
  try {
    const id = req.params.operatorId;
    const { carPath } = req.body;
    if(!carPath) return res.status(400).json({ error: 'carPath required' });

    await run('UPDATE users SET selectedCar=? WHERE id=?', [carPath, id]);
    return res.json({ ok:true, selectedCar: carPath });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/conc/ranking/:wallet  { order: [operatorId,...] } -> save custom ranking (masters only)
router.post('/ranking/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const order = Array.isArray(req.body.order) ? req.body.order : [];

    // debug: log incoming requests to help track intermittent 404s
    try{ const hasAuth = !!req.headers['authorization']; console.log(`[CONC RANKING] POST /ranking/${wallet} auth=${hasAuth} bodyOrderLen=${order.length}`); }catch(e){ /* ignore */ }

    if(!await isMasterFromReq(req)) return res.status(403).json({ error: 'master-only' });

    // Replace existing ranking for wallet atomically
    await run('BEGIN TRANSACTION');
    try {
      await run('DELETE FROM wallet_rankings WHERE wallet=?', [wallet]);
      const stmt = db.prepare('INSERT INTO wallet_rankings(wallet,operatorId,rank) VALUES (?,?,?)');
      for(let i=0;i<order.length;i++) stmt.run(wallet, order[i], i+1);
      stmt.finalize();
      await run('COMMIT');
    } catch(e){ await run('ROLLBACK'); throw e; }

    return res.json({ ok:true, wallet, saved: order.length });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/conc/:operatorId/profile -> return balance and selectedCar
router.get('/:operatorId/profile', async (req, res) => {
  try {
    const id = req.params.operatorId;
    const row = await get('SELECT selectedCar FROM users WHERE id=?', [id]);
    const balRow = await get('SELECT balance FROM conc_wallets WHERE operatorId=?', [id]);
    return res.json({ operatorId: id, selectedCar: row ? row.selectedCar : null, balance: balRow ? Number(balRow.balance) : 0 });
  } catch(err) { console.error(err); return res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;
