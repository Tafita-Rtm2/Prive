const axios = require('axios');

module.exports = {
  name: 'gpt-4o-pro',
  description: 'Pose une question via l’API GPT-4o-Pro.',
  author: 'Votre nom',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(
        senderId,
        {
          text: "─────★─────\n✨GPT-4o Pro\n👋 Merci de me choisir comme assistant ! Posez votre question, et je vous répondrai avec plaisir ! 😉\n─────★─────.",
        },
        pageAccessToken
      );
    }

    try {
      // Informer l'utilisateur que la réponse est en cours
      await sendMessage(
        senderId,
        { text: '💬 GPT-4o Pro est en train de répondre⏳...\n\n─────★─────' },
        pageAccessToken
      );

      // Construire l'URL de l'API
      const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(
        prompt
      )}&uid=${encodeURIComponent(senderId)}`;

      // Appel à l'API
      const response = await axios.get(apiUrl);

      // Vérifier si l'API retourne une réponse valide
      const text = response.data?.response?.trim();
      if (!text) {
        throw new Error('Réponse invalide de l’API.');
      }

      // Obtenir l'heure actuelle
      const currentTime = getMadagascarTime();

      // Formater la réponse correctement
      const formattedResponse = `─────★─────\n` +
                                `✨GPT-4o Pro\n\n${text}\n` +
                                `─────★─────\n` +
                                `🕒 ${currentTime}`;

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
      console.error("Erreur lors de l'appel à l'API GPT-4o Pro :", error);

      // Envoyer un message d'erreur en cas de problème
      await sendMessage(
        senderId,
        { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' },
        pageAccessToken
      );
    }
  },
};

// Fonction pour obtenir l'heure et la date actuelles à Madagascar
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
  return madagascarDate; // Exemple : "samedi 21 décembre 2024, 10:30:45"
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
