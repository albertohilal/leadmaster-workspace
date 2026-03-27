import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import GestionDestinatariosPage from '../destinatarios/GestionDestinatariosPage';
import emailService from '../../services/email';

const EmailCampaignProspectsPage = () => {
  const { campaignId } = useParams();
  const [emailCampaigns, setEmailCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCampaigns = async () => {
    setLoading(true);
    setError('');

    try {
      const campaigns = await emailService.listCampaigns();
      setEmailCampaigns(Array.isArray(campaigns) ? campaigns : []);
    } catch (requestError) {
      setEmailCampaigns([]);
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          'No se pudieron cargar las campañas Email'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Seleccionar destinatarios Email | LeadMaster';
    loadCampaigns();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/email/campaigns"
            className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            ← Volver a Campañas Email
          </Link>
          <Link
            to="/email/campaigns/new"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
          >
            + Nueva campaña Email
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-gray-800">Seleccionar destinatarios (Email)</h1>
        {campaignId && (
          <p className="mt-1 text-xs text-gray-500">Contexto campaña: {campaignId}</p>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-600">
          Cargando campañas Email...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-700">
          <p className="font-medium text-red-900">No se pudo cargar el contexto Email</p>
          <p className="mt-2">{error}</p>
          <button
            type="button"
            onClick={loadCampaigns}
            className="mt-4 inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <GestionDestinatariosPage
          hideHeader
          campaignId={campaignId}
          defaultCanalDisponibleFiltro="email"
          hideWhatsappActions
          useEmailCampaignSelector
          emailCampaigns={emailCampaigns}
        />
      )}
    </div>
  );
};

export default EmailCampaignProspectsPage;