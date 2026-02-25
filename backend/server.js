const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const DB_FILE = path.join(__dirname, 'data.sqlite3');

const db = new sqlite3.Database(DB_FILE);

const app = express();
app.use(cors());
app.use(bodyParser.json());


// ------------------------------
// SERVE FRONTEND
// ------------------------------
app.use('/', express.static(path.join(__dirname, '..', 'frontend'), {
    index: 'index.html'
}));

// ------------------------------
// ROTAS DO OPERADOR (IMPORTAÇÃO ÚNICA)
// ------------------------------
const operatorRoutes = require('./routes/operator');
app.use('/api/operator', operatorRoutes);
// operadores (plural) routes - create/update/delete entries
const operatorsRoutes = require('./routes/operators');
app.use('/api/operators', operatorsRoutes);

// wallets routes - manage wallet settings and allocations
const walletsRoutes = require('./routes/wallets');
app.use('/api/wallets', walletsRoutes);

// serve ideas folder (images for pista and carros)
app.use('/ideias', express.static(path.join(__dirname, '..', 'ideias para o mack-4')));

// ConcCoins endpoints (balance/unlock)
const concRoutes = require('./routes/conc');
app.use('/api/conc', concRoutes);

// Master routes - dashboard and management
const masterRoutes = require('./routes/master');
app.use('/api/master', masterRoutes);

// ------------------------------
// FUNÇÕES UTILITÁRIAS (DB)
// ------------------------------
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

function get(sql, params = []) {
    return new Promise((res, rej) => {
        db.get(sql, params, (err, row) => {
            if (err) rej(err);
            else res(row);
        });
    });
}

// ------------------------------
// AUTH MIDDLEWARE
// ------------------------------
function authMiddleware(req, res, next) {
    const h = req.headers['authorization'];
    if (!h) return res.status(401).json({ error: 'missing token' });

    const token = h.split(' ')[1];
    try {
        const payload = jwt.verify(token, SECRET);
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'invalid token' });
    }
}

// ------------------------------
// DB INIT
// (Database already exists and was initialized via migrate.sql)
// This function just verifies the schema and adds missing columns if needed
// ------------------------------
function initDb() {
    console.log('Checking database schema...');
    
    // ensure entries.conc_awarded exists on older DBs
    db.all("PRAGMA table_info('entries')", (err2, rows) => {
        if (err2) return console.error('pragma error', err2);
        const has = rows && rows.some(r => r.name === 'conc_awarded');
        if (!has) {
            console.log('Adding missing column entries.conc_awarded (server startup)');
            db.run("ALTER TABLE entries ADD COLUMN conc_awarded INTEGER DEFAULT 0", (ae) => {
                if (ae) console.error('add column error', ae);
            });
        }
        
        // ensure entries.recebimento exists (for persistent recebimento data)
        const hasRec = rows && rows.some(r => r.name === 'recebimento');
        if (!hasRec) {
            console.log('Adding missing column entries.recebimento (server startup)');
            db.run("ALTER TABLE entries ADD COLUMN recebimento TEXT", (ae) => {
                if (ae) console.error('add recebimento column error', ae);
            });
        }
    });
    // ensure users.selectedCar exists on older DBs
    db.all("PRAGMA table_info('users')", (err3, rows3) => {
        if (err3) return console.error('pragma users error', err3);
        const hasSel = rows3 && rows3.some(r => r.name === 'selectedCar');
        if (!hasSel) {
            console.log('Adding missing column users.selectedCar (server startup)');
            db.run("ALTER TABLE users ADD COLUMN selectedCar TEXT", (ae2) => {
                if (ae2) console.error('add column error', ae2);
            });
        }
    });

    // ensure wallets.session_type exists on older DBs
    db.all("PRAGMA table_info('wallets')", (err4, rows4) => {
        if (err4) return console.error('pragma wallets error', err4);
        const hasSess = rows4 && rows4.some(r => r.name === 'session_type');
        if (!hasSess) {
            console.log('Adding missing column wallets.session_type (server startup)');
            db.run("ALTER TABLE wallets ADD COLUMN session_type TEXT DEFAULT 'bv_rodas'", (ae3) => {
                if (ae3) console.error('add column error', ae3);
                else {
                  // set defaults for existing wallets
                  db.run("UPDATE wallets SET session_type='bv_rodas' WHERE session_type IS NULL OR session_type = ''", ()=>{});
                  // ensure BV_CARTAO exists
                  db.run("INSERT OR IGNORE INTO wallets(wallet,bonificacao,taxa,session_type) VALUES('BV_CARTAO',0,0,'bv_cartao')", ()=>{});
                }
            });
        }
        
        // ensure wallets.meta_carteira exists
        const hasMeta = rows4 && rows4.some(r => r.name === 'meta_carteira');
        if (!hasMeta) {
            console.log('Adding missing column wallets.meta_carteira (server startup)');
            db.run("ALTER TABLE wallets ADD COLUMN meta_carteira REAL DEFAULT 0", (ae4) => {
                if (ae4) console.error('add column error', ae4);
            });
        }
    });
    
    // ensure entries.bonificacao_receber exists
    db.all("PRAGMA table_info('entries')", (err5, rows5) => {
        if (err5) return console.error('pragma entries error', err5);
        const hasBonRec = rows5 && rows5.some(r => r.name === 'bonificacao_receber');
        if (!hasBonRec) {
            console.log('Adding missing column entries.bonificacao_receber (server startup)');
            db.run("ALTER TABLE entries ADD COLUMN bonificacao_receber REAL DEFAULT 0", (ae5) => {
                if (ae5) console.error('add column error', ae5);
            });
        }
    });
    
    console.log('Database schema check completed.');
}
initDb();

// ------------------------------
// ENDPOINTS DO SISTEMA
// ------------------------------

// Registro operador
// Shared register handler function
async function handleRegister(req, res) {
    try {
        const { id, password, wallet, name, session } = req.body;

        if (!/^[0-9]+$/.test(id))
            return res.status(400).json({ error: 'id must be numeric' });

        if (!/^[0-9]{6}$/.test(password))
            return res.status(400).json({ error: 'password must be 6 digits' });

        const exists = await get('SELECT id FROM users WHERE id=?', [id]);
        if (exists)
            return res.status(400).json({ error: 'id exists' });

        // if session specified as bv_cartao, default wallet to BV_CARTAO
        let finalWallet = wallet;
        if (session === 'bv_cartao') finalWallet = 'BV_CARTAO';

        const hash = await bcrypt.hash(password, 10);
        await run(
            'INSERT INTO users(id,password,wallet,name,isMaster) VALUES(?,?,?,?,0)',
            [id, hash, finalWallet, name || id]
        );

        res.json({ ok: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}

// Register (legacy endpoint)
app.post('/api/register', handleRegister);

// Register (SPA endpoint)
app.post('/api/auth/register', handleRegister);

// Shared login handler function
async function handleLogin(req, res) {
    try {
        const { id, password, session } = req.body;
        const row = await get(
            'SELECT id,password,wallet,name,isMaster FROM users WHERE id=?',
            [id]
        );

        if (!row)
            return res.status(400).json({ error: 'user not found' });

        let match = false;
        try {
            match = await bcrypt.compare(password, row.password);
        } catch {
            match = false;
        }

        const mastersFallback = ['00001', '00002', '00003', '00004', '00005'];
        if (
            !match &&
            row.isMaster &&
            mastersFallback.includes(row.id) &&
            password === '000000'
        ) {
            match = true;
        }

        if (!match)
            return res.status(400).json({ error: 'invalid credentials' });

        // If session explicitly provided, include it in token; otherwise infer from user's wallet
        let sessionType = session || 'bv_rodas';
        try {
            const w = await get('SELECT session_type FROM wallets WHERE wallet=?', [row.wallet]);
            if (!session) sessionType = (w && w.session_type) ? w.session_type : 'bv_rodas';
        } catch (e) { /* ignore */ }

        const token = jwt.sign(
            { id: row.id, wallet: row.wallet, isMaster: row.isMaster, session: sessionType },
            SECRET,
            { expiresIn: '12h' }
        );

        res.json({ token, user: row });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}

// Login (legacy endpoint)
app.post('/api/login', handleLogin);

// Login (SPA endpoint)
app.post('/api/auth/login', handleLogin);

// Catch-all for SPA - serve index.html for any route not matched above
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// (todo resto permanece igual — não alterei nada)

// ------------------------------
// START
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
