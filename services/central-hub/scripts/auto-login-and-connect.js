#!/usr/bin/env node

/**
 * Script de automatización con Playwright
 * Auto-login y conexión de WhatsApp
 */

const { chromium } = require('playwright');

async function autoLoginAndConnect() {
  console.log('🚀 Iniciando automatización con Playwright...');
  
  const browser = await chromium.launch({
    headless: true, // Modo headless para servidor sin X
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Navegar a la aplicación (página de login directa)
    console.log('📍 Navegando a http://desarrolloydisenioweb.com.ar:3012/login');
    await page.goto('http://desarrolloydisenioweb.com.ar:3012/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Dar tiempo a que React renderice
    
    // Screenshot para debug
    await page.screenshot({ path: '/root/leadmaster-central-hub/step1-login-page.png' });
    console.log('📸 Screenshot de página de login guardado');
    
    // 2. Hacer login
    console.log('🔐 Realizando login...');
    
    // Esperar que aparezca el formulario de login (más flexible)
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    
    // Llenar usuario (usar el primer input de texto)
    const usernameInput = await page.locator('input[type="text"]').first();
    await usernameInput.fill('Haby');
    console.log('   ✓ Usuario ingresado: Haby');
    
    // Llenar contraseña
    const passwordInput = await page.locator('input[type="password"]').first();
    await passwordInput.fill('haby1973');
    console.log('   ✓ Contraseña ingresada');
    
    // Click en botón de login
    const loginButton = await page.locator('button[type="submit"]').first();
    await loginButton.click();
    console.log('   ✓ Click en botón de login');
    
    // Esperar a que cargue el dashboard
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('✅ Login exitoso!');
    
    // 3. Navegar a WhatsApp
    console.log('📱 Navegando a sección WhatsApp...');
    await page.click('a[href="/whatsapp"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('✅ En página de WhatsApp');
    
    // Screenshot para ver estado
    await page.screenshot({ path: '/root/leadmaster-central-hub/step3-whatsapp-page.png' });
    console.log('📸 Screenshot de página WhatsApp guardado');
    
    // 4. Verificar estado actual
    const isConnected = await page.locator('text=Conectado').count() > 0;
    
    if (isConnected) {
      console.log('✅ WhatsApp ya está conectado!');
      console.log('🎯 Proceso completado');
      await browser.close();
      return;
    }
    
    // Verificar si ya está en estado "Esperando QR"
    const isWaitingQR = await page.locator('text=Esperando QR').count() > 0;
    
    if (!isWaitingQR) {
      // 5. Click en "Conectar WhatsApp" solo si NO está esperando QR
      console.log('🔗 Haciendo click en "Conectar WhatsApp"...');
      await page.click('button:has-text("Conectar WhatsApp")', { timeout: 10000 });
      await page.waitForTimeout(5000); // Esperar 5 segundos para que se genere QR
      console.log('✅ Sesión iniciada, esperando generación de QR...');
    } else {
      console.log('ℹ️  WhatsApp ya está en modo "Esperando QR"');
    }
    
    // 6. Click en "Ver QR"
    console.log('👁️  Haciendo click en "Ver QR"...');
    await page.click('button:has-text("Ver QR")');
    await page.waitForTimeout(3000);
    
    console.log('✅ Modal QR abierto');
    
    // 7. Esperar a que aparezca el QR
    console.log('⏳ Esperando que aparezca el código QR...');
    await page.waitForSelector('img[src*="/session-manager/qr"]', { timeout: 30000 });
    
    console.log('✅ ¡QR VISIBLE!');
    
    // Capturar screenshot del QR
    await page.screenshot({ path: '/root/leadmaster-central-hub/qr-code.png', fullPage: true });
    console.log('📸 Screenshot guardado en: /root/leadmaster-central-hub/qr-code.png');
    
    console.log('');
    console.log('📱 AHORA:');
    console.log('   1. Descarga la imagen qr-code.png desde el servidor');
    console.log('   2. O usa: scp root@vmi2656219.ioam.de:/root/leadmaster-central-hub/qr-code.png .');
    console.log('   3. Abre WhatsApp en el móvil de Alberto');
    console.log('   4. Ve a "Dispositivos vinculados"');
    console.log('   5. Escanea el QR de la imagen');
    console.log('');
    console.log('⏳ Esperando escaneo del QR (máximo 2 minutos)...');
    
    // 8. Esperar hasta que conecte (o timeout de 2 minutos)
    try {
      await page.waitForSelector('text=Conectado', { timeout: 120000 });
      console.log('');
      console.log('🎉 ¡WHATSAPP CONECTADO EXITOSAMENTE!');
      console.log('');
      
      // Esperar un momento para confirmar
      await page.waitForTimeout(5000);
      
      console.log('✅ Proceso completado. Cerrando navegador en 10 segundos...');
      await page.waitForTimeout(10000);
      
    } catch (error) {
      console.log('');
      console.log('⏰ Tiempo de espera agotado (2 minutos)');
      console.log('💡 Si no escaneaste el QR, puedes hacerlo ahora');
      console.log('🔄 La ventana permanecerá abierta por 5 minutos más...');
      await page.waitForTimeout(300000); // 5 minutos adicionales
    }
    
  } catch (error) {
    console.error('❌ Error durante la automatización:', error.message);
    console.log('');
    console.log('💡 Dejando el navegador abierto para inspección manual...');
    console.log('   Presiona Ctrl+C para cerrar');
    
    // Mantener el navegador abierto indefinidamente
    await new Promise(() => {});
    
  } finally {
    // await browser.close();
    // console.log('🏁 Navegador cerrado');
  }
}

// Ejecutar
autoLoginAndConnect().catch(console.error);
