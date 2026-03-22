const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModuleWithMocks } = require('./helpers/loadModuleWithMocks');

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

test('mailerService.sendEmail crea log pending, envía y marca SENT', async () => {
  const calls = [];
  const { mailerService } = loadModuleWithMocks(
    '/root/leadmaster-workspace/services/mailer/src/services/mailerService.js',
    {
      '/root/leadmaster-workspace/services/mailer/src/repositories/emailLogRepository.js': {
        emailLogRepository: {
          createPending: async (payload) => {
            calls.push(['createPending', payload]);
            return 501;
          },
          reuseExistingPending: async () => {
            throw new Error('should not reuse');
          },
          markSent: async (payload) => {
            calls.push(['markSent', payload]);
          },
          markFailed: async (payload) => {
            calls.push(['markFailed', payload]);
          }
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/repositories/clientEmailConfigRepository.js': {
        clientEmailConfigRepository: {
          findActiveByClienteId: async () => ({ id: 11 })
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/services/smtpTransportFactory.js': {
        smtpTransportFactory: {
          parseBooleanLike: () => false,
          createClientTransport: () => ({ transporter: {}, from: 'marketing@test.com', replyTo: 'reply@test.com' }),
          createFallbackTransportFromEnv: () => {
            throw new Error('should not use fallback');
          }
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/services/providers/smtpProvider.js': {
        smtpProvider: {
          send: async (payload) => {
            calls.push(['providerSend', payload]);
            return { message_id: 'smtp-1' };
          }
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/utils/logger.js': {
        logger: createLogger()
      }
    }
  );

  const result = await mailerService.sendEmail({
    cliente_id: 77,
    to: 'cliente@test.com',
    subject: 'Asunto',
    html: '<p>Hola</p>'
  });

  assert.equal(result.ok, true);
  assert.equal(result.message_id, 'smtp-1');
  assert.equal(calls[0][0], 'createPending');
  assert.equal(calls[1][0], 'providerSend');
  assert.equal(calls[2][0], 'markSent');
  assert.deepEqual(calls[2][1], { id: 501, message_id: 'smtp-1' });
});

test('mailerService.sendEmail reutiliza envio_email_id cuando viene informado', async () => {
  const calls = [];
  const { mailerService } = loadModuleWithMocks(
    '/root/leadmaster-workspace/services/mailer/src/services/mailerService.js',
    {
      '/root/leadmaster-workspace/services/mailer/src/repositories/emailLogRepository.js': {
        emailLogRepository: {
          createPending: async () => {
            throw new Error('should not create pending');
          },
          reuseExistingPending: async (payload) => {
            calls.push(['reuseExistingPending', payload]);
            return true;
          },
          markSent: async (payload) => {
            calls.push(['markSent', payload]);
          },
          markFailed: async () => {
            throw new Error('should not mark failed');
          }
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/repositories/clientEmailConfigRepository.js': {
        clientEmailConfigRepository: {
          findActiveByClienteId: async () => ({ id: 12 })
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/services/smtpTransportFactory.js': {
        smtpTransportFactory: {
          parseBooleanLike: () => false,
          createClientTransport: () => ({ transporter: {}, from: 'marketing@test.com', replyTo: undefined }),
          createFallbackTransportFromEnv: () => {
            throw new Error('should not use fallback');
          }
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/services/providers/smtpProvider.js': {
        smtpProvider: {
          send: async () => ({ message_id: 'smtp-2' })
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/utils/logger.js': {
        logger: createLogger()
      }
    }
  );

  const result = await mailerService.sendEmail({
    cliente_id: 77,
    envio_email_id: 901,
    to: 'cliente@test.com',
    subject: 'Asunto',
    text: 'Hola'
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0][0], 'reuseExistingPending');
  assert.equal(calls[0][1].id, 901);
  assert.equal(calls[1][0], 'markSent');
  assert.deepEqual(calls[1][1], { id: 901, message_id: 'smtp-2' });
});

test('mailerService.sendEmail falla con EMAIL_LOG_NOT_FOUND si envio_email_id no existe', async () => {
  const { mailerService } = loadModuleWithMocks(
    '/root/leadmaster-workspace/services/mailer/src/services/mailerService.js',
    {
      '/root/leadmaster-workspace/services/mailer/src/repositories/emailLogRepository.js': {
        emailLogRepository: {
          createPending: async () => {
            throw new Error('should not create pending');
          },
          reuseExistingPending: async () => false,
          markSent: async () => {},
          markFailed: async () => {}
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/repositories/clientEmailConfigRepository.js': {
        clientEmailConfigRepository: {
          findActiveByClienteId: async () => ({ id: 13 })
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/services/smtpTransportFactory.js': {
        smtpTransportFactory: {
          parseBooleanLike: () => false,
          createClientTransport: () => ({ transporter: {}, from: 'marketing@test.com', replyTo: undefined }),
          createFallbackTransportFromEnv: () => ({ transporter: {}, from: 'marketing@test.com', replyTo: undefined })
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/services/providers/smtpProvider.js': {
        smtpProvider: {
          send: async () => ({ message_id: 'smtp-3' })
        }
      },
      '/root/leadmaster-workspace/services/mailer/src/utils/logger.js': {
        logger: createLogger()
      }
    }
  );

  await assert.rejects(
    () => mailerService.sendEmail({
      cliente_id: 77,
      envio_email_id: 902,
      to: 'cliente@test.com',
      subject: 'Asunto',
      text: 'Hola'
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'EMAIL_LOG_NOT_FOUND');
      return true;
    }
  );
});