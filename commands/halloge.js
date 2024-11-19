const axios = require('axios');

module.exports = {
  name: 'blackbox',
  description: 'Pose une question à l\'API Blackbox et reçoit une réponse.',
  author: 'Deku',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    // Vérifier si une question a été posée
    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Informer l'utilisateur que le bot répond
      await sendMessage(senderId, { text: '💬 Blackbox est en train de répondre⏳...\n\n─────★─────' }, pageAccessToken);

      // URL de l'API avec la question encodée
      const apiUrl = `https://api.kenliejugarap.com/blackbox-pro/?text=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Récupérer la réponse
      const text = response.data.result || "Désolé, je n'ai pas pu obtenir de réponse.";

      // Formater la réponse
      const formattedResponse = `─────★─────\n` +
                                `✨Blackbox Response\n\n${text}\n` +
                                `─────★─────`;

      // Gérer les réponses longues
      const maxMessageLength = 2000;
      if (formattedResponse.length > maxMessageLength) {
        const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
        for (const message of messages) {
          await sendMessage(senderId, { text: message }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }
    } catch (error) {
      console.error('Error calling Blackbox API:', error);
      // Envoyer un message d'erreur à l'utilisateur
      await sendMessage(senderId, { text: 'Désolé, une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};

// Fonction pour découper les messages longs
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
