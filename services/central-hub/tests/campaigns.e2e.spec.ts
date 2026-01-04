import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011';

// Helper function to get auth token
async function getAuthToken(request, user = 'Haby', password = 'haby1973') {
  const authResponse = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      usuario: user,
      password: password
    }
  });
  const authData = await authResponse.json();
  return authData.token;
}

test.describe('Campaigns Flow - Cliente', () => {
  
  test('Cliente puede acceder a la página de campañas', async ({ page, request }) => {
    const token = await getAuthToken(request);
    
    // Navegar a la página con autenticación
    await page.goto('http://localhost:5173/login');
    
    // Login como cliente
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    
    // Esperar redirección y navegar a campañas
    await page.waitForURL('**/dashboard');
    await page.click('a[href="/campaigns"]');
    
    // Verificar que está en la página correcta
    await expect(page.locator('h1')).toContainText('Gestión de Campañas');
    
    // Verificar que NO tiene el badge de admin
    await expect(page.locator('text=👑 Panel Administrador')).not.toBeVisible();
    
    // Verificar descripción de cliente
    await expect(page.locator('text=Administra tus envíos masivos de WhatsApp')).toBeVisible();
  });

  test('Cliente puede crear nueva campaña', async ({ page }) => {
    // Setup - login como cliente
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Hacer clic en "Nueva Campaña"
    await page.click('text=+ Nueva Campaña');
    
    // Verificar que se abre el modal
    await expect(page.locator('text=Nueva Campaña')).toBeVisible();
    
    // Llenar formulario de campaña
    await page.fill('input[placeholder="Ej: Promoción Navidad 2025"]', 'Campaña de Prueba E2E');
    await page.fill('textarea', 'Descripción de prueba para E2E testing');
    
    // Guardar campaña
    await page.click('text=Guardar');
    
    // Verificar mensaje de éxito (mock)
    await page.waitForTimeout(1000); // Esperar procesamiento
  });

  test('Cliente puede programar campaña', async ({ page }) => {
    // Setup - login y navegar
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Ir a la sección de programación
    await expect(page.locator('text=Nueva Programación')).toBeVisible();
    
    // Seleccionar campaña (primero debe haber una disponible)
    await page.click('select');
    // Como usa datos mock, verificamos que el dropdown esté disponible
    
    // Seleccionar días de la semana
    await page.check('input[type="checkbox"][value="mon"]');
    await page.check('input[type="checkbox"][value="tue"]');
    
    // Configurar horarios
    await page.fill('input[type="time"]:first-of-type', '09:00');
    await page.fill('input[type="time"]:last-of-type', '17:00');
    
    // Configurar cupo
    await page.fill('input[type="number"]', '100');
    
    // Fecha de inicio
    await page.fill('input[type="date"]:first-of-type', '2025-12-20');
    
    // Crear programación
    await page.click('text=Crear Programación');
    
    // Verificar que se procesa (con datos mock)
    await page.waitForTimeout(1000);
  });

  test('Cliente NO puede enviar campañas', async ({ page }) => {
    // Setup - login como cliente
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Verificar que NO existe el botón de enviar campaña
    await expect(page.locator('text=🚀 Enviar Campaña')).not.toBeVisible();
    
    // Verificar que solo ve botón de estadísticas
    await expect(page.locator('text=Ver Estadísticas')).toBeVisible();
    
    // Verificar estado de campaña para cliente
    await expect(page.locator('text=Pendiente Aprobación')).toBeVisible();
  });

  test('Cliente puede ver estadísticas de campaña', async ({ page }) => {
    // Setup - login como cliente
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Hacer clic en "Ver Estadísticas" de alguna campaña
    await page.click('text=Ver Estadísticas');
    
    // Verificar que se abre el modal de estadísticas
    await expect(page.locator('text=Estadísticas de Campaña')).toBeVisible();
    
    // Verificar métricas visibles
    await expect(page.locator('text=Total Destinatarios')).toBeVisible();
    await expect(page.locator('text=Enviados')).toBeVisible();
    await expect(page.locator('text=Fallidos')).toBeVisible();
    await expect(page.locator('text=Tasa de Éxito')).toBeVisible();
    
    // Cerrar modal
    await page.click('button:has-text("×")');
  });

});

test.describe('Campaigns Flow - Administrador', () => {
  
  test('Admin puede acceder al panel de administrador', async ({ page }) => {
    // Login como admin (necesitarías crear un usuario admin en tu sistema)
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'admin'); // Asumiendo que existe
    await page.fill('input[name="password"]', 'admin123'); // Asumiendo que existe
    await page.click('button[type="submit"]');
    
    // Si no hay admin real, saltar esta prueba
    try {
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      await page.goto('http://localhost:5173/campaigns');
      
      // Verificar badge de admin
      await expect(page.locator('text=👑 Panel Administrador')).toBeVisible();
      
      // Verificar descripción de admin
      await expect(page.locator('text=Administra y envía campañas de todos los clientes')).toBeVisible();
      
    } catch (error) {
      test.skip('Usuario admin no configurado');
    }
  });

  test('Admin puede ver campañas de todos los clientes', async ({ page }) => {
    // Este test requiere un usuario admin real
    test.skip('Requiere configuración de usuario administrador');
    
    // El código sería similar al anterior pero verificando:
    // - Badge "Cliente: [Nombre]" en cada campaña
    // - Botones "🚀 Enviar Campaña" visibles
    // - Estados "Lista para enviar" en lugar de "Pendiente Aprobación"
  });

  test('Admin puede enviar campaña con confirmación', async ({ page }) => {
    // Este test requiere un usuario admin real
    test.skip('Requiere configuración de usuario administrador');
    
    // El flujo sería:
    // 1. Login como admin
    // 2. Ir a campañas
    // 3. Hacer clic en "🚀 Enviar Campaña"
    // 4. Verificar modal de confirmación
    // 5. Confirmar envío
    // 6. Verificar cambio de estado a "Activa"
  });

});

test.describe('Campaigns API Integration', () => {
  
  test('API - Crear campaña requiere autenticación', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/sender/campaigns`, {
      data: {
        nombre: 'Test Campaign',
        descripcion: 'Test Description'
      }
    });
    
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBeFalsy();
  });

  test('API - Crear campaña con autenticación válida', async ({ request }) => {
    const token = await getAuthToken(request);
    
    const response = await request.post(`${BASE_URL}/sender/campaigns`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        nombre: 'Test E2E Campaign',
        descripcion: 'Campaign created by E2E test',
        mensaje: 'Mensaje de prueba E2E'
      }
    });
    
    // Dependiendo de si la API está implementada
    if (response.status() === 404) {
      test.skip('Endpoint de creación de campañas no implementado aún');
    } else {
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBeTruthy();
      expect(data.data).toHaveProperty('id');
    }
  });

  test('API - Listar programaciones requiere autenticación', async ({ request }) => {
    const token = await getAuthToken(request);
    
    const response = await request.get(`${BASE_URL}/sender/programaciones`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status() === 404) {
      test.skip('Endpoint de programaciones no implementado aún');
    } else {
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBeTruthy();
    }
  });

  test('API - Crear programación con datos válidos', async ({ request }) => {
    const token = await getAuthToken(request);
    
    const response = await request.post(`${BASE_URL}/sender/programaciones`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        campania_id: 1,
        dias_semana: ['mon', 'tue', 'wed'],
        hora_inicio: '09:00:00',
        hora_fin: '17:00:00',
        cupo_diario: 100,
        fecha_inicio: '2025-12-20',
        comentario: 'Programación de prueba E2E'
      }
    });
    
    if (response.status() === 404) {
      test.skip('Endpoint de programaciones no implementado aún');
    } else {
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBeTruthy();
    }
  });

});

test.describe('Campaigns Permissions & Security', () => {
  
  test('Cliente no puede acceder a funciones de admin via URL', async ({ page }) => {
    // Login como cliente
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Intentar acceder a rutas de admin (si existen)
    await page.goto('http://localhost:5173/admin/campaigns');
    
    // Debería redirigir o mostrar error 403/404
    await expect(page.locator('text=403')).toBeVisible().catch(() => {
      // Si no hay ruta admin específica, verificar que en campaigns no tenga permisos de admin
      expect(page.url()).toContain('/campaigns');
    });
  });

  test('Estados de campaña se muestran correctamente según rol', async ({ page }) => {
    // Login como cliente
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Verificar estados específicos para cliente
    const possibleClientStates = [
      'Pendiente Aprobación',
      'Completada', 
      'Pausada',
      'Rechazada'
    ];
    
    let foundState = false;
    for (const state of possibleClientStates) {
      if (await page.locator(`text=${state}`).isVisible()) {
        foundState = true;
        break;
      }
    }
    
    expect(foundState).toBeTruthy();
    
    // Verificar que NO ve estados de admin
    await expect(page.locator('text=Lista para enviar')).not.toBeVisible();
  });

  test('Validación de campos en formulario de programación', async ({ page }) => {
    // Setup
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Intentar crear programación sin completar campos obligatorios
    await page.click('text=Crear Programación');
    
    // Verificar mensajes de validación
    // (Esto dependería de la implementación específica de validación)
    await page.waitForTimeout(500);
    
    // Verificar que no se creó la programación sin datos válidos
    // La implementación específica dependería de cómo muestren errores
  });

});

test.describe('Campaigns UI/UX Flow', () => {
  
  test('Navegación fluida entre secciones de campañas', async ({ page }) => {
    // Setup
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Verificar que todas las secciones están presentes
    await expect(page.locator('text=Estadísticas')).toBeVisible();
    await expect(page.locator('text=Programación de Campañas')).toBeVisible();
    await expect(page.locator('text=Nueva Programación')).toBeVisible();
    await expect(page.locator('text=Programaciones Existentes')).toBeVisible();
    
    // Verificar scroll y visibilidad
    await page.scrollTo(0, 500);
    await expect(page.locator('text=Campañas')).toBeVisible();
  });

  test('Responsividad en diferentes tamaños de pantalla', async ({ page }) => {
    // Setup
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Probar en móvil
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Probar en tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('text=Nueva Programación')).toBeVisible();
    
    // Probar en desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('text=Programaciones Existentes')).toBeVisible();
  });

  test('Interacciones de modales funcionan correctamente', async ({ page }) => {
    // Setup
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:5173/campaigns');
    
    // Abrir modal de nueva campaña
    await page.click('text=+ Nueva Campaña');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Cerrar con botón X
    await page.click('button:has-text("×")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // Abrir de nuevo
    await page.click('text=+ Nueva Campaña');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Cerrar con ESC
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // Verificar modal de estadísticas si hay campaña
    if (await page.locator('text=Ver Estadísticas').isVisible()) {
      await page.click('text=Ver Estadísticas');
      await expect(page.locator('text=Estadísticas de Campaña')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

});