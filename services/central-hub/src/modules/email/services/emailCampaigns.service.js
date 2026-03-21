async function createEmailCampaign({ cliente_id, request }) {
  return {
    mode: 'preparatory',
    persisted: false,
    channel: 'email',
    cliente_id,
    campaign: {
      nombre: request.nombre,
      subject: request.subject,
      text: request.text
    }
  };
}

module.exports = {
  createEmailCampaign
};