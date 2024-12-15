const axios = require('axios');

const imageCache = {}; // Stock temporaire pour les images reçues

module.exports = {
  name: 'gpt4o-pro',
  description: 'Analyse une image ou répond à une question via l’API Kaiz.',
  author: 'Kaiz Integration',

  async execute(senderId, args, attachments, pageAccessToken, sendMessage) {
    try {
      const prompt = args.join(' ').trim();

      // 1. Gestion des images reçues
      if (attachments && attachments.length > 0 && attachments[0].type === 'image') {
        const imageUrl = attachments[0].payload?.url; // Extraire l'URL de l'image
        if (!imageUrl) throw new Error("URL de l'image non trouvée.");

        imageCache[senderId] = imageUrl;

        await sendMessage(
          senderId,
          { text: '✅ Image reçue ! Que voulez-vous que je fasse avec cette image ? Envoyez-moi un texte explicatif.' },
          pageAccessToken
        );
        return;
      }

      // 2. Analyse avec image en cache
      if (prompt && imageCache[senderId]) {
        const storedImageUrl = imageCache[senderId];
        delete imageCache[senderId];

        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?imageUrl=${encodeURIComponent(storedImageUrl)}&q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

        await sendMessage(
          senderId,
          { text: '⏳ Analyse de l’image avec votre texte en cours. Veuillez patienter...' },
          pageAccessToken
        );

        const response = await axios.get(apiUrl);
        const text = response.data?.response || "Désolé, je n'ai pas pu obtenir une réponse valide.";

        const madagascarTime = getMadagascarTime();
        return sendMessage(senderId, { text: `✨Gpt4o pro\n\n${text}\n🕒 ${madagascarTime}` }, pageAccessToken);
      }

      // 3. Réponse normale aux textes
      if (prompt) {
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

        await sendMessage(
          senderId,
          { text: '⏳ Gpt4o pro est en train de répondre. Veuillez patienter...' },
          pageAccessToken
        );

        const response = await axios.get(apiUrl);
        const text = response.data?.response || "Désolé, je n'ai pas pu obtenir une réponse valide.";

        const madagascarTime = getMadagascarTime();
        return sendMessage(senderId, { text: `✨Gpt4o pro\n\n${text}\n🕒 ${madagascarTime}` }, pageAccessToken);
      }

      // 4. Aucune entrée fournie
      await sendMessage(
        senderId,
        { text: "❌ Veuillez envoyer une image ou poser une question pour commencer l'analyse." },
        pageAccessToken
      );
    } catch (error) {
      console.error("Erreur dans l'exécution :", error.message);
      await sendMessage(
        senderId,
        { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' },
        pageAccessToken
      );
    }
  }
};

// Fonction pour obtenir l'heure actuelle de Madagascar
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
