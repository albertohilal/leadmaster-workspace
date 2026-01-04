import { test, expect } from '@playwright/test';

test.describe('Flujo de Campañas - Pruebas Reales', () => {

  test('1. API - Login y endpoints funcionan', async ({ request }) => {
    // Test login cliente
    const clientLoginResponse = await request.post('http://localhost:3011/auth/login', {
      data: { usuario: 'Haby', password: 'haby1973' }
    });
    
    expect(clientLoginResponse.ok()).toBeTruthy();
    const clientData = await clientLoginResponse.json();
    expect(clientData.token).toBeDefined();
    expect(clientData.user.tipo).toBe('cliente');
    expect(clientData.user.cliente_id).toBe(51);

    // Test endpoint de campañas con token
    const campaignsResponse = await request.get('http://localhost:3011/sender/campaigns', {
      headers: { 'Authorization': `Bearer ${clientData.token}` }
    });
    
    expect(campaignsResponse.ok()).toBeTruthy();
    const campaigns = await campaignsResponse.json();
    expect(Array.isArray(campaigns)).toBeTruthy();

    // Test login admin
    const adminLoginResponse = await request.post('http://localhost:3011/auth/login', {
      data: { usuario: 'b3toh', password: 'elgeneral2018' }
    });
    
    expect(adminLoginResponse.ok()).toBeTruthy();
    const adminData = await adminLoginResponse.json();
    expect(adminData.user.tipo).toBe('admin');
  });

  test('2. Frontend - Login cliente y navegación básica', async ({ page }) => {
    // Ir a login
    await page.goto('http://localhost:5173/login');
    
    // Verificar elementos de login
    await expect(page.locator('input[name="usuario"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    
    // Hacer login
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    
    // Verificar redirección exitosa (con timeout mayor)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verificar elementos del dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('3. Frontend - Navegación a campañas', async ({ page }) => {
    // Login rápido
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Ir a campañas
    await page.click('a[href*="campaigns"]');
    
    // Verificar que llegó a campañas
    await expect(page.locator('text=Campaña')).toBeVisible({ timeout: 5000 });
    
    // Verificar que NO tiene permisos de admin
    await expect(page.locator('text=👑 Panel Administrador')).not.toBeVisible();
  });

});