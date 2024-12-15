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
        const imageUrl = attachments[0].payload.url;

        // Stocker temporairement l'image
        imageCache[senderId] = imageUrl;

        // Informer l'utilisateur que l'image est reçue
        return sendMessage(
          senderId,
          { text: '✅ Image reçue ! Veuillez maintenant poser votre question ou fournir du texte pour l’analyse.' },
          pageAccessToken
        );
      }

      // --- 2. L'utilisateur envoie un texte ---
      if (prompt) {
        const storedImageUrl = imageCache[senderId]; // Vérifier si une image est stockée
        let apiUrl;

        if (storedImageUrl) {
          // Utiliser l'image stockée + texte pour l'analyse
          apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?imageUrl=${encodeURIComponent(storedImageUrl)}&q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
          delete imageCache[senderId]; // Nettoyer après utilisation
        } else {
          // Analyse texte uniquement
          apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
        }

        // Indiquer que la réponse est en cours
        await sendMessage(
          senderId,
          { text: '⏳ Analyse en cours, veuillez patienter...' },
          pageAccessToken
        );

        // Appel API
        const response = await axios.get(apiUrl);

        // Extraire la réponse
        const text = response.data?.response || "Désolé, aucune réponse n'a pu être obtenue.";

        // Formater et envoyer la réponse finale
        const madagascarTime = getMadagascarTime();
        const formattedResponse = `✨Gpt4o pro\n\n${text}\n🕒 ${madagascarTime}`;

        await sendMessage(
          senderId,
          { text: formattedResponse },
          pageAccessToken
        );

        return;
      }

      // --- 3. Aucun texte ni image n'est envoyé ---
      return sendMessage(
        senderId,
        { text: "❌ Veuillez envoyer une image ou poser une question texte pour continuer." },
        pageAccessToken
      );
    } catch (error) {
      console.error('Erreur lors de l\'exécution :', error.message);

      // Gestion des erreurs : réponse utilisateur
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
