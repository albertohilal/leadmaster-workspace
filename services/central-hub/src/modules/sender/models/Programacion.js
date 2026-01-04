// Modelo de Programacion (franja horaria de campaña)
// Este archivo define la estructura de una programación de campaña

// Si usas ORM, define aquí el modelo. Si es SQL puro, define el esquema esperado como referencia.

/*
  Tabla sugerida: programaciones
  - id
  - campania_id
  - dias_semana (string, ej: "mon,tue,wed")
  - hora_inicio (string, ej: "09:00")
  - hora_fin (string, ej: "13:00")
  - cupo_diario (int)
  - fecha_inicio (date)
  - fecha_fin (date|null)
  - estado (string: pendiente, aprobada, etc)
  - comentario_cliente (string|null)
  - creado_por (string)
  - sesion_cliente (string|null)
*/

// Aquí solo referencia, la lógica va en controller/service
module.exports = {};
