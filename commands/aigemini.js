const axios = require('axios');

module.exports = {
  name: 'gemini-chat',
  description: 'Pose une question à Gemini via l\'API fournie.',
  author: 'Deku (rest api)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "❌ Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que Gemini est en train de répondre
      await sendMessage(
        senderId,
        {
          text: '💬 Gemini est en train de réfléchir à ta question...⏳\n\n─────★─────'
        },
        pageAccessToken
      );

      // Construire l'URL de l'API
      const apiUrl = `https://api.kenliejugarap.com/blackbox-gemini/?text=${encodeURIComponent(prompt)}`;

      // Effectuer la requête à l'API
      const response = await axios.get(apiUrl);

      // Vérifier que la réponse contient des données valides
      const text = response.data;
      if (!text) {
        throw new Error('Réponse invalide ou vide de l\'API.');
      }

      // Formater la réponse
      const formattedResponse = `─────★─────\n✨ **Gemini**\n\n${text.trim()}\n─────★─────`;

      // Vérifier si la réponse dépasse la longueur maximale (2000 caractères)
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
      console.error('Erreur lors de l\'appel à l\'API Gemini :', error.message);

      // Envoyer un message d'erreur en cas de problème
      await sendMessage(
        senderId,
        {
          text: '❌ Désolé, une erreur est survenue lors de l\'appel à l\'API Gemini. Veuillez réessayer plus tard.'
        },
        pageAccessToken
      );
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
