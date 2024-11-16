const axios = require('axios');

module.exports = {
  name: 'claude-aiv3',
  description: 'Pose une question à l\'API Haiku et obtient la réponse.',
  author: 'ArYAN',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const query = args.join(' ');

    if (!query) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'IA réfléchit
      const thinkingMessage = await sendMessage(senderId, { text: '✔claude v3 réfléchit ⏳...' }, pageAccessToken);

      // Appeler l'API pour obtenir la réponse
      const response = await callHaikuAPI(query);

      // Envoyer la réponse formatée
      const formattedResponse = `📝 | Résultat Haiku v3\n━━━━━━━━━━━━━━━━\n${response}\n━━━━━━━━━━━━━━━━`;
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

      // Supprimer le message d'attente
      await thinkingMessage.delete();

    } catch (error) {
      console.error('Erreur lors de la requête à l\'IA :', error);
      await sendMessage(senderId, { text: 'taper le bouton menu pour quiter la reponse de claude et passe a une autre ia 🚫.' }, pageAccessToken);
    }
  }
};

// Fonction pour appeler l'API Haiku
async function callHaikuAPI(prompt) {
  const apiUrl = `https://api.ruii.site/api/haiku?q=${encodeURIComponent(prompt)}`;
  try {
    const response = await axios.get(apiUrl);
    console.log('Réponse brute de l\'API:', response.data);
    if (response.data && response.data.message) {
      return response.data.message; // Extraire la propriété `message` de la réponse
    }
    throw new Error('La réponse de l\'API ne contient pas "message"');
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API Haiku:', error.message);
    throw new Error('Impossible de contacter l\'API Haiku.');
  }
}
