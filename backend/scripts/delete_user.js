const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const id = process.argv[2];
if(!id){
  console.error('Usage: node delete_user.js <id>');
  process.exit(2);
}

const DB = path.join(__dirname, '..', 'data.sqlite3');
const db = new sqlite3.Database(DB);

function run(sql, params=[]) {
  return new Promise((res, rej) => db.run(sql, params, function(err){ if(err) rej(err); else res(this); }));
}
function all(sql, params=[]) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows)=>{ if(err) rej(err); else res(rows); }));
}

(async()=>{
  try{
    const user = await all('SELECT id FROM users WHERE id=?', [id]);
    if(!user || user.length===0){
      console.log(JSON.stringify({ok:false, message:'user not found', id}));
      process.exit(0);
    }

    // find entries
    const entries = await all('SELECT id FROM entries WHERE operatorId=?', [id]);
    const entryIds = entries.map(r=>r.id);

    // delete risks for these entries
    if(entryIds.length>0){
      const q = `DELETE FROM risks WHERE entryId IN (${entryIds.map(()=>'?').join(',')})`;
      await run(q, entryIds);
    }

    // delete entries
    await run('DELETE FROM entries WHERE operatorId=?', [id]);

    // delete allocations if table exists
    try{
      await run('DELETE FROM allocations WHERE operatorId=?', [id]);
    }catch(e){ /* ignore if table missing */ }

    // finally delete user
    await run('DELETE FROM users WHERE id=?', [id]);

    console.log(JSON.stringify({ok:true, message:'deleted user and related records', id, deletedEntries: entryIds.length}));
    process.exit(0);
  }catch(err){
    console.error(JSON.stringify({ok:false,error:err.message}));
    process.exit(1);
  }finally{
    try{ db.close(); }catch(e){}
  }
})();
