const axios = require('axios');

module.exports = {
  name: 'haiku',
  description: 'Pose une question à l\'API Haiku et obtient une réponse.',
  author: 'ArYAN',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const query = args.join(' ');

    if (!query) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'IA réfléchit
      const thinkingMessage = await sendMessage(senderId, { text: '🪐 Haiku réfléchit ⏳... 🤔' }, pageAccessToken);

      // Appel à l'API Haiku
      const response = await callHaikuAPI(query);

      // Envoyer la réponse formatée
      const formattedResponse = `🖋️ | Haiku AI:\n━━━━━━━━━━━━━━━━\n${response}\n━━━━━━━━━━━━━━━━`;
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

      // Supprimer le message d'attente
      await thinkingMessage.delete();

    } catch (error) {
      console.error('Erreur lors de la requête à l\'API Haiku :', error);
      await sendMessage(senderId, { text: 'Erreur lors de l\'utilisation de l\'IA.' }, pageAccessToken);
    }
  }
};

// Fonction pour appeler l'API Haiku
async function callHaikuAPI(prompt) {
  const apiUrl = `https://api.ruii.site/api/haiku?q=${encodeURIComponent(prompt)}`;
  try {
    const response = await axios.get(apiUrl);
    if (response.data && response.data.answer) {
      return response.data.answer;
    }
    throw new Error('Réponse invalide de l\'API Haiku');
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API Haiku:', error.message);
    throw new Error('Impossible de contacter l\'API Haiku.');
  }
}
