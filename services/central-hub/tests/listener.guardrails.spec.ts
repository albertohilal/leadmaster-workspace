import { test, expect } from '@playwright/test';

// Guardrails: el listener debe usar whatsappService/session-manager y no tocar Venom

test.describe('Listener guardrails', () => {
  test('onMessageReceived usa whatsappService y no requiere venom-bot', async () => {
    // Cargar módulos
    const listenerService = require('../src/modules/listener/services/listenerService');
    const whatsappService = require('../src/modules/listener/services/whatsappService');

    // Spy/mocks simples
    const originalIsWhatsappSessionActive = whatsappService.isWhatsappSessionActive;
    const originalEnviarWhatsapp = whatsappService.enviarWhatsapp;

    let isActiveCalled = 0;
    let enviarCalled = 0;

    whatsappService.isWhatsappSessionActive = async () => {
      isActiveCalled++;
      return true; // simular sesión lista
    };

    whatsappService.enviarWhatsapp = async () => {
      enviarCalled++;
      return true; // simular envío exitoso
    };

    // Ejecutar flujo respond
    listenerService.setMode('respond');
    const result = await listenerService.onMessageReceived({
      cliente_id: 99,
      telefono: '5491112345678',
      texto: 'hola'
    });

    // Verificaciones de guardrails
    expect(isActiveCalled).toBe(1);
    expect(enviarCalled).toBe(1);
    expect(result.enviado).toBe(true);

    // Asegurar que venom-bot no fue cargado desde el listener
    const venomLoaded = Object.keys(require.cache).some((k) => k.includes('venom-bot'));
    expect(venomLoaded).toBeFalsy();

    // Restaurar
    whatsappService.isWhatsappSessionActive = originalIsWhatsappSessionActive;
    whatsappService.enviarWhatsapp = originalEnviarWhatsapp;
  });
});
