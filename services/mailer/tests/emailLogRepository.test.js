const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModuleWithMocks } = require('./helpers/loadModuleWithMocks');

test('emailLogRepository.createPending inserta fila PENDING en ll_envios_email', async () => {
  const calls = [];
  const fakePool = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return [{ insertId: 101 }];
    }
  };

  const { emailLogRepository } = loadModuleWithMocks(
    '/root/leadmaster-workspace/services/mailer/src/repositories/emailLogRepository.js',
    {
      '/root/leadmaster-workspace/services/mailer/src/config/db.js': {
        getPool: () => fakePool
      }
    }
  );

  const id = await emailLogRepository.createPending({
    cliente_id: 77,
    to_email: 'cliente@test.com',
    subject: 'Asunto',
    body: '<p>Hola</p>',
    provider: 'smtp'
  });

  assert.equal(id, 101);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO ll_envios_email/);
  assert.deepEqual(calls[0].params, [77, 'cliente@test.com', 'Asunto', '<p>Hola</p>', 'smtp']);
});

test('emailLogRepository.reuseExistingPending reutiliza una fila existente por envio_email_id', async () => {
  const calls = [];
  const fakePool = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
  };

  const { emailLogRepository } = loadModuleWithMocks(
    '/root/leadmaster-workspace/services/mailer/src/repositories/emailLogRepository.js',
    {
      '/root/leadmaster-workspace/services/mailer/src/config/db.js': {
        getPool: () => fakePool
      }
    }
  );

  const reused = await emailLogRepository.reuseExistingPending({
    id: 202,
    cliente_id: 77,
    to_email: 'cliente@test.com',
    subject: 'Asunto',
    body: '<p>Hola</p>',
    provider: 'smtp'
  });

  assert.equal(reused, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /UPDATE ll_envios_email/);
  assert.deepEqual(calls[0].params, [77, 'cliente@test.com', 'Asunto', '<p>Hola</p>', 'smtp', 202]);
});

test('emailLogRepository.markSent y markFailed actualizan la fila esperada', async () => {
  const calls = [];
  const fakePool = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return [{}];
    }
  };

  const { emailLogRepository } = loadModuleWithMocks(
    '/root/leadmaster-workspace/services/mailer/src/repositories/emailLogRepository.js',
    {
      '/root/leadmaster-workspace/services/mailer/src/config/db.js': {
        getPool: () => fakePool
      }
    }
  );

  await emailLogRepository.markSent({ id: 303, message_id: 'msg-1' });
  await emailLogRepository.markFailed({ id: 303, error_message: 'FAIL' });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /status = 'SENT'/);
  assert.deepEqual(calls[0].params, ['msg-1', 303]);
  assert.match(calls[1].sql, /status = 'FAILED'/);
  assert.deepEqual(calls[1].params, ['FAIL', 303]);
});