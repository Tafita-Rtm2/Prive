const axios = require('axios');

module.exports = {
  name: 'gpt4o-pro',
  description: 'Analyse une image ou répond à une question via l’API Kaiz.',
  author: 'Kaiz Integration',
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
        apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?imageUrl=${encodeURIComponent(imageUrl)}&uid=${encodeURIComponent(senderId)}`;
        await sendMessage(senderId, { text: '📷 Analyse de votre image en cours⏳...\n\n─────★─────' }, pageAccessToken);
      } else {
        // Question texte
        apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
        await sendMessage(senderId, { text: '💬 Gpt4o pro est en train de répondre⏳...\n\n─────★─────' }, pageAccessToken);
      }

      // Appel à l'API Kaiz
      const response = await axios.get(apiUrl);

      // Vérifier et récupérer la réponse
      const text = response.data?.response || "Désolé, je n'ai pas pu obtenir une réponse valide.";
      const formattedResponse = `─────★─────\n` +
                                `✨Gpt4o pro\n\n${text}\n` +
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
      console.error('Erreur lors de l\'appel à l\'API Kaiz :', error);
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
