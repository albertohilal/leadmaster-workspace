import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import GestionDestinatariosPage from '../destinatarios/GestionDestinatariosPage';

const EmailCampaignProspectsPage = () => {
  const { campaignId } = useParams();

  useEffect(() => {
    document.title = 'Seleccionar destinatarios Email | LeadMaster';
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

      <GestionDestinatariosPage
        hideHeader
        campaignId={campaignId}
        defaultCanalDisponibleFiltro="email"
        hideWhatsappActions
      />
    </div>
  );
};

export default EmailCampaignProspectsPage;