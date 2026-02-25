const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));

db.all(`SELECT r.id as riskId, r.entryId, r.riskPremium, u.id as operatorId, u.wallet, w.session_type
FROM risks r
LEFT JOIN entries e ON r.entryId = e.id
LEFT JOIN users u ON e.operatorId = u.id
LEFT JOIN wallets w ON u.wallet = w.wallet
ORDER BY r.id`, (err, rows)=>{
  if(err) { console.error(err); process.exit(1); }
  console.log('risks:', JSON.stringify(rows, null, 2));
  process.exit(0);
});