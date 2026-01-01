// Prueba simple del flujo de campañas
const fetch = require('node-fetch');

async function testCampaignsFlow() {
    console.log('🧪 Iniciando pruebas del flujo de campañas...\n');

    try {
        // 1. Verificar backend
        console.log('1. Verificando backend...');
        const healthResponse = await fetch('http://localhost:3011/health');
        if (healthResponse.ok) {
            console.log('✅ Backend responde correctamente');
        } else {
            console.log('❌ Backend no responde');
            return;
        }

        // 2. Hacer login como cliente
        console.log('\n2. Probando login de cliente Haby...');
        const loginResponse = await fetch('http://localhost:3011/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario: 'Haby',
                password: 'haby1973'
            })
        });

        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ Login exitoso');
            console.log(`   Usuario: ${loginData.usuario.usuario}`);
            console.log(`   Cliente ID: ${loginData.usuario.cliente_id}`);
            console.log(`   Rol: ${loginData.usuario.rol || 'cliente'}`);
            
            const token = loginData.token;

            // 3. Verificar endpoint de campañas
            console.log('\n3. Verificando endpoint de campañas...');
            const campaignsResponse = await fetch('http://localhost:3011/campaigns', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (campaignsResponse.ok) {
                const campaigns = await campaignsResponse.json();
                console.log('✅ Endpoint de campañas funciona');
                console.log(`   Campañas encontradas: ${campaigns.length || 0}`);
            } else {
                console.log('❌ Error en endpoint de campañas');
            }

            // 4. Verificar endpoint de leads
            console.log('\n4. Verificando endpoint de leads...');
            const leadsResponse = await fetch('http://localhost:3011/leads', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (leadsResponse.ok) {
                const leads = await leadsResponse.json();
                console.log('✅ Endpoint de leads funciona');
                console.log(`   Leads encontrados: ${leads.length || 0}`);
            } else {
                console.log('❌ Error en endpoint de leads');
            }

        } else {
            console.log('❌ Error en login');
            const errorData = await loginResponse.text();
            console.log(`   Error: ${errorData}`);
        }

        // 5. Hacer login como administrador
        console.log('\n5. Probando login de administrador...');
        const adminLoginResponse = await fetch('http://localhost:3011/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario: 'iunaorg_b3toh',
                password: 'elgeneral2018'
            })
        });

        if (adminLoginResponse.ok) {
            const adminData = await adminLoginResponse.json();
            console.log('✅ Login de admin exitoso');
            console.log(`   Usuario: ${adminData.usuario.usuario}`);
            console.log(`   Rol: ${adminData.usuario.rol || 'admin'}`);
        } else {
            console.log('❌ Error en login de admin');
        }

        console.log('\n🎉 ¡Pruebas completadas!');

    } catch (error) {
        console.log('❌ Error en las pruebas:', error.message);
    }
}

testCampaignsFlow();