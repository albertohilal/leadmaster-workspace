// components/landing/LandingPage.jsx - Página de inicio estilo DyD
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  const services = [
    {
      icon: '📱',
      title: 'WhatsApp Marketing',
      description: 'Campañas masivas automatizadas',
      color: 'from-dyd-green to-success'
    },
    {
      icon: '🤖',
      title: 'Bot Responder',
      description: 'IA conversacional 24/7',
      color: 'from-dyd-blue to-primary'
    },
    {
      icon: '🌐',
      title: 'API Lugares',
      description: 'Base de datos geolocalizada',
      color: 'from-dyd-orange to-danger'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dyd-blue via-purple-400 to-purple-500">
      {/* Header */}
      <header className="p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-dyd-orange to-dyd-yellow rounded-full flex items-center justify-center shadow-lg">
              <img 
                src="/assets/logo-dyd.svg" 
                alt="DyD Logo" 
                className="w-10 h-10"
              />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">DDW</h1>
              <p className="text-xs opacity-90">Desarrollo y Diseño</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="bg-white text-dyd-blue px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition shadow-lg"
          >
            Iniciar Sesión
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-6xl font-bold text-white mb-4">
            DDW
          </h2>
          <p className="text-2xl text-white font-light mb-2">
            Desarrollo y Diseño Web
          </p>
          <p className="text-lg text-white opacity-90">
            Ecosistema de soluciones digitales inteligentes
          </p>
        </div>

        {/* Services Cards */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <div 
                key={index}
                className="text-center group hover:transform hover:scale-105 transition duration-300"
              >
                <div className={`w-24 h-24 mx-auto mb-6 bg-gradient-to-br ${service.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition`}>
                  <span className="text-5xl">{service.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  {service.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {service.description}
                </p>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/login')}
              className="bg-gradient-to-r from-dyd-blue to-primary text-white text-lg font-semibold px-10 py-4 rounded-full hover:from-primary hover:to-dyd-blue transition shadow-lg hover:shadow-xl"
            >
              Acceder al Dashboard
            </button>
          </div>

          {/* Footer Info */}
          <div className="text-center mt-10 text-sm text-gray-500">
            <p>Clientes: <span className="font-semibold text-dyd-blue">Haby · Marketing</span> | Admin: <span className="font-semibold text-dyd-orange">b3toh</span></p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-white py-8">
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} Desarrollo y Diseño Web - Todos los derechos reservados
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
