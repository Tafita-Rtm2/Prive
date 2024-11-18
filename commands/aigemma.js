const axios = require('axios');

module.exports = {
  name: 'gemma-7b',
  description: 'Pose une question à l\'API Gemma-7b ou analyse une image.',
  author: 'Deku (Gemma API)',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "❌ Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'IA réfléchit
      await sendMessage(senderId, { text: '💬 Gemma-7b réfléchit...⏳\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API Gemma-7b
      const apiUrl = `https://joshweb.click/api/gemma-7b?q=${encodeURIComponent(prompt)}`;

      // Appeler l'API
      const response = await axios.get(apiUrl);

      // Extraire la réponse
      const text = response.data.result;

      // Créer un style pour la réponse de Gemma-7b
      const formattedResponse = `─────★─────\n` +
                                `✨Gemma-7b 🤖\n\n${text}\n` +
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
      console.error('Erreur lors de l\'appel à l\'API Gemma-7b :', error);
      // Envoyer un message d'erreur
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
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
