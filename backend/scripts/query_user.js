const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const id = process.argv[2];
if(!id){ console.error('Usage: node query_user.js <id>'); process.exit(2); }

const DB = path.join(__dirname, '..', 'data.sqlite3');
const db = new sqlite3.Database(DB);

db.get('SELECT id, name, wallet FROM users WHERE id=?', [id], (err,row)=>{
  if(err){ console.error('ERROR', err.message); process.exit(1); }
  if(!row) { console.log('NOT FOUND'); process.exit(0); }
  console.log(JSON.stringify(row));
  process.exit(0);
});
