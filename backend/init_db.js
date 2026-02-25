/**
 * Script de Inicialização do Banco de Dados
 * Cria tabelas do zero e popula com usuários masters e operadores de demonstração
 * 
 * Uso: node init_db.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'data.sqlite3');

// Se banco existe, fazer backup
if (fs.existsSync(DB_FILE)) {
  const backupFile = path.join(__dirname, `data.sqlite3.backup.${Date.now()}.old`);
  try {
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`✓ Backup criado: ${backupFile}`);
    try {
      fs.unlinkSync(DB_FILE);
      console.log('✓ Banco antigo removido');
    } catch (unlinkErr) {
      console.log('⚠ Banco antigo ainda em uso, será sobrescrito...');
    }
  } catch (copyErr) {
    console.log('⚠ Não foi possível fazer backup, continuando...');
  }
}

const db = new sqlite3.Database(DB_FILE);

function run(sql, params = []) {
  return new Promise((res, rej) => {
    db.run(sql, params, function (err) {
      if (err) rej(err);
      else res(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((res, rej) => {
    db.all(sql, params, (err, rows) => {
      if (err) rej(err);
      else res(rows);
    });
  });
}

async function initDatabase() {
  try {
    console.log('\n🔄 Iniciando criação do banco de dados...\n');

    // 1. Criar tabelas
    console.log('📋 Criando tabelas...');

    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        wallet TEXT,
        isMaster INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        selectedCar TEXT
      )
    `);
    console.log('  ✓ Tabela users criada');

    await run(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operatorId TEXT NOT NULL,
        monthlyGoal REAL DEFAULT 0,
        actualValue REAL DEFAULT 0,
        receivedValue REAL DEFAULT 0,
        conc_awarded INTEGER DEFAULT 0,
        recebimento TEXT,
        bonificacao_receber REAL DEFAULT 0,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(operatorId) REFERENCES users(id)
      )
    `);
    console.log('  ✓ Tabela entries criada');

    await run(`
      CREATE TABLE IF NOT EXISTS risks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entryId INTEGER NOT NULL,
        riskPremium REAL DEFAULT 0,
        description TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(entryId) REFERENCES entries(id)
      )
    `);
    console.log('  ✓ Tabela risks criada');

    await run(`
      CREATE TABLE IF NOT EXISTS wallets (
        wallet TEXT PRIMARY KEY,
        bonificacao REAL DEFAULT 0,
        taxa REAL DEFAULT 0,
        session_type TEXT DEFAULT 'bv_rodas',
        meta_carteira REAL DEFAULT 0
      )
    `);
    console.log('  ✓ Tabela wallets criada');

    await run(`
      CREATE TABLE IF NOT EXISTS conc_wallets (
        operatorId TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 0,
        history TEXT DEFAULT '[]',
        FOREIGN KEY(operatorId) REFERENCES users(id)
      )
    `);
    console.log('  ✓ Tabela conc_wallets criada');

    await run(`
      CREATE TABLE IF NOT EXISTS unlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operatorId TEXT NOT NULL,
        carPath TEXT NOT NULL,
        cost INTEGER DEFAULT 500,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(operatorId) REFERENCES users(id)
      )
    `);
    console.log('  ✓ Tabela unlocks criada');

    await run(`
      CREATE TABLE IF NOT EXISTS allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet TEXT NOT NULL,
        operatorId TEXT NOT NULL,
        amount REAL DEFAULT 0,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(wallet) REFERENCES wallets(wallet),
        FOREIGN KEY(operatorId) REFERENCES users(id)
      )
    `);
    console.log('  ✓ Tabela allocations criada');

    // 2. Inserir carteiras
    console.log('\n💼 Inserindo carteiras...');

    await run(
      'INSERT OR IGNORE INTO wallets(wallet, bonificacao, taxa, session_type, meta_carteira) VALUES(?, ?, ?, ?, ?)',
      ['BV_RODAS', 50000, 10, 'bv_rodas', 1000000]
    );
    console.log('  ✓ Carteira BV_RODAS criada');

    await run(
      'INSERT OR IGNORE INTO wallets(wallet, bonificacao, taxa, session_type, meta_carteira) VALUES(?, ?, ?, ?, ?)',
      ['BV_CARTAO', 30000, 8, 'bv_cartao', 500000]
    );
    console.log('  ✓ Carteira BV_CARTAO criada');

    // 3. Criar usuários masters
    console.log('\n👤 Criando usuários Masters...');

    const masterPassword = await bcrypt.hash('123456', 10); // Senha padrão: 123456

    const masters = [
      { id: '10001', name: 'Gestor BV Rodas', wallet: 'BV_RODAS', description: 'Master BV Rodas Bom/Pagador' },
      { id: '10002', name: 'Admin BV Cartões CL1', wallet: 'BV_CARTAO', description: 'Master BV Cartões Cluster 1' },
      { id: '10003', name: 'Admin BV Cartões CL2', wallet: 'BV_CARTAO', description: 'Master BV Cartões Cluster 2' },
      { id: '10004', name: 'Admin Geral', wallet: 'BV_RODAS', description: 'Administrador do Sistema' }
    ];

    for (const master of masters) {
      await run(
        'INSERT OR IGNORE INTO users(id, password, name, wallet, isMaster, status) VALUES(?, ?, ?, ?, 1, ?)',
        [master.id, masterPassword, master.name, master.wallet, 'active']
      );
      console.log(`  ✓ Master ${master.id} (${master.description})`);
    }

    // 4. Criar operadores de demonstração
    console.log('\n👥 Criando operadores de demonstração...');

    const operatorPassword = await bcrypt.hash('123456', 10);

    // BV Rodas - 5 operadores
    const bvRodasOperators = [
      { id: '20001', name: 'Carlos Machado', wallet: 'BV_RODAS', goal: 150000, actualValue: 165000 },
      { id: '20002', name: 'Ana Silva', wallet: 'BV_RODAS', goal: 200000, actualValue: 180000 },
      { id: '20003', name: 'Bruno Santos', wallet: 'BV_RODAS', goal: 175000, actualValue: 195000 },
      { id: '20004', name: 'Mariana Costa', wallet: 'BV_RODAS', goal: 250000, actualValue: 240000 },
      { id: '20005', name: 'Lucas Oliveira', wallet: 'BV_RODAS', goal: 180000, actualValue: 160000 }
    ];

    // BV Cartões CL1 - 4 operadores
    const bvCartaoCL1Operators = [
      { id: '30001', name: 'Fernando Alves', wallet: 'BV_CARTAO', goal: 120000, actualValue: 135000 },
      { id: '30002', name: 'Juliana Mendes', wallet: 'BV_CARTAO', goal: 140000, actualValue: 125000 },
      { id: '30003', name: 'Roberto Lima', wallet: 'BV_CARTAO', goal: 110000, actualValue: 145000 },
      { id: '30004', name: 'Beatriz Gomes', wallet: 'BV_CARTAO', goal: 130000, actualValue: 128000 }
    ];

    // BV Cartões CL2 - 4 operadores
    const bvCartaoCL2Operators = [
      { id: '40001', name: 'Paulo Castro', wallet: 'BV_CARTAO', goal: 125000, actualValue: 118000 },
      { id: '40002', name: 'Camila Rocha', wallet: 'BV_CARTAO', goal: 135000, actualValue: 142000 },
      { id: '40003', name: 'Felipe Pinto', wallet: 'BV_CARTAO', goal: 115000, actualValue: 122000 },
      { id: '40004', name: 'Sophia Barbosa', wallet: 'BV_CARTAO', goal: 140000, actualValue: 138000 }
    ];

    const allOperators = [...bvRodasOperators, ...bvCartaoCL1Operators, ...bvCartaoCL2Operators];

    for (const op of allOperators) {
      // Criar usuário
      await run(
        'INSERT OR IGNORE INTO users(id, password, name, wallet, isMaster, status) VALUES(?, ?, ?, ?, 0, ?)',
        [op.id, operatorPassword, op.name, op.wallet, 'active']
      );

      // Criar entry com dados do mês
      const receivedValue = op.actualValue * 0.95; // 95% do valor real (simulando taxa)
      const concAwarded = Math.floor((op.actualValue / op.goal) * 100); // Pontos baseado em performance

      await run(
        'INSERT INTO entries(operatorId, monthlyGoal, actualValue, receivedValue, conc_awarded) VALUES(?, ?, ?, ?, ?)',
        [op.id, op.goal, op.actualValue, receivedValue, concAwarded]
      );

      // Criar carteira de moedas
      const concBalance = Math.floor(concAwarded * 5); // Cada % = 5 pontos
      await run(
        'INSERT OR IGNORE INTO conc_wallets(operatorId, balance) VALUES(?, ?)',
        [op.id, concBalance]
      );

      // Criar renegociações/riscos realistas
      const riskDescriptions = [
        'Acordo em atraso 30 dias',
        'Disputa de valor',
        'Pendência de documentação',
        'Estruturação de renegociação',
        'Análise de risco'
      ];

      const riskCount = Math.floor(Math.random() * 3); // 0-2 riscos por operador
      for (let r = 0; r < riskCount; r++) {
        const riskPremium = Math.random() * 2000 + 500; // 500-2500
        const riskDesc = riskDescriptions[Math.floor(Math.random() * riskDescriptions.length)];
        
        await run(
          'INSERT INTO risks(entryId, riskPremium, description) VALUES(?, ?, ?)',
          [1 + Math.floor(Math.random() * 13), riskPremium, riskDesc]
        );
      }

      console.log(`  ✓ Operador ${op.id} (${op.name}) - Carteira: ${op.wallet} | Riscos: ${riskCount}`);
    }

    // Adicionar alguns riscos adicionais para carteiras pequenas
    console.log('\n🔴 Adicionando dados de renegociações...');
    const riskEntries = [
      { entryId: 1, premium: 1500, desc: 'Estruturação de renegociação - 30 dias' },
      { entryId: 2, premium: 2000, desc: 'Disputa de valor em acordo' },
      { entryId: 3, premium: 800, desc: 'Documentação pendente' },
      { entryId: 5, premium: 1200, desc: 'Atraso in renegociação' },
    ];

    for (const risk of riskEntries) {
      await run(
        'INSERT INTO risks(entryId, riskPremium, description) VALUES(?, ?, ?)',
        [risk.entryId, risk.premium, risk.desc]
      );
    }
    console.log(`  ✓ ${riskEntries.length} renegociações cadastradas`);

    console.log('\n✅ Banco de dados inicializado com sucesso!\n');
    console.log('📝 Usuários Masters criados:');
    console.log('  10001 - Gestor BV Rodas (senha: 123456)');
    console.log('  10002 - Admin BV Cartões CL1 (senha: 123456)');
    console.log('  10003 - Admin BV Cartões CL2 (senha: 123456)');
    console.log('  10004 - Admin Geral (senha: 123456)');
    console.log('\n👥 Operadores de demonstração criados:');
    console.log(`  - ${bvRodasOperators.length} operadores em BV_RODAS`);
    console.log(`  - ${bvCartaoCL1Operators.length} operadores em BV_CARTAO (CL1)`);
    console.log(`  - ${bvCartaoCL2Operators.length} operadores em BV_CARTAO (CL2)`);
    console.log('\n💡 Para iniciar o servidor: npm start\n');

    db.close();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    db.close();
    process.exit(1);
  }
}

initDatabase();
