const axios = require('axios');

// Stocker les conversations dans un objet pour chaque utilisateur
const conversations = {};

module.exports = {
  name: 'gpt-4o-pro',
  description: 'Pose une question à GPT-4o Pro via l’API fournie avec gestion du contexte.',
  author: 'Votre nom',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    // Vérifier que l'utilisateur a bien posé une question
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
      // Informer l'utilisateur que le bot est en train de répondre
      await sendMessage(
        senderId,
        { text: '💬 GPT-4o Pro est en train de répondre⏳...\n\n─────★─────' },
        pageAccessToken
      );

      // Initialiser ou récupérer l'historique de conversation de l'utilisateur
      if (!conversations[senderId]) {
        conversations[senderId] = [];
      }

      // Ajouter la question de l'utilisateur à l'historique
      conversations[senderId].push(`Utilisateur : ${prompt}`);

      // Construire le contexte pour l'API (limiter à 10 derniers messages pour éviter trop de données)
      const context = conversations[senderId].slice(-10).join('\n');

      // Construire l'URL de l'API avec le contexte
      const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(
        context
      )}&uid=${encodeURIComponent(senderId)}`;

      // Appel à l'API
      const response = await axios.get(apiUrl);

      // Vérifier si l'API retourne une réponse valide
      const text = response.data?.response?.trim();
      if (!text) {
        throw new Error('Réponse invalide de l’API.');
      }

      // Ajouter la réponse de l'API à l'historique
      conversations[senderId].push(`GPT-4o Pro : ${text}`);

      // Obtenir l'heure et la date de Madagascar
      const madagascarTime = getMadagascarTime();

      // Formater la réponse correctement
      const formattedResponse = `─────★─────\n` +
                                `✨GPT-4o Pro\n\n${text}\n` +
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

// Fonction pour obtenir l'heure et la date de Madagascar
function getMadagascarTime() {
  const options = { timeZone: 'Indian/Antananarivo', hour12: false };
  return new Date().toLocaleString('fr-FR', {
    ...options,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
