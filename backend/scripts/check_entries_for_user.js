const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'data.sqlite3'));

const op = '900001';

db.all('SELECT id, monthlyGoal, actualValue, receivedValue, dias_atraso, acordo, acordo_performance, boleto_value FROM entries WHERE operatorId=? ORDER BY id DESC', [op], (e, rows) => {
  if(e) return console.error(e);
  console.log('entries:', rows);
  const ids = rows.map(r=>r.id);
  if(ids.length===0) return process.exit(0);
  db.all('SELECT id, entryId, riskPremium FROM risks WHERE entryId IN ('+ids.join(',')+')', (er, rrows)=>{
    if(er) return console.error(er);
    console.log('risks attached to these entries:', rrows);
    process.exit(0);
  });
});