const axios = require('axios');

module.exports = {
  name: 'gemini',
  description: 'Pose une question à l\'API Gemini et obtient une réponse.',
  author: 'ArYAN',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const query = args.join(' ');

    if (!query) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'IA réfléchit
      const thinkingMessage = await sendMessage(senderId, { text: '🌌 Gemini réfléchit ⏳...' }, pageAccessToken);

      // Appeler l'API pour obtenir la réponse
      const response = await callGeminiAPI(query);

      // Envoyer la réponse formatée
      const formattedResponse = `✨ | Résultat Gemini\n━━━━━━━━━━━━━━━━\n${response}\n━━━━━━━━━━━━━━━━`;
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

      // Supprimer le message d'attente
      await thinkingMessage.delete();

    } catch (error) {
      console.error('Erreur lors de la requête à Gemini :', error);
      await sendMessage(senderId, { text: 'Tapez le bouton menu pour quitter la réponse de gemini google ai et passer à une autre IA 🚫 ou poser votre question si vous voulez continuer avec gemini. 🤖' }, pageAccessToken);
    }
  }
};

// Fonction pour appeler l'API Gemini
async function callGeminiAPI(prompt) {
  const apiUrl = `https://api.ruii.site/api/gemini?q=${encodeURIComponent(prompt)}`;
  try {
    const response = await axios.get(apiUrl);
    console.log('Réponse brute de l\'API:', response.data);
    if (response.data && response.data.message) {
      return response.data.message; // Extraire la propriété `message` de la réponse
    }
    throw new Error('La réponse de l\'API ne contient pas "message"');
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API Gemini:', error.message);
    throw new Error('Impossible de contacter l\'API Gemini.');
  }
}
