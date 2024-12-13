const axios = require('axios');

module.exports = {
  name: 'gpt4o-pro',
  description: 'Analyse une image ou répond à une question via l’API GPT4o.',
  author: 'Kaiz Integration',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    // Vérifier si un prompt valide est fourni
    if (!prompt) {
      return sendMessage(
        senderId,
        { text: "Veuillez fournir une question ou une URL d'image valide." },
        pageAccessToken
      );
    }

    try {
      let apiUrl;

      // Construire l'URL pour une question texte
      apiUrl = `https://markdevs-last-api-2epw.onrender.com/api/v2/gpt4?query=${encodeURIComponent(prompt)}`;

      // Informer l'utilisateur que la réponse est en cours de génération
      await sendMessage(
        senderId,
        { text: '💬 Gpt4o pro est en train de répondre⏳...\n\n─────★─────' },
        pageAccessToken
      );

      // Appel à l'API GPT4o
      const response = await axios.get(apiUrl);

      // Vérifier si la réponse est valide
      const text = response.data?.respond || "Désolé, je n'ai pas pu obtenir une réponse valide.";

      // Obtenir la date et l'heure actuelle de Madagascar
      const madagascarTime = getMadagascarTime();

      // Formater la réponse finale
      const formattedResponse = `─────★─────\n` +
                                `✨Gpt4o pro\n\n${text}\n` +
                                `─────★─────\n` +
                                `🕒 ${madagascarTime}`;

      // Gérer les réponses longues (découper en morceaux si nécessaire)
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
      console.error('Erreur lors de l\'appel à l\'API GPT4o :', error);

      // Envoyer un message d'erreur si l'appel API échoue
      await sendMessage(
        senderId,
        { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' },
        pageAccessToken
      );
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
  return madagascarDate; // Exemple : "vendredi 13 décembre 2024, 16:30:45"
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
