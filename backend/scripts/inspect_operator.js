const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const operatorId = process.argv[2] || '192518';
const DB = path.join(__dirname, '..', 'data.sqlite3');
const db = new sqlite3.Database(DB);

function get(sql, params=[]) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => { if(err) rej(err); else res(row); }));
}
function all(sql, params=[]) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => { if(err) rej(err); else res(rows); }));
}

(async()=>{
  try {
    const user = await get('SELECT id, name, wallet FROM users WHERE id=?', [operatorId]);
    console.log('User:', JSON.stringify(user, null, 2));
    
    const entry = await get('SELECT id, monthlyGoal, receivedValue, timestamp FROM entries WHERE operatorId=? ORDER BY id DESC LIMIT 1', [operatorId]);
    console.log('Last Entry:', JSON.stringify(entry, null, 2));
    
    const risks = await all('SELECT id, riskPremium FROM risks WHERE entryId=?', [entry?.id]);
    console.log('Risks:', JSON.stringify(risks, null, 2));
    
    if(user?.wallet) {
      const wallet = await get('SELECT wallet, bonificacao, taxa FROM wallets WHERE wallet=?', [user.wallet]);
      console.log('Wallet:', JSON.stringify(wallet, null, 2));
      
      const allocs = await all('SELECT operatorId, percent FROM allocations WHERE wallet=?', [user.wallet]);
      console.log('Allocations:', JSON.stringify(allocs, null, 2));
    }
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
