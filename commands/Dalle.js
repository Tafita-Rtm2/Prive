const axios = require('axios');

module.exports = {
  name: 'gpt4o-pro',
  description: 'Répond à une question via l’API Playground.',
  author: 'Kaiz Integration',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    // Vérification de prompt valide
    if (!prompt) {
      return sendMessage(
        senderId,
        { text: "─────★─────\n✨Gpt4o pro\n👋 Merci de me choisir comme répondeur automatique ! ♊ Posez vos questions, je suis prêt ! 😉\n─────★─────." },
        pageAccessToken
      );
    }

    try {
      // URL de l'API avec le prompt et l'UID
      const apiUrl = `https://playground.y2pheq.me/gpt4?prompt=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

      // Informer l'utilisateur que la réponse est en cours
      await sendMessage(
        senderId,
        { text: '💬 Gpt4o pro est en train de répondre⏳...\n─────★─────' },
        pageAccessToken
      );

      // Appel API
      const response = await axios.get(apiUrl);

      // Extraire la réponse depuis la clé 'result'
      const text = response.data?.result || "❌ Je n'ai pas pu obtenir une réponse valide.";

      // Obtenir l'heure actuelle de Madagascar
      const madagascarTime = getMadagascarTime();

      // Réponse formatée
      const formattedResponse = `─────★─────\n✨Gpt4o pro\n\n${text}\n─────★─────\n🕒 ${madagascarTime}`;

      // Envoyer la réponse
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

    } catch (error) {
      console.error("Erreur API :", error.message);

      // Gestion des erreurs
      await sendMessage(
        senderId,
        { text: "❌ Une erreur est survenue lors de la communication avec l'API. Veuillez réessayer plus tard." },
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
  return madagascarDate;
}
