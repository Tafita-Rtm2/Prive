const axios = require('axios');

module.exports = {
  name: 'claude-ai',
  description: 'Pose une question à Blackbox Claude.',
  author: 'Deku (rest api)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que Blackbox Claude est en train de répondre
      await sendMessage(senderId, { text: '💬  Claude haiku est en train de te répondre⏳...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API avec le texte de la question
      const apiUrl = `https://api.kenliejugarap.com/blackbox-claude/?text=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Vérifier si l'API a retourné une réponse valide
      const text = response.data?.response;
      if (!text) {
        throw new Error("Réponse invalide de l'API.");
      }

      // Ajouter un style à la réponse
      const formattedResponse = `─────★─────\n` +
                                `✨haiku Claude\n\n${text}\n` +
                                `─────★─────`;

      // Gérer les réponses longues de plus de 2000 caractères
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
      console.error('Erreur lors de l\'appel à l\'API Blackbox Claude:', error);
      // Message de réponse d'erreur
      await sendMessage(senderId, { text: 'Désolé, une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};

// Fonction pour découper les messages en morceaux de 2000 caractères
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
