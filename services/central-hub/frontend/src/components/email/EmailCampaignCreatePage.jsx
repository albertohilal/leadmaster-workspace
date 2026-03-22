import React, { useEffect, useState } from 'react';
import Card from '../common/Card';
import emailService from '../../services/email';

const INITIAL_FORM = {
  channel: 'EMAIL',
  nombre: '',
  subject: '',
  text: ''
};

const EmailCampaignCreatePage = () => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    document.title = 'Crear campaña Email | LeadMaster';
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nombre.trim()) {
      return 'El nombre es obligatorio';
    }

    if (!formData.subject.trim()) {
      return 'El asunto es obligatorio';
    }

    if (!formData.text.trim()) {
      return 'El contenido es obligatorio';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const response = await emailService.createCampaign({
        channel: formData.channel,
        nombre: formData.nombre.trim(),
        subject: formData.subject.trim(),
        text: formData.text.trim()
      });

      setSuccess({
        message:
          response?.message ||
          'Campaña Email creada en modo preparatorio. Aún no hay persistencia real, envío, destinatarios ni programación.',
        data: response?.data
      });
      setFormData(INITIAL_FORM);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          'No se pudo crear la campaña Email'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Crear campaña Email</h1>
        <p className="mt-1 text-gray-600">
          Alta mínima y separada del dominio actual de campañas WhatsApp.
        </p>
      </div>

      <Card className="border border-blue-200 bg-blue-50">
        <div className="space-y-2 text-sm text-blue-900">
          <p className="font-semibold">Estado actual del flujo</p>
          <p>
            Este formulario usa <span className="font-mono">POST /api/email/campaigns</span>.
            La creación actual es preparatoria: valida el contrato mínimo y devuelve una respuesta
            honesta, pero todavía no persiste, no envía y no programa.
          </p>
          <p>
            Este flujo no usa <span className="font-mono">/sender/campaigns</span> ni reemplaza
            <span className="font-mono"> /mailer/send</span>. Email y WhatsApp siguen separados por canal.
          </p>
          <p>
            La cuenta remitente no se elige en este formulario mínimo: se resuelve por configuración del cliente en backend, preservando el contexto multi-tenant.
          </p>
        </div>
      </Card>

      <Card title="Formulario mínimo" icon="✉️">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="channel" className="mb-1 block text-sm font-medium text-gray-700">
              Canal
            </label>
            <input
              id="channel"
              name="channel"
              type="text"
              value={formData.channel}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700"
            />
          </div>

          <div>
            <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              value={formData.nombre}
              onChange={handleChange}
              disabled={loading}
              placeholder="Campaña Email Marzo"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
              Asunto *
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              value={formData.subject}
              onChange={handleChange}
              disabled={loading}
              placeholder="Novedades de marzo"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="text" className="mb-1 block text-sm font-medium text-gray-700">
              Contenido *
            </label>
            <textarea
              id="text"
              name="text"
              rows={10}
              value={formData.text}
              onChange={handleChange}
              disabled={loading}
              placeholder="Contenido base del email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-medium text-emerald-900">Creación aceptada</div>
              <div className="mt-1">{success.message}</div>
              {success.data?.campaign && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-3 text-xs text-gray-700">
                  <div><strong>Canal:</strong> {success.data.channel}</div>
                  <div><strong>Modo:</strong> {success.data.mode}</div>
                  <div><strong>Persistida:</strong> {String(success.data.persisted)}</div>
                  <div><strong>Nombre:</strong> {success.data.campaign.nombre}</div>
                  <div><strong>Asunto:</strong> {success.data.campaign.subject}</div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setFormData(INITIAL_FORM);
                setError('');
                setSuccess(null);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:bg-gray-100"
            >
              Limpiar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? 'Creando...' : 'Crear campaña Email'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EmailCampaignCreatePage;