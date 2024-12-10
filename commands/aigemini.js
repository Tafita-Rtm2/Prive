const axios = require('axios');

// Mémoire temporaire des conversations pour chaque utilisateur
const userConversations = new Map();

module.exports = {
  name: 'gemini',
  description: 'Pose une question ou analyse une image via Gemini API.',
  author: 'Deku (rest api)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "❌ Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Récupérer ou initialiser l'historique de conversation de l'utilisateur
      const history = userConversations.get(senderId) || [];
      
      // Envoyer un message indiquant que Gemini est en train de répondre
      await sendMessage(
        senderId,
        { text: '💬 Gemini est en train de réfléchir à ta question...⏳\n\n─────★─────' },
        pageAccessToken
      );

      // Construire l'URL de l'API avec le contexte
      const conversationContext = history.map(h => `${h.sender}: ${h.message}`).join('\n');
      const fullPrompt = `${conversationContext}\nUser: ${prompt}\nGemini:`;

      const apiUrl = `http://sgp1.hmvhostings.com:25721/gemini?question=${encodeURIComponent(fullPrompt)}`;

      // Effectuer la requête à l'API
      const response = await axios.get(apiUrl);

      // Vérifier que la réponse contient le champ "response"
      const text = response.data.response;

      if (!text || typeof text !== 'string') {
        throw new Error('La réponse de l\'API est invalide ou vide.');
      }

      // Ajouter l'entrée et la réponse dans l'historique de conversation
      history.push({ sender: 'User', message: prompt });
      history.push({ sender: 'Gemini', message: text });
      userConversations.set(senderId, history);

      // Limiter l'historique à 20 minutes
      setTimeout(() => userConversations.delete(senderId), 20 * 60 * 1000);

      // Formater la réponse
      const formattedResponse = `─────★─────\n✨ **Gemini**\n\n${text.trim()}\n─────★─────`;

      // Envoyer la réponse formatée
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
        { text: '❌ Désolé, une erreur est survenue lors de l\'appel à l\'API Gemini. Veuillez réessayer plus tard.' },
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
