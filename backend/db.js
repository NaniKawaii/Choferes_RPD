require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'root'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`;

const pool = new Pool({ connectionString });

pool.on('error', (err) => {
  console.error('Unexpected idle client error', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  ensureSchema: async () => {
    const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    await pool.query(sql);
  },
};
