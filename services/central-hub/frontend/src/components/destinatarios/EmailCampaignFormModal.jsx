import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, Send, XCircle } from 'lucide-react';
import Modal from '../common/Modal';
import emailService from '../../services/email';

const PREVIEW_LIMIT = 6;

// Componente reservado para envíos manuales aislados.
// No debe usarse como flujo principal del módulo de Campañas Email persistidas.

const EmailCampaignFormModal = ({
  isOpen,
  onClose,
  selectedProspects = [],
  onSubmit,
  loading = false,
  result = null
}) => {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [formError, setFormError] = useState('');

  const summary = useMemo(() => {
    const validRecipients = [];
    const invalidRecipients = [];

    selectedProspects.forEach((prospect) => {
      const email = emailService.normalizeEmail(prospect.email);

      if (emailService.isValidEmail(email)) {
        validRecipients.push({
          ...prospect,
          email
        });
      } else {
        invalidRecipients.push({
          ...prospect,
          email
        });
      }
    });

    return {
      total: selectedProspects.length,
      validRecipients,
      invalidRecipients
    };
  }, [selectedProspects]);

  useEffect(() => {
    if (!isOpen) {
      setSubject('');
      setText('');
      setFormError('');
      return;
    }

    setFormError('');
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedSubject = subject.trim();
    const normalizedText = text.trim();

    if (!normalizedSubject) {
      setFormError('El asunto es obligatorio');
      return;
    }

    if (!normalizedText) {
      setFormError('El cuerpo del correo es obligatorio');
      return;
    }

    if (summary.validRecipients.length === 0) {
      setFormError('No hay destinatarios con email válido para enviar');
      return;
    }

    setFormError('');
    await onSubmit({
      subject: normalizedSubject,
      text: normalizedText,
      recipients: summary.validRecipients
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Envío manual Email" size="large">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm text-gray-500">Prospectos seleccionados</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{summary.total}</div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Con email válido
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900">
              {summary.validRecipients.length}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <XCircle className="h-4 w-4" />
              Sin email
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-900">
              {summary.invalidRecipients.length}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Este flujo usa el endpoint existente /mailer/send por cada destinatario válido. Es un envío manual aislado y no corresponde al flujo principal de Campañas Email persistidas.
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Asunto *</label>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Asunto del correo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cuerpo del correo *</label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Escribí el contenido del correo..."
            rows={10}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200">
            <div className="border-b px-4 py-3 text-sm font-medium text-gray-800">
              Destinatarios válidos ({summary.validRecipients.length})
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto px-4 py-3 text-sm">
              {summary.validRecipients.length === 0 ? (
                <div className="text-gray-500">No hay emails válidos en la selección actual.</div>
              ) : (
                summary.validRecipients.slice(0, PREVIEW_LIMIT).map((prospect) => (
                  <div key={prospect.prospecto_id} className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="font-medium text-gray-900">{prospect.nombre}</div>
                    <div className="text-gray-600">{prospect.email}</div>
                  </div>
                ))
              )}

              {summary.validRecipients.length > PREVIEW_LIMIT && (
                <div className="text-xs text-gray-500">
                  y {summary.validRecipients.length - PREVIEW_LIMIT} destinatarios más...
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200">
            <div className="border-b px-4 py-3 text-sm font-medium text-gray-800">
              Sin email ({summary.invalidRecipients.length})
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto px-4 py-3 text-sm">
              {summary.invalidRecipients.length === 0 ? (
                <div className="text-gray-500">Todos los seleccionados tienen email válido.</div>
              ) : (
                summary.invalidRecipients.slice(0, PREVIEW_LIMIT).map((prospect) => (
                  <div key={prospect.prospecto_id} className="rounded-lg bg-amber-50 px-3 py-2">
                    <div className="font-medium text-gray-900">{prospect.nombre}</div>
                    <div className="text-gray-600">Sin email usable</div>
                  </div>
                ))
              )}

              {summary.invalidRecipients.length > PREVIEW_LIMIT && (
                <div className="text-xs text-gray-500">
                  y {summary.invalidRecipients.length - PREVIEW_LIMIT} prospectos más...
                </div>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <div className="font-medium text-gray-900">Resultado del envío</div>
            <div className="mt-1">Enviados: {result.sent}</div>
            <div>Fallidos: {result.failed}</div>
            {result.failures.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-red-700">
                {result.failures.slice(0, PREVIEW_LIMIT).map((failure) => (
                  <div key={`${failure.prospecto_id}-${failure.email || 'sin-email'}`}>
                    {failure.nombre}: {failure.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:bg-gray-100"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading || summary.validRecipients.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? <Mail className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            {loading ? 'Enviando...' : 'Enviar Email'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EmailCampaignFormModal;