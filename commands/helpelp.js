const axios = require('axios');

module.exports = {
  name: 'aidetect',
  description: 'Détecte si un texte est généré par une IA via l\'API AI Detector.',
  author: 'Kaiz API Integration',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    // Vérifier si un texte valide est fourni
    if (!prompt) {
      return sendMessage(
        senderId,
        { text: "─────★─────\n✨AI Detect\n👋 Merci de me choisir pour vérifier vos textes ! 🧠\nVeuillez fournir un texte pour analyse.\n─────★─────." },
        pageAccessToken
      );
    }

    try {
      // Construire l'URL pour appeler l'API aidetector-v2
      const apiUrl = `https://kaiz-apis.gleeze.com/api/aidetector-v2?q=${encodeURIComponent(prompt)}`;

      // Informer l'utilisateur que l'analyse est en cours
      await sendMessage(
        senderId,
        { text: '🧠 Analyse de votre texte en cours⏳...\n─────★─────' },
        pageAccessToken
      );

      // Appel à l'API aidetector-v2
      const response = await axios.get(apiUrl);

      // Vérifier si la réponse est valide
      const result = response.data?.result || "Désolé, je n'ai pas pu obtenir une réponse valide.";
      const score = response.data?.score !== undefined ? ` (Score : ${response.data.score}%)` : '';

      // Obtenir la date et l'heure actuelle de Madagascar
      const madagascarTime = getMadagascarTime();

      // Formater la réponse finale
      const formattedResponse = `─────★─────\n` +
                                `✨AI Detect\n\nRésultat : ${result}${score}\n` +
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
      console.error('Erreur lors de l\'appel à l\'API AI Detector :', error);

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
