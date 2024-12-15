const axios = require('axios');

// Objet temporaire pour stocker les images par utilisateur
const imageCache = {};

module.exports = {
  name: 'gpt4o-pro',
  description: "Analyse une image ou répond à une question texte via l'API Kaiz.",
  author: 'Kaiz Integration',

  async execute(senderId, args, attachments, pageAccessToken, sendMessage) {
    const prompt = args.join(' ').trim(); // Texte envoyé par l'utilisateur

    try {
      // --- 1. L'utilisateur envoie une image ---
      if (attachments && attachments.length > 0 && attachments[0].type === 'image') {
        const imageUrl = attachments[0].payload.url; // Récupérer l'URL de l'image

        // Stocker l'image temporairement
        imageCache[senderId] = imageUrl;

        // Informer l'utilisateur que l'image est reçue
        return sendMessage(
          senderId,
          { text: '✅ Image reçue ! Vous pouvez maintenant poser une question ou donner un texte pour l’analyse.' },
          pageAccessToken
        );
      }

      // --- 2. L'utilisateur envoie un texte ---
      if (prompt) {
        // Cas où une image a été envoyée précédemment
        const storedImageUrl = imageCache[senderId];
        let apiUrl;

        if (storedImageUrl) {
          // L'image stockée est utilisée avec le texte
          apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?imageUrl=${encodeURIComponent(storedImageUrl)}&q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

          // Informer que l'analyse image + texte est en cours
          await sendMessage(
            senderId,
            { text: '📷 Analyse de votre image avec le texte en cours⏳...' },
            pageAccessToken
          );
        } else {
          // Aucune image stockée → question texte uniquement
          apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

          // Informer que la réponse texte est en cours
          await sendMessage(
            senderId,
            { text: '💬 Gpt4o pro est en train de répondre⏳...' },
            pageAccessToken
          );
        }

        // Appel à l'API Kaiz
        const response = await axios.get(apiUrl);

        // Extraire la réponse de l'API
        const text = response.data?.response || "Désolé, je n'ai pas pu obtenir une réponse valide.";

        // Formater la réponse avec l'heure locale de Madagascar
        const madagascarTime = getMadagascarTime();
        const formattedResponse = `─────★─────\n✨Gpt4o pro\n\n${text}\n─────★─────\n🕒 ${madagascarTime}`;

        // Envoyer la réponse
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

        // Nettoyer l'image stockée après utilisation
        delete imageCache[senderId];
      } else {
        // Aucun texte ni image → message d'erreur
        return sendMessage(
          senderId,
          { text: "❌ Veuillez envoyer une image ou poser une question texte pour continuer." },
          pageAccessToken
        );
      }
    } catch (error) {
      console.error("Erreur lors de l'appel à l'API Kaiz :", error.message);

      // Envoyer un message d'erreur
      await sendMessage(
        senderId,
        { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' },
        pageAccessToken
      );
    }
  }
};

// Fonction pour obtenir l'heure locale de Madagascar
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
