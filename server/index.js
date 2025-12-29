const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Conexão com o Banco
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// 2. Inicialização do Banco
const initDB = async () => {
  const MAX_RETRIES = 10;
  let retries = 0;
  let dbConnected = false;

  while (retries < MAX_RETRIES && !dbConnected) {
    try {
      console.log(`Tentando conectar ao banco de dados... (Tentativa ${retries + 1}/${MAX_RETRIES})`);
      // Use a simple query to check connection
      await pool.query('SELECT 1 + 1 AS solution');

      // --- TABELA DE USUÁRIOS ---
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(200) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          department VARCHAR(100),
          is_active BOOLEAN DEFAULT true
        );
      `);
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`); } catch (e) {}

      // Cria ADMIN padrão
      const userCheck = await pool.query('SELECT * FROM users LIMIT 1');
      if (userCheck.rows.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'Mudar@123', salt);
        await pool.query(`INSERT INTO users (name, email, password, role, department, is_active) VALUES ($1, $2, $3, $4, $5, $6)`, 
          ['Admin Sistema', 'admin@grupond.com.br', hash, 'ADM_MASTER', 'TI', true]);
        console.log('Admin padrão criado.');
      }

      // --- TABELA DE ESTOQUE ---
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          sku VARCHAR(50) UNIQUE NOT NULL,
          category VARCHAR(100),
          current_qty INTEGER DEFAULT 0,
          min_qty INTEGER DEFAULT 5,
          price NUMERIC(10, 2) DEFAULT 0.00,
          unit VARCHAR(20) DEFAULT 'UN',
          status VARCHAR(50)
        );
      `);

      // --- TABELA DE PEDIDOS (FALTAVA ISSO!) ---
      await pool.query(`
        CREATE TABLE IF NOT EXISTS requests (
          id SERIAL PRIMARY KEY,
          item_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
          custom_item_name VARCHAR(150),
          custom_category VARCHAR(100),
          requester_id INTEGER,
          requester_name VARCHAR(100),
          quantity INTEGER NOT NULL,
          unit_price NUMERIC(10, 2) DEFAULT 0.00,
          observation TEXT,
          status VARCHAR(50) DEFAULT 'PENDENTE',
          rejection_reason TEXT,
          date DATE DEFAULT CURRENT_DATE
        );
      `);
      
      console.log('Banco de Dados conectado e tabelas verificadas.');
      dbConnected = true;

    } catch (err) {
      console.error('Erro ao inicializar banco (tentativa falhou):', err.message);
      retries++;
      if (retries < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, 5000)); // Wait 5 seconds before retrying
      } else {
        console.error('Número máximo de tentativas de conexão ao banco de dados atingido. Encerrando.');
        process.exit(1); // Exit process if cannot connect after max retries
      }
    }
  }
};

initDB();

// --- ROTAS DA API ---

// === USUÁRIOS ===
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];
    if (!user.is_active) return res.status(401).json({ error: 'Usuário desativado.' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Senha incorreta' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department });
  } catch (err) { res.status(500).json({ error: 'Erro no servidor' }); }
});

app.get('/api/users', async (req, res) => {
  try { const r = await pool.query('SELECT id, name, email, role, department, is_active FROM users ORDER BY id ASC'); res.json(r.rows); } 
  catch (err) { res.status(500).json({ error: 'Erro ao buscar usuários' }); }
});

app.post('/api/users', async (req, res) => {
  const { name, email, password, role, department } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const r = await pool.query('INSERT INTO users (name, email, password, role, department, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, email, role, department', [name, email, hash, role, department]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.code === '23505' ? 'Email duplicado' : 'Erro ao criar' }); }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, department, is_active } = req.body;
  try { await pool.query('UPDATE users SET name = $1, role = $2, department = $3, is_active = $4 WHERE id = $5', [name, role, department, is_active, id]); res.json({ message: 'Atualizado' }); }
  catch (err) { res.status(500).json({ error: 'Erro ao atualizar' }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try { await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]); res.json({ message: 'Removido' }); } 
  catch (err) { res.status(500).json({ error: 'Erro ao remover' }); }
});

// === ESTOQUE ===
app.get('/api/inventory', async (req, res) => {
  try { const r = await pool.query('SELECT * FROM inventory ORDER BY id ASC'); res.json(r.rows); } 
  catch (err) { res.status(500).json({ error: 'Erro ao buscar estoque' }); }
});

app.post('/api/inventory', async (req, res) => {
  const { name, sku, category, current_qty, min_qty, price, unit } = req.body;
  const status = Number(current_qty) <= Number(min_qty) ? 'Crítico' : 'Normal';
  try {
    const r = await pool.query(`INSERT INTO inventory (name, sku, category, current_qty, min_qty, price, unit, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [name, sku, category, current_qty, min_qty, price, unit, status]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('Erro em POST /api/inventory:', err);
    res.status(500).json({ error: 'Erro ao criar item', details: err.message, code: err.code });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, current_qty, min_qty, price, unit } = req.body;
  const status = Number(current_qty) <= Number(min_qty) ? 'Crítico' : 'Normal';
  try {
    const r = await pool.query(`UPDATE inventory SET name=$1, category=$2, current_qty=$3, min_qty=$4, price=$5, unit=$6, status=$7 WHERE id=$8 RETURNING *`, [name, category, current_qty, min_qty, price, unit, status, id]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar item' }); }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try { await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]); res.json({ message: 'Item removido' }); } 
  catch (err) { res.status(500).json({ error: 'Erro ao remover item' }); }
});

// === PEDIDOS (FALTAVA ISSO!) ===

// 1. Listar
app.get('/api/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar pedidos' }); }
});

// 2. Criar
app.post('/api/requests', async (req, res) => {
  const { item_id, custom_item_name, custom_category, requester_id, requester_name, quantity, unit_price, observation } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO requests (item_id, custom_item_name, custom_category, requester_id, requester_name, quantity, unit_price, observation, status, date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDENTE', CURRENT_DATE) RETURNING *`,
      [item_id || null, custom_item_name, custom_category, requester_id, requester_name, quantity, unit_price, observation]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro em POST /api/requests:', err);
    res.status(500).json({ error: 'Erro ao criar pedido', details: err.message, code: err.code });
  }
});

// 3. Atualizar (Aprovar/Rejeitar)
app.put('/api/requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason, item_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE requests SET status=$1, rejection_reason=$2, item_id=COALESCE($3, item_id) WHERE id=$4 RETURNING *`,
      [status, rejection_reason, item_id, id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar pedido' }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});