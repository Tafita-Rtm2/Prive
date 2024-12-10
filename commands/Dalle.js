const axios = require('axios');

module.exports = {
  name: 'gpt4o-pro',
  description: 'Pose une question ou analyse une image via l’API GPT4o Pro.',
  author: 'Deku (image & texte)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt && !args.imageUrl) {
      return sendMessage(senderId, { text: "Veuillez fournir une question ou une URL d'image valide." }, pageAccessToken);
    }

    try {
      // Vérification si l'utilisateur envoie une URL d'image ou une simple question
      let apiUrl;

      if (prompt.startsWith('http://') || prompt.startsWith('https://')) {
        // Analyse d'image
        const imageUrl = prompt;
        apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o-pro?imageUrl=${encodeURIComponent(imageUrl)}&uid=${senderId}`;
        await sendMessage(senderId, { text: '📷 Analyse de votre image en cours⏳...\n\n─────★─────' }, pageAccessToken);
      } else {
        // Question texte
        apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o-pro?q=${encodeURIComponent(prompt)}&uid=${senderId}`;
        await sendMessage(senderId, { text: '💬 GPT4o Pro est en train de répondre⏳...\n\n─────★─────' }, pageAccessToken);
      }

      // Appel à l'API GPT4o Pro
      const response = await axios.get(apiUrl);

      // Récupérer et formater la réponse
      const text = response.data.response || "Désolé, je n'ai pas pu obtenir une réponse.";
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
