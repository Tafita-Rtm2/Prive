const axios = require('axios');

module.exports = {
  name: 'chatgpt4-o',
  description: 'Pose une question à l\'API GPT4O et obtient la réponse.',
  author: 'ArYAN',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const query = args.join(' ');

    if (!query) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'IA réfléchit
      const thinkingMessage = await sendMessage(senderId, { text: '🤖 GPT4O réfléchit ⏳...' }, pageAccessToken);

      // Appeler l'API pour obtenir la réponse
      const response = await callGpt4oAPI(query);

      // Envoyer la réponse formatée
      const formattedResponse = `🌐 | Résultat GPT4O\n━━━━━━━━━━━━━━━━\n${response}\n━━━━━━━━━━━━━━━━`;
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

      // Supprimer le message d'attente
      await thinkingMessage.delete();

    } catch (error) {
      console.error('Erreur lors de la requête à l\'IA :', error);
      await sendMessage(senderId, { text: 'taper le bouton menu pour quiter gpt4-o et passer a une autre ia ou pose votre question si vou voulez continuer.' }, pageAccessToken);
    }
  }
};

// Fonction pour appeler l'API GPT4O
async function callGpt4oAPI(prompt) {
  const apiUrl = `https://api.ruii.site/api/gpt4o?q=${encodeURIComponent(prompt)}`;
  try {
    const response = await axios.get(apiUrl);
    console.log('Réponse brute de l\'API:', response.data);
    if (response.data && response.data.message) {
      return response.data.message; // Extraire la propriété `message` de la réponse
    }
    throw new Error('La réponse de l\'API ne contient pas "message"');
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API GPT4O:', error.message);
    throw new Error('Impossible de contacter l\'API GPT4O.');
  }
}
