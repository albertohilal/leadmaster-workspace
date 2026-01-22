/**
 * Playwright E2E - WhatsApp Smoke Test (Producción - Contabo VPS)
 * 
 * Contexto:
 * - Ejecuta en VPS Contabo (headless, sin GUI)
 * - Frontend servido por Nginx en producción
 * - Backend y Session Manager corriendo con PM2
 * 
 * Objetivo: Validar flujo básico de login y visualización de estado de WhatsApp
 * 
 * Requisitos:
 * - Variables de entorno: E2E_BASE_URL, E2E_USER, E2E_PASS
 * - URL productiva: https://desarrolloydisenioweb.com.ar
 * - No automatiza escaneo de QR
 * - Acepta cualquier estado válido de WhatsApp
 * - Compatible con headless mode (sin display gráfico)
 * 
 * Ejecución:
 * E2E_BASE_URL=https://desarrolloydisenioweb.com.ar \
 * E2E_USER=admin \
 * E2E_PASS=tu_password \
 * npx playwright test --project="E2E Tests - WhatsApp"
 */

const { test, expect } = require('@playwright/test');

// Configuración desde variables de entorno (PRODUCCIÓN)
const BASE_URL = process.env.E2E_BASE_URL;
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;

// Estados válidos de WhatsApp
const VALID_STATES = ['READY', 'QR_REQUIRED', 'DISCONNECTED', 'CONNECTING'];

test.describe('WhatsApp - Smoke Test (Producción)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Validar configuración
    if (!BASE_URL) {
      throw new Error('E2E_BASE_URL no configurado. Setear URL de producción: https://desarrolloydisenioweb.com.ar');
    }
    if (!USER || !PASS) {
      throw new Error('Credenciales E2E no configuradas. Setear E2E_USER y E2E_PASS');
    }
    
    // Configurar timeouts para entorno productivo
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(30000);
  });

  test('debe permitir login y mostrar estado de WhatsApp', async ({ page }) => {

    // PASO 1: Navegar a la aplicación productiva
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log(`✓ Navegando a: ${BASE_URL}`);

    // PASO 2: Esperar y completar formulario de login
    // En producción, el formulario puede tardar en cargar (React build + Nginx)
    try {
      await page.waitForSelector('form, [data-testid="login-form"], input[type="password"]', { 
        timeout: 15000,
        state: 'visible'
      });
      console.log('✓ Formulario de login visible');
    } catch (error) {
      // Si no encuentra el formulario, puede que ya esté logueado (sesión activa)
      const isLoggedIn = await page.locator('a[href*="whatsapp"], [data-testid="nav-whatsapp"]').count() > 0;
      if (isLoggedIn) {
        console.log('✓ Sesión ya activa, saltando login');
        // Ir directamente al paso de navegación a WhatsApp
        const whatsappLink = page.locator('a[href*="whatsapp"], [data-testid="nav-whatsapp"]').first();
        await whatsappLink.click();
        await page.waitForLoadState('networkidle');
        
        // Saltar al paso de validación de estado
        const statusElement = page.locator(
          '[data-testid="whatsapp-status"], [class*="status"], [class*="estado"], div:has-text("READY"), div:has-text("DISCONNECTED"), div:has-text("QR"), div:has-text("CONNECTING")'
        ).first();
        
        await expect(statusElement).toBeVisible({ timeout: 10000 });
        const statusText = await statusElement.textContent();
        console.log(`✓ Estado WhatsApp: ${statusText}`);
        
        const hasValidState = VALID_STATES.some(state => 
          statusText.toUpperCase().includes(state)
        );
        expect(hasValidState).toBeTruthy();
        console.log('✅ Test completado (sesión preexistente)');
        return; // Terminar el test exitosamente
      }
      throw error; // Si no hay sesión ni formulario, fallar
    }

    // Llenar campos de usuario y contraseña
    // Estrategia: intentar múltiples selectores en orden de preferencia
    const usernameField = page.locator(
      '[data-testid="username-input"], ' +
      '[data-testid="email-input"], ' +
      'input[name="username"], ' +
      'input[name="email"], ' +
      'input[type="text"]:visible, ' +
      'input[type="email"]:visible'
    ).first();
    
    const passwordField = page.locator(
      '[data-testid="password-input"], ' +
      'input[name="password"], ' +
      'input[type="password"]:visible'
    ).first();
    
    // Esperar que los campos sean interactivos
    await usernameField.waitFor({ state: 'visible', timeout: 5000 });
    await passwordField.waitFor({ state: 'visible', timeout: 5000 });
    
    await usernameField.fill(USER);
    await passwordField.fill(PASS);
    console.log('✓ Credenciales ingresadas');

    // Hacer clic en botón de login
    const loginButton = page.locator(
      '[data-testid="login-button"], ' +
      '[data-testid="submit-button"], ' +
      'button[type="submit"]:visible, ' +
      'button:has-text("Iniciar"), ' +
      'button:has-text("Login"), ' +
      'button:has-text("Entrar")'
    ).first();
    
    await loginButton.click();
    console.log('✓ Click en botón de login');

    // PASO 3: Esperar navegación post-login (entorno productivo)
    // En producción, puede haber redirección, carga de chunks, etc.
    try {
      // Opción 1: Esperar cambio de URL
      await page.waitForURL(/dashboard|home|campanas|whatsapp|app/, { 
        timeout: 20000 
      });
      console.log('✓ Login exitoso - redirección detectada');
    } catch {
      // Opción 2: Esperar que desaparezca el formulario
      try {
        await page.waitForSelector('form, [data-testid="login-form"]', { 
          state: 'hidden', 
          timeout: 10000 
        });
        console.log('✓ Login exitoso - formulario oculto');
      } catch {
        // Opción 3: Verificar que aparezca navegación
        const navExists = await page.locator(
          'nav, [role="navigation"], [data-testid="main-nav"]'
        ).count() > 0;
        
        if (navExists) {
          console.log('✓ Login exitoso - navegación visible');
        } else {
          throw new Error('Login no completado - no se detectó navegación exitosa');
        }
      }
    }
    
    // Esperar que la página cargue completamente
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // PASO 4: Navegar a la vista de WhatsApp
    // Buscar enlace de navegación a WhatsApp con múltiples estrategias
    const whatsappLink = page.locator(
      'a[href*="whatsapp"], ' +
      '[data-testid="nav-whatsapp"], ' +
      'a:has-text("WhatsApp"), ' +
      '[role="link"]:has-text("WhatsApp")'
    ).first();
    
    // Verificar que el enlace existe y es visible
    await expect(whatsappLink).toBeVisible({ timeout: 15000 });
    console.log('✓ Enlace de WhatsApp encontrado');
    
    await whatsappLink.click();
    console.log('✓ Navegando a vista WhatsApp');

    // Esperar a que la vista de WhatsApp cargue completamente
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // PASO 5: Validar que el estado de WhatsApp se renderiza
    // Buscar elemento que muestra el estado con selectores robustos
    const statusElement = page.locator(
      '[data-testid="whatsapp-status"], ' +
      '[data-testid="status"], ' +
      '[class*="status"], ' +
      '[class*="estado"], ' +
      '[class*="connection-status"], ' +
      'div:has-text("READY"), ' +
      'div:has-text("DISCONNECTED"), ' +
      'div:has-text("QR"), ' +
      'div:has-text("CONNECTING")'
    ).first();

    await expect(statusElement).toBeVisible({ timeout: 15000 });
    console.log('✓ Elemento de estado de WhatsApp visible');

    // Obtener el texto del estado
    const statusText = await statusElement.textContent();
    console.log(`✓ Estado detectado: "${statusText}"`);

    // PASO 6: Validar que el estado es uno de los válidos
    // Buscar si alguno de los estados válidos está presente en el texto
    const hasValidState = VALID_STATES.some(state => 
      statusText.toUpperCase().includes(state)
    );

    if (!hasValidState) {
      console.error(`⚠️  Estado detectado "${statusText}" no coincide con estados válidos: ${VALID_STATES.join(', ')}`);
    }
    
    expect(hasValidState).toBeTruthy();
    console.log(`✓ Estado válido confirmado: ${statusText}`);

    // PASO 7: Validación adicional - verificar que la UI responde al estado
    // Si el estado es READY, debería haber botones/acciones disponibles
    if (statusText.toUpperCase().includes('READY')) {
      const sendButton = page.locator(
        '[data-testid="send-message-button"], ' +
        '[data-testid="send-button"], ' +
        'button:has-text("Enviar")'
      ).first();
      
      // Solo verificar que existe, no hacer clic
      const sendButtonExists = await sendButton.count() > 0;
      if (sendButtonExists) {
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        console.log('✓ Estado READY: botón de envío visible');
      } else {
        console.log('⚠️  Estado READY pero botón de envío no encontrado (puede ser normal según UI)');
      }
    }

    // Si el estado es QR_REQUIRED, debería haber elemento de QR
    if (statusText.toUpperCase().includes('QR')) {
      const qrElement = page.locator(
        '[data-testid="qr-code"], ' +
        '[data-testid="qr-container"], ' +
        'img[alt*="QR"], ' +
        'canvas, ' +
        '[class*="qr"]'
      ).first();
      
      // Verificar que existe el elemento de QR (puede ser canvas, img, etc)
      const qrExists = await qrElement.count() > 0;
      if (qrExists) {
        console.log('✓ Estado QR_REQUIRED: elemento QR detectado');
      } else {
        console.log('⚠️  Estado QR_REQUIRED pero elemento QR no encontrado (puede estar cargando)');
      }
    }

    // Si el estado es DISCONNECTED, debería haber botón de conectar
    if (statusText.toUpperCase().includes('DISCONNECTED')) {
      const connectButton = page.locator(
        '[data-testid="connect-button"], ' +
        '[data-testid="reconnect-button"], ' +
        'button:has-text("Conectar")'
      ).first();
      
      // Solo verificar que existe
      const connectExists = await connectButton.count() > 0;
      if (connectExists) {
        console.log('✓ Estado DISCONNECTED: botón de conectar visible');
      } else {
        console.log('⚠️  Estado DISCONNECTED pero botón de conectar no encontrado');
      }
    }

    // PASO 8: Captura de pantalla para evidencia (producción)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `test-results/whatsapp-prod-${timestamp}.png`;
    
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`✓ Screenshot capturado: ${screenshotPath}`);

    console.log('✅ Test completado exitosamente en producción');
  });

  test('debe manejar error de credenciales inválidas', async ({ page }) => {
    
    // PASO 1: Navegar a la aplicación
    await page.goto(BASE_URL);

    // PASO 2: Intentar login con credenciales incorrectas
    await page.waitForSelector('form, [data-testid="login-form"]');

    const usernameField = page.locator('[data-testid="username-input"], input[name="username"], input[type="text"]').first();
    const passwordField = page.locator('[data-testid="password-input"], input[name="password"], input[type="password"]').first();
    
    await usernameField.fill('usuario_invalido');
    await passwordField.fill('password_invalido');

    const loginButton = page.locator('[data-testid="login-button"], button[type="submit"]').first();
    await loginButton.click();

    // PASO 3: Verificar que se muestra mensaje de error
    const errorMessage = page.locator(
      '[data-testid="error-message"], [class*="error"], [role="alert"]'
    ).first();

    // Esperar a que aparezca el mensaje de error
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    console.log('✓ Mensaje de error mostrado correctamente');

    // Verificar que NO se realizó la navegación
    const currentUrl = page.url();
    expect(currentUrl).toContain(BASE_URL);
    console.log('✓ Usuario permanece en página de login');
  });

  test('debe permitir logout desde vista WhatsApp', async ({ page }) => {
    
    if (!USER || !PASS) {
      throw new Error('Credenciales E2E no configuradas');
    }

    // Login exitoso
    await page.goto(BASE_URL);
    await page.waitForSelector('form, [data-testid="login-form"]');
    
    await page.locator('[data-testid="username-input"], input[name="username"], input[type="text"]').first().fill(USER);
    await page.locator('[data-testid="password-input"], input[name="password"], input[type="password"]').first().fill(PASS);
    await page.locator('[data-testid="login-button"], button[type="submit"]').first().click();
    
    await page.waitForLoadState('networkidle');

    // Navegar a WhatsApp
    const whatsappLink = page.locator('a[href*="whatsapp"], [data-testid="nav-whatsapp"]').first();
    await whatsappLink.click();
    await page.waitForLoadState('networkidle');

    // Buscar botón de logout
    const logoutButton = page.locator(
      '[data-testid="logout-button"], button:has-text("Salir"), button:has-text("Cerrar sesión")'
    ).first();

    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    await logoutButton.click();
    console.log('✓ Click en logout');

    // Verificar redirección a login
    await page.waitForSelector('form, [data-testid="login-form"]', { timeout: 10000 });
    console.log('✓ Redirección a login exitosa');
  });

});
