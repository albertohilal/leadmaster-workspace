import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../common/Card';

const EmailCampaignsManager = () => {
  useEffect(() => {
    document.title = 'Campañas Email | LeadMaster';
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Campañas Email</h1>
        <p className="mt-1 text-gray-600">
          Punto de entrada del módulo Email para crear y administrar campañas.
        </p>
      </div>

      <Card title="Gestión del módulo" icon="✉️">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              to="/email/campaigns/new"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Nueva campaña Email
            </Link>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Listado de campañas (pendiente de API)</p>
            <p className="mt-2">
              Este espacio mostrará el listado, filtros y acciones de campañas Email cuando el backend exponga la API correspondiente.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmailCampaignsManager;