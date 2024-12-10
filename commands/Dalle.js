const axios = require('axios');

module.exports = {
  name: 'gpt4o-pro',
  description: 'Pose une question ou analyse une image via l’API GPT4o Pro.',
  author: 'Deku',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez fournir une question ou une URL d'image valide." }, pageAccessToken);
    }

    try {
      let apiUrl;

      if (prompt.startsWith('http://') || prompt.startsWith('https://')) {
        // Analyse d'image avec GPT4o Pro
        apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o-pro?imageUrl=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
        await sendMessage(senderId, { text: '📷 GPT4o Pro est en train d\'analyser votre image ⏳...\n\n─────★─────' }, pageAccessToken);
      } else {
        // Question texte avec GPT4o Pro
        apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
        await sendMessage(senderId, { text: '💬 GPT4o Pro est en train de répondre ⏳...\n\n─────★─────' }, pageAccessToken);
      }

      // Appel à l'API GPT4o Pro
      const response = await axios.get(apiUrl);

      // Vérifiez la réponse de l'API
      const text = response.data.answer || "Désolé, je n'ai pas pu obtenir une réponse valide.";
      const formattedResponse = `─────★─────\n` +
                                `✨GPT4o Pro\n\n${text}\n` +
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
      console.error('Erreur lors de l\'appel à l\'API GPT4o Pro :', error);
      await sendMessage(senderId, { text: '❌ Une erreur est survenue avec GPT4o Pro. Veuillez réessayer plus tard.' }, pageAccessToken);
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
