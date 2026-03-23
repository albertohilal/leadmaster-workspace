import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import GestionDestinatariosPage from '../destinatarios/GestionDestinatariosPage';

const EmailCampaignProspectsPage = () => {
  useEffect(() => {
    document.title = 'Seleccionar destinatarios Email | LeadMaster';
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/email/campaigns"
          className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          ← Volver a Campañas Email
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-800">Seleccionar destinatarios (Email)</h1>
      </div>

      <GestionDestinatariosPage />
    </div>
  );
};

export default EmailCampaignProspectsPage;