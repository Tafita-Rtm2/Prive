const axios = require('axios');

module.exports = {
  name: 'gemini-ai',
  description: 'Pose une question ou analyse une image via l’API Gemini.',
  author: 'Deku (texte & image)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez fournir une question ou une URL d'image valide." }, pageAccessToken);
    }

    try {
      let apiUrl;

      if (prompt.startsWith('http://') || prompt.startsWith('https://')) {
        // Analyse d'image
        const imageUrl = prompt;
        apiUrl = `http://sgp1.hmvhostings.com:25721/gemini?imageUrl=${encodeURIComponent(imageUrl)}`;
        await sendMessage(senderId, { text: '📷 Analyse de votre image en cours⏳...\n\n─────★─────' }, pageAccessToken);
      } else {
        // Question texte
        apiUrl = `http://sgp1.hmvhostings.com:25721/gemini?question=${encodeURIComponent(prompt)}`;
        await sendMessage(senderId, { text: '💬 Gemini AI est en train de répondre⏳...\n\n─────★─────' }, pageAccessToken);
      }

      // Appel à l'API Gemini
      const response = await axios.get(apiUrl);

      // Vérifier et récupérer la réponse
      const text = response.data[0]?.answer || "Désolé, je n'ai pas pu obtenir une réponse valide.";
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
      console.error('Erreur lors de l\'appel à l\'API Gemini :', error);
      // Envoyer un message d'erreur en cas de problème
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
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
