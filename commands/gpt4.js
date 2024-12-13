const axios = require('axios');

module.exports = {
  name: 'claude-sonnet',
  description: 'Pose une question à Claude Sonnet 3.5 via l’API fournie.',
  author: 'Votre nom',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Informer l'utilisateur que la réponse est en cours
      await sendMessage(senderId, { text: '💬 Claude Sonnet 3.5 est en train de répondre⏳...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API
      const apiUrl = `https://kaiz-apis.gleeze.com/api/claude-sonnet-3.5?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
      const response = await axios.get(apiUrl);

      // Extraire le texte de réponse
      const text = response.data?.response || 'Désolé, je n\'ai pas pu obtenir une réponse valide.';

      // Obtenir la date et l'heure actuelles de Madagascar
      const madagascarTime = getMadagascarTime();

      // Formater la réponse
      const formattedResponse = `─────★─────\n` +
                                `✨Claude Sonnet 3.5\n\n${text}\n` +
                                `─────★─────\n` +
                                `🕒 ${madagascarTime}`;

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
      console.error('Erreur lors de l\'appel à l\'API Claude Sonnet 3.5 :', error);
      // Envoyer un message d'erreur en cas de problème
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};

// Fonction pour obtenir l'heure et la date de Madagascar
function getMadagascarTime() {
  const options = { timeZone: 'Indian/Antananarivo', hour12: false };
  const madagascarDate = new Date().toLocaleString('fr-FR', {
    ...options,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return madagascarDate; // Exemple : "vendredi 13 décembre 2024, 16:40:45"
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
