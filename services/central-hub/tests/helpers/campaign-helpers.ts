import { test, expect } from '@playwright/test';

// Configuración para pruebas de campañas
const CAMPAIGN_TEST_CONFIG = {
  // URLs
  BACKEND_URL: process.env.BASE_URL || 'http://localhost:3011',
  FRONTEND_URL: 'http://localhost:5173',
  
  // Usuarios de prueba
  CLIENT_USER: {
    usuario: 'Haby',
    password: 'haby1973',
    expectedRole: 'cliente'
  },
  
  ADMIN_USER: {
    usuario: 'admin',
    password: 'admin123', 
    expectedRole: 'admin'
  },
  
  // Timeouts
  LOGIN_TIMEOUT: 5000,
  API_TIMEOUT: 3000,
  UI_TIMEOUT: 1000,
  
  // Datos de prueba para campañas
  SAMPLE_CAMPAIGN: {
    nombre: 'Campaña E2E Test',
    descripcion: 'Campaña creada por testing automatizado',
    mensaje: 'Este es un mensaje de prueba para E2E testing'
  },
  
  SAMPLE_PROGRAMACION: {
    dias_semana: ['mon', 'tue', 'wed'],
    hora_inicio: '09:00:00', 
    hora_fin: '17:00:00',
    cupo_diario: 100,
    fecha_inicio: '2025-12-20',
    comentario: 'Programación creada por E2E test'
  }
};

// Helper functions para reutilizar
export class CampaignTestHelpers {
  
  static async login(page, userType = 'client') {
    const user = userType === 'admin' ? CAMPAIGN_TEST_CONFIG.ADMIN_USER : CAMPAIGN_TEST_CONFIG.CLIENT_USER;
    
    await page.goto(`${CAMPAIGN_TEST_CONFIG.FRONTEND_URL}/login`);
    await page.fill('input[name="usuario"]', user.usuario);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/dashboard', { timeout: CAMPAIGN_TEST_CONFIG.LOGIN_TIMEOUT });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  static async getAuthToken(request, userType = 'client') {
    const user = userType === 'admin' ? CAMPAIGN_TEST_CONFIG.ADMIN_USER : CAMPAIGN_TEST_CONFIG.CLIENT_USER;
    
    const authResponse = await request.post(`${CAMPAIGN_TEST_CONFIG.BACKEND_URL}/auth/login`, {
      data: {
        usuario: user.usuario,
        password: user.password
      }
    });
    
    if (authResponse.ok()) {
      const authData = await authResponse.json();
      return authData.token;
    }
    return null;
  }
  
  static async navigateToCampaigns(page) {
    await page.goto(`${CAMPAIGN_TEST_CONFIG.FRONTEND_URL}/campaigns`);
    await page.waitForLoadState('networkidle');
  }
  
  static async createSampleCampaign(page) {
    await page.click('text=+ Nueva Campaña');
    await page.fill('input[placeholder*="Ej:"]', CAMPAIGN_TEST_CONFIG.SAMPLE_CAMPAIGN.nombre);
    await page.fill('textarea', CAMPAIGN_TEST_CONFIG.SAMPLE_CAMPAIGN.descripcion);
    await page.click('text=Guardar');
    await page.waitForTimeout(CAMPAIGN_TEST_CONFIG.UI_TIMEOUT);
  }
  
  static async fillProgramacionForm(page) {
    // Seleccionar días de la semana
    for (const day of CAMPAIGN_TEST_CONFIG.SAMPLE_PROGRAMACION.dias_semana) {
      const dayMap = {
        'mon': 'Lunes',
        'tue': 'Martes', 
        'wed': 'Miércoles',
        'thu': 'Jueves',
        'fri': 'Viernes',
        'sat': 'Sábado',
        'sun': 'Domingo'
      };
      
      if (dayMap[day]) {
        await page.check(`input[type="checkbox"][value="${day}"]`);
      }
    }
    
    // Llenar horarios
    await page.fill('input[type="time"]:first-of-type', '09:00');
    await page.fill('input[type="time"]:last-of-type', '17:00');
    
    // Configurar cupo
    await page.fill('input[type="number"]', CAMPAIGN_TEST_CONFIG.SAMPLE_PROGRAMACION.cupo_diario.toString());
    
    // Fecha de inicio
    await page.fill('input[type="date"]:first-of-type', CAMPAIGN_TEST_CONFIG.SAMPLE_PROGRAMACION.fecha_inicio);
  }
  
  static async verifyUserRole(page, expectedRole) {
    if (expectedRole === 'admin') {
      await expect(page.locator('text=👑 Panel Administrador')).toBeVisible();
      await expect(page.locator('text=Administra y envía campañas')).toBeVisible();
    } else {
      await expect(page.locator('text=👑 Panel Administrador')).not.toBeVisible();
      await expect(page.locator('text=Administra tus envíos masivos')).toBeVisible();
    }
  }
  
  static async verifyPermissions(page, userRole) {
    if (userRole === 'admin') {
      // Admin puede enviar campañas
      await expect(page.locator('text=🚀 Enviar Campaña')).toBeVisible();
      await expect(page.locator('text=Lista para enviar')).toBeVisible();
    } else {
      // Cliente NO puede enviar campañas
      await expect(page.locator('text=🚀 Enviar Campaña')).not.toBeVisible();
      await expect(page.locator('text=Pendiente Aprobación')).toBeVisible();
    }
  }
  
  static async openStatisticsModal(page) {
    await page.click('text=Ver Estadísticas');
    await expect(page.locator('text=Estadísticas de Campaña')).toBeVisible();
    
    // Verificar métricas esperadas
    const expectedMetrics = [
      'Total Destinatarios',
      'Enviados',
      'Fallidos', 
      'Tasa de Éxito'
    ];
    
    for (const metric of expectedMetrics) {
      await expect(page.locator(`text=${metric}`)).toBeVisible();
    }
  }
  
  static async closeModal(page, method = 'button') {
    if (method === 'button') {
      await page.click('button:has-text("×")');
    } else if (method === 'escape') {
      await page.keyboard.press('Escape');
    }
    
    // Verificar que se cerró
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  }
  
  static async verifyResponsiveness(page) {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Verificar elementos principales visibles
      await expect(page.locator('h1')).toBeVisible();
      
      if (viewport.name !== 'mobile') {
        await expect(page.locator('text=Nueva Programación')).toBeVisible();
      }
    }
  }
  
  static async testApiEndpoint(request, endpoint, method = 'GET', data = null, requiresAuth = true) {
    let headers = {};
    
    if (requiresAuth) {
      const token = await this.getAuthToken(request);
      if (!token) {
        throw new Error('No se pudo obtener token de autenticación');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = `${CAMPAIGN_TEST_CONFIG.BACKEND_URL}${endpoint}`;
    let response;
    
    switch (method.toUpperCase()) {
      case 'GET':
        response = await request.get(url, { headers });
        break;
      case 'POST':
        response = await request.post(url, { headers, data });
        break;
      case 'PUT':
        response = await request.put(url, { headers, data });
        break;
      case 'DELETE':
        response = await request.delete(url, { headers });
        break;
      default:
        throw new Error(`Método HTTP no soportado: ${method}`);
    }
    
    return response;
  }
}

export { CAMPAIGN_TEST_CONFIG, test, expect };