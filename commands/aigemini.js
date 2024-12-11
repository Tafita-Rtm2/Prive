const axios = require('axios');

module.exports = {
  name: 'gemini-ai',
  description: 'Pose une question à Gemini AI via l’API fournie.',
  author: 'Votre nom',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que Gemini AI est en train de répondre
      await sendMessage(senderId, { text: '💬 Gemini AI est en train de te répondre⏳...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API Gemini AI
      const apiUrl = `http://sgp1.hmvhostings.com:25721/gemini?question=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Utiliser le bon champ de réponse
      const text = response.data.answer || 'Désolé, je n\'ai pas pu obtenir une réponse valide.';

      // Formater la réponse
      const formattedResponse = `─────★─────\n` +
                                `✨Gemini AI\n\n${text}\n` +
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
      console.error('Erreur lors de l\'appel à l\'API Gemini AI :', error);
      // Envoyer un message d'erreur en cas de problème
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
