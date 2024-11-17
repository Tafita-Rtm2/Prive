const axios = require('axios');

module.exports = {
  name: 'chatgpt4-o',
  description: 'Pose une question à l\'API GPT4O et obtient la réponse.',
  author: 'ArYAN',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const query = args.join(' ');

    if (!query) {
      return sendMessage(senderId, { text: "❌ Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'IA réfléchit
      await sendMessage(senderId, { text: '🤖 GPT4O réfléchit ⏳ Patientez un instant...' }, pageAccessToken);

      // Appeler l'API pour obtenir la réponse
      const response = await callGpt4oAPI(query);

      // Diviser et envoyer la réponse par morceaux de 500 mots
      const chunks = splitResponseIntoChunks(response, 500);
      for (const chunk of chunks) {
        const formattedResponse = `🌐 | Résultat GPT4O\n━━━━━━━━━━━━━━━━\n${chunk}\n━━━━━━━━━━━━━━━━`;
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }
    } catch (error) {
      console.error('Erreur lors de la requête à l\'IA :', error);
      await sendMessage(senderId, {
        text: "❌ Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard. 🙁"
      }, pageAccessToken);
    }
  }
};

// Fonction pour appeler l'API GPT4O
async function callGpt4oAPI(prompt) {
  const apiUrl = `https://api.kenliejugarap.com/blackbox-gpt4o/?text=${encodeURIComponent(prompt)}`;
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

// Fonction pour diviser une réponse en morceaux de 500 mots
function splitResponseIntoChunks(response, wordLimit) {
  const words = response.split(' ');
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    if ((currentChunk.join(' ').split(' ').length + 1) > wordLimit) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
    currentChunk.push(word);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}
