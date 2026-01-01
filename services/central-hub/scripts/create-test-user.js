// Script para crear usuario de prueba
const bcrypt = require('bcrypt');
const pool = require('./src/config/db');

async function createTestUser() {
  try {
    // Hash de la contraseña "123456"
    const password = '123456';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    console.log('Password hasheado:', hashedPassword);
    
    // Insertar usuario de prueba
    const query = `
      INSERT INTO ll_usuarios (usuario, password_hash, cliente_id, tipo, activo, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        activo = VALUES(activo)
    `;
    
    const [result] = await pool.query(query, [
      'admin',
      hashedPassword,
      1, // cliente_id
      'admin',
      1
    ]);
    
    console.log('Usuario creado/actualizado:', result);
    
    // Crear también usuario haby1973
    const [result2] = await pool.query(query, [
      'haby1973',
      hashedPassword,
      1, // cliente_id
      'admin',
      1
    ]);
    
    console.log('Usuario haby1973 creado/actualizado:', result2);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUser();