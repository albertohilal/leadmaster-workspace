// Configuración centralizada de la URL base de la API
const normalizeProtocol = (url) => {
  if (typeof window === 'undefined') {
    return url;
  }

  // Evita contenido mixto forzando https si la app se sirve en https
  if (window.location.protocol === 'https:' && url.startsWith('http://')) {
    return url.replace(/^http:\/\//i, 'https://');
  }

  return url;
};

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) {
    return normalizeProtocol(envUrl);
  }

  if (typeof window !== 'undefined') {
    return normalizeProtocol(window.location.origin);
  }

  return 'http://localhost:3012';
};

export const API_BASE_URL = getBaseUrl();

export const buildApiUrl = (path = '') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};
