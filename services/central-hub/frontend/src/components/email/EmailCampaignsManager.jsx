import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../common/Card';

const MOCK_CAMPAIGNS = [
  {
    id: 'email-campaign-1',
    nombre: 'Campaña Bienvenida Marzo',
    subject: 'Te damos la bienvenida a LeadMaster',
    status: 'draft',
    updatedAt: '23/03/2026 09:15'
  },
  {
    id: 'email-campaign-2',
    nombre: 'Reactivación Clientes Q1',
    subject: 'Volvamos a conectar este mes',
    status: 'active',
    updatedAt: '22/03/2026 18:40'
  },
  {
    id: 'email-campaign-3',
    nombre: 'Promo Servicios Premium',
    subject: 'Conocé los beneficios del plan premium',
    status: 'paused',
    updatedAt: '20/03/2026 11:05'
  }
];

const badgeForStatus = (status) => {
  const styles = {
    draft: 'bg-slate-100 text-slate-700 border border-slate-200',
    active: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    paused: 'bg-amber-100 text-amber-700 border border-amber-200'
  };

  return styles[status] || 'bg-gray-100 text-gray-700 border border-gray-200';
};

const labelForStatus = (status) => {
  const labels = {
    draft: 'Draft',
    active: 'Active',
    paused: 'Paused'
  };

  return labels[status] || status;
};

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
            <Link
              to="/email/campaigns/prospects"
              className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
            >
              Seleccionar destinatarios
            </Link>
          </div>

          {MOCK_CAMPAIGNS.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No hay campañas Email todavía</p>
              <p className="mt-2">
                Cuando se conecte la API, este espacio mostrará las campañas disponibles.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-5 py-4">
                <p className="text-sm font-medium text-gray-800">Listado de campañas</p>
                <p className="mt-1 text-sm text-gray-500">
                  Vista mock preparada para reemplazar luego por `emailService.listCampaigns()`.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                        Nombre
                      </th>
                      <th className="px-5 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                        Asunto
                      </th>
                      <th className="px-5 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                        Estado
                      </th>
                      <th className="px-5 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                        Actualizado
                      </th>
                      <th className="px-5 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {MOCK_CAMPAIGNS.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 font-medium text-gray-900">{campaign.nombre}</td>
                        <td className="px-5 py-4 text-gray-600">{campaign.subject}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeForStatus(campaign.status)}`}
                          >
                            {labelForStatus(campaign.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{campaign.updatedAt}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to="/email/campaigns/prospects"
                              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                            >
                              Destinatarios
                            </Link>
                            <button
                              type="button"
                              disabled
                              title="Pendiente"
                              className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
                            >
                              Ver (pendiente)
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default EmailCampaignsManager;