const OpenAI = require('openai');
const env = require('../../../config/environment');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Genera una respuesta usando OpenAI (GPT-4o).
 * @param {string} contexto - Contexto del sistema para la IA
 * @param {string} texto - Mensaje del usuario
 * @returns {Promise<string>} - Respuesta generada por la IA
 */
async function generarRespuesta(contexto, texto) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: contexto },
        { role: 'user', content: texto }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Error en generarRespuesta:', error?.response?.data || error.message);
    return 'Lo siento, ocurrió un error al generar la respuesta.';
  }
}

module.exports = { generarRespuesta };
