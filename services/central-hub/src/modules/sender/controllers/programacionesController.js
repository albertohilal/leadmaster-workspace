// Controlador para programaciones de campañas
// Funcionalidades inspiradas en whatsapp-massive-sender-V2
const connection = require('../db/connection');

const ESTADOS = ['pendiente', 'aprobada', 'rechazada', 'pausada'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function normalizeDays(dias) {
  if (Array.isArray(dias)) {
    return dias
      .map((d) => String(d || '').trim().toLowerCase())
      .filter((d) => DAY_KEYS.includes(d));
  }
  if (typeof dias === 'string') {
    return dias
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => DAY_KEYS.includes(d));
  }
  return [];
}

async function obtenerSesionCliente(clienteId) {
  const [rows] = await connection.query(
    'SELECT usuario FROM ll_usuarios WHERE cliente_id = ? LIMIT 1',
    [clienteId]
  );
  if (!rows.length) return null;
  return rows[0].usuario ? rows[0].usuario.toLowerCase() : null;
}

async function listarProgramaciones(req, res) {
  try {
    const tipo = req.user?.tipo || req.session?.tipo; // soporta JWT y sesiones legacy
    let sql = `
      SELECT p.*, c.nombre AS campania_nombre
      FROM ll_programaciones p
      LEFT JOIN ll_campanias_whatsapp c ON p.campania_id = c.id
    `;
    const params = [];
    const conditions = [];

    // Si es cliente, solo ve sus programaciones
    if (tipo === 'cliente') {
      const clienteId = req.user?.cliente_id || req.session?.cliente_id;
      conditions.push('p.cliente_id = ?');
      params.push(clienteId);
    } else if (tipo === 'admin') {
      const clienteId = req.query.cliente_id;
      if (clienteId) {
        conditions.push('p.cliente_id = ?');
        params.push(clienteId);
      }
    }

    if (req.query.estado && ESTADOS.includes(req.query.estado)) {
      conditions.push('p.estado = ?');
      params.push(req.query.estado);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY p.actualizado_en DESC';

    const [rows] = await connection.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error listando programaciones:', err);
    res.status(500).json({ error: 'Error al obtener programaciones' });
  }
}

async function crearProgramacion(req, res) {
  try {
    const {
      campania_id,
      dias_semana,
      hora_inicio,
      hora_fin,
      cupo_diario,
      fecha_inicio,
      fecha_fin,
      comentario
    } = req.body;

    const tipo = req.user?.tipo || req.session?.tipo;
    const sessionClienteId = tipo === 'cliente' ? (req.user?.cliente_id || req.session?.cliente_id) : null;
    const clienteId = sessionClienteId || req.body?.cliente_id;
    const creadoPor = req.user?.usuario || req.session?.usuario || 'desconocido';
    let sesionCliente = (req.user?.usuario || req.session?.usuario || '').toLowerCase() || null;

    if (!clienteId) {
      return res.status(400).json({ error: 'Falta cliente_id' });
    }
    if (!campania_id || !hora_inicio || !hora_fin || !fecha_inicio) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const diasNormalizados = normalizeDays(dias_semana);
    if (!diasNormalizados.length) {
      return res.status(400).json({ error: 'Selecciona al menos un día de la semana' });
    }

    // Validar que la campaña pertenece al cliente
    const [campanias] = await connection.query(
      'SELECT cliente_id FROM ll_campanias_whatsapp WHERE id = ?',
      [campania_id]
    );
    if (!campanias.length) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    if (Number(campanias[0].cliente_id) !== Number(clienteId)) {
      return res.status(403).json({ error: 'La campaña no pertenece al cliente seleccionado' });
    }

    if (!sesionCliente) {
      sesionCliente = await obtenerSesionCliente(clienteId);
    }

    const [result] = await connection.query(
      `INSERT INTO ll_programaciones
        (campania_id, cliente_id, dias_semana, hora_inicio, hora_fin, cupo_diario, fecha_inicio, fecha_fin, comentario_cliente, creado_por, sesion_cliente)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campania_id,
        clienteId,
        diasNormalizados.join(','),
        hora_inicio,
        hora_fin,
        cupo_diario || 50,
        fecha_inicio,
        fecha_fin || null,
        comentario || null,
        creadoPor,
        sesionCliente
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error creando programación:', err);
    res.status(500).json({ error: 'Error al crear programación' });
  }
}

module.exports = {
  listarProgramaciones,
  crearProgramacion
};
