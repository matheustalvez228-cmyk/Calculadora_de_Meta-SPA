const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));

db.serialize(()=>{
  db.run("DELETE FROM risks WHERE entryId IN (SELECT e.id FROM entries e JOIN users u ON e.operatorId = u.id JOIN wallets w ON u.wallet = w.wallet WHERE w.session_type = 'bv_cartao')", (err)=>{
    if(err) console.error('cleanup error', err); else console.log('cleanup done');
    db.all("SELECT e.id, u.id as operatorId FROM entries e JOIN users u ON e.operatorId = u.id JOIN wallets w ON u.wallet = w.wallet WHERE w.session_type = 'bv_cartao'", (err2, rows)=>{
      if(err2) console.error('err2', err2);
      else console.log('BV_CARTAO entries remaining:', rows.map(r=>r.id));
      db.all('SELECT * FROM risks', (err3, rrows)=>{ console.log('current risks count:', rrows? rrows.length:0); process.exit(0); });
    });
  });
});