// =======================================================
// Central Hub – API CONFIG (PRODUCTION SAFE)
// =======================================================

// Base URL viene desde Vite env
// En producción: VITE_API_URL=/api
// En local: http://localhost:3012

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3012';
