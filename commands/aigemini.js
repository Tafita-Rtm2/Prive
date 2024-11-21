const axios = require('axios');

module.exports = {
  name: 'gemini-chat',
  description: 'Pose une question à Gemini via l\'API fournie.',
  author: 'Deku (rest api)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que Gemini est en train de répondre
      await sendMessage(senderId, { text: '💬 Gemini est en train de te répondre⏳...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API
      const apiUrl = `https://api.kenliejugarap.com/blackbox-gemini/?text=${encodeURIComponent(prompt)}`;
      
      // Faire la requête à l'API
      const response = await axios.get(apiUrl);

      // Extraire uniquement la réponse du champ attendu
      const text = response.data; // Assurez-vous que la réponse est bien sous cette structure.

      // Formater la réponse
      const formattedResponse = `─────★─────\n` +
                                `✨Gemini\n\n${text}\n` +
                                `─────★─────`;

      // Envoyer la réponse au destinataire
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
