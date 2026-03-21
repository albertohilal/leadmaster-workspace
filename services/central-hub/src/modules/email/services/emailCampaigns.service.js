async function createEmailCampaign({ cliente_id, request }) {
  return {
    mode: 'preparatory',
    persisted: false,
    channel: request.channel,
    cliente_id,
    campaign: {
      channel: request.channel,
      nombre: request.nombre,
      subject: request.subject,
      text: request.text
    }
  };
}

module.exports = {
  createEmailCampaign
};