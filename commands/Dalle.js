const axios = require('axios');

module.exports = {
  name: 'chatgpt4o-pro',
  description: 'Récupère les dernières nouvelles à Madagascar via une API externe.',
  author: 'Deku (rest api)',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une requête valide." }, pageAccessToken);
    }

    try {
      // Indiquer que l'API est en cours de traitement
      await sendMessage(senderId, { text: '🔄 reponse de gpt4o pro en cours , merci de patienter...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL avec les paramètres
      const apiUrl = `https://ccprojectapis.ddns.net/gpt4o-pro?q=${encodeURIComponent(prompt)}&uid=${senderId}&imageUrl=`;

      // Faire une requête GET à l'API
      const response = await axios.get(apiUrl);

      // Vérifier si la réponse est valide
      const { data } = response;
      if (!data || !data.response) {
        throw new Error('La réponse de l\'API est vide ou invalide.');
      }

      // Extraire les données nécessaires
      const text = data.response;
      const formattedResponse = `─────★─────\n` +
        `📰 Dernières nouvelles :\n\n${text}\n` +
        `─────★─────`;

      // Envoyer la réponse
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
      console.error('Erreur lors de l\'appel à l\'API :', error);
      
      // Envoyer un message d'erreur
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
