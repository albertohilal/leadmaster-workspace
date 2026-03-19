import apiService from './api';
import { API_BASE_URL } from '../config/api';

function buildMailerUrl() {
  const normalizedBaseUrl = String(API_BASE_URL || '').trim();

  if (/^https?:\/\//i.test(normalizedBaseUrl)) {
    return new URL('/mailer/send', normalizedBaseUrl).toString();
  }

  return new URL('/mailer/send', window.location.origin).toString();
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function send({ to, subject, text }) {
  const response = await apiService.post(buildMailerUrl(), {
    to: normalizeEmail(to),
    subject,
    text
  });

  return response.data;
}

async function sendSelectionFanout({ recipients, subject, text }) {
  const attempts = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const email = normalizeEmail(recipient.email);

      if (!isValidEmail(email)) {
        throw new Error('EMAIL_INVALIDO');
      }

      const response = await send({
        to: email,
        subject,
        text
      });

      return {
        prospecto_id: recipient.prospecto_id,
        nombre: recipient.nombre,
        email,
        response
      };
    })
  );

  return attempts.reduce(
    (accumulator, attempt, index) => {
      const recipient = recipients[index];
      const email = normalizeEmail(recipient.email);

      if (attempt.status === 'fulfilled') {
        accumulator.sent += 1;
        accumulator.successes.push(attempt.value);
      } else {
        accumulator.failed += 1;
        accumulator.failures.push({
          prospecto_id: recipient.prospecto_id,
          nombre: recipient.nombre,
          email,
          error:
            attempt.reason?.response?.data?.message ||
            attempt.reason?.message ||
            'Error enviando email'
        });
      }

      return accumulator;
    },
    {
      total: recipients.length,
      sent: 0,
      failed: 0,
      successes: [],
      failures: []
    }
  );
}

const emailService = {
  normalizeEmail,
  isValidEmail,
  send,
  sendSelectionFanout
};

export default emailService;