import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3011';
const FRONTEND_URL = 'http://localhost:5173';

test.describe('Campaigns - Pruebas Simples', () => {
  
  test('1. Backend responde correctamente', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();
  });

  test('2. Login funciona para cliente Haby', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/auth/login`, {
      data: {
        usuario: 'Haby',
        password: 'haby1973'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(data.usuario.cliente_id).toBe(51);
  });

  test('3. Frontend carga correctamente', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await expect(page.locator('title')).toContainText('LeadMaster');
  });

  test('4. Página de login funciona', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);
    
    // Verificar elementos del login
    await expect(page.locator('input[name="usuario"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('5. Login completo y redirección', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);
    
    // Llenar formulario
    await page.fill('input[name="usuario"]', 'Haby');
    await page.fill('input[name="password"]', 'haby1973');
    
    // Click login
    await page.click('button[type="submit"]');
    
    // Esperar redirección (aumentar timeout)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verificar que llegó al dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

});