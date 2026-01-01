import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import { sessionAPI, listenerAPI, statsAPI } from '../../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    whatsappStatus: 'CHECKING',
    listenerMode: 'off',
    totalLeads: 0,
    leadsWithIA: 0,
    messagesToday: 0,
    activeCampaigns: 0,
    messagesReceived: 0
  });

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // actualizar cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Cargar datos en paralelo
      const [sessionStatus, listenerStatus] = await Promise.all([
        sessionAPI.getStatus().catch(() => ({ data: { status: 'ERROR' } })),
        listenerAPI.getStatus().catch(() => ({ data: { mode: 'off' } }))
      ]);

      setStats({
        whatsappStatus: sessionStatus.data.status || 'DISCONNECTED',
        listenerMode: listenerStatus.data.mode || 'off',
        totalLeads: 0, // Por implementar en backend
        leadsWithIA: 0, // Por implementar en backend
        messagesToday: 0, // Por implementar en backend
        activeCampaigns: 0, // Por implementar en backend
        messagesReceived: 0 // Por implementar en backend
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-success';
      case 'DISCONNECTED':
      case 'ERROR':
        return 'bg-danger';
      case 'QR':
        return 'bg-warning';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'CONNECTED':
        return 'Conectado';
      case 'DISCONNECTED':
        return 'Desconectado';
      case 'QR':
        return 'Esperando QR';
      case 'ERROR':
        return 'Error';
      default:
        return 'Verificando...';
    }
  };

  const getListenerModeText = (mode) => {
    switch (mode) {
      case 'listen':
        return 'Escuchando';
      case 'respond':
        return 'Respondiendo';
      case 'off':
        return 'Desactivado';
      default:
        return mode;
    }
  };

  if (loading) {
    return <LoadingSpinner size="large" text="Cargando dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen general del sistema</p>
      </div>

      {/* Tarjetas de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* WhatsApp Status */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">WhatsApp</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {getStatusText(stats.whatsappStatus)}
              </p>
            </div>
            <div className={`w-12 h-12 ${getStatusColor(stats.whatsappStatus)} rounded-full flex items-center justify-center text-white text-2xl`}>
              💬
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(stats.whatsappStatus)} animate-pulse`}></div>
            <span className="text-xs text-gray-500">Actualizado hace 10s</span>
          </div>
        </Card>

        {/* Listener Mode */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Listener</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {getListenerModeText(stats.listenerMode)}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white text-2xl">
              🤖
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-gray-500">Modo actual del sistema</span>
          </div>
        </Card>

        {/* Total Leads */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {stats.totalLeads.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white text-2xl">
              👥
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-success">↑ {stats.leadsWithIA} con IA habilitada</span>
          </div>
        </Card>

        {/* Mensajes Hoy */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mensajes Hoy</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {stats.messagesToday.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center text-white text-2xl">
              📨
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-gray-500">Enviados y recibidos</span>
          </div>
        </Card>
      </div>

      {/* Segunda fila de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Campañas Activas */}
        <Card title="Campañas Activas" icon="📊">
          <div className="text-center py-8">
            <p className="text-4xl font-bold text-gray-800">{stats.activeCampaigns}</p>
            <p className="text-sm text-gray-600 mt-2">En ejecución</p>
          </div>
        </Card>

        {/* Mensajes Recibidos */}
        <Card title="Mensajes Recibidos" icon="📬">
          <div className="text-center py-8">
            <p className="text-4xl font-bold text-gray-800">{stats.messagesReceived}</p>
            <p className="text-sm text-gray-600 mt-2">En las últimas 24h</p>
          </div>
        </Card>

        {/* Estado del Sistema */}
        <Card title="Estado del Sistema" icon="⚡">
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Backend</span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                <span className="text-sm font-medium text-success">Online</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Base de Datos</span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                <span className="text-sm font-medium text-success">Conectada</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">OpenAI API</span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                <span className="text-sm font-medium text-success">Activa</span>
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Actividad Reciente */}
      <Card title="Actividad Reciente" icon="📋">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 text-center py-8">
            No hay actividad reciente para mostrar
          </p>
          {/* Aquí se pueden agregar logs recientes cuando esté implementado en el backend */}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
