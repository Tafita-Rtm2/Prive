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
      // --- 1. L'utilisateur envoie uniquement une image ---
      if (attachments && attachments.length > 0 && attachments[0].type === 'image') {
        const imageUrl = attachments[0].payload.url;

        // Stocker temporairement l'image pour cet utilisateur
        imageCache[senderId] = imageUrl;

        // Envoyer une demande pour ajouter du texte
        return sendMessage(
          senderId,
          { text: '✅ Image reçue ! Veuillez ajouter du texte pour que je puisse analyser l’image.' },
          pageAccessToken
        );
      }

      // --- 2. L'utilisateur envoie du texte uniquement ---
      if (prompt && !imageCache[senderId]) {
        // Analyse texte uniquement
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

        // Informer l'utilisateur que la réponse est en cours
        await sendMessage(
          senderId,
          { text: '⏳ Réponse en cours de génération...' },
          pageAccessToken
        );

        // Appel API
        const response = await axios.get(apiUrl);
        const text = response.data?.response || "Désolé, aucune réponse n'a pu être obtenue.";

        // Envoyer la réponse finale
        return sendMessage(
          senderId,
          { text: `✨Gpt4o pro\n\n${text}\n🕒 ${getMadagascarTime()}` },
          pageAccessToken
        );
      }

      // --- 3. L'utilisateur envoie du texte après avoir envoyé une image ---
      if (prompt && imageCache[senderId]) {
        const storedImageUrl = imageCache[senderId];

        // Construire l'URL API avec image et texte
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?imageUrl=${encodeURIComponent(storedImageUrl)}&q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

        // Informer que l'analyse est en cours
        await sendMessage(
          senderId,
          { text: '⏳ Analyse de l’image en cours, veuillez patienter...' },
          pageAccessToken
        );

        // Appel API
        const response = await axios.get(apiUrl);
        const text = response.data?.response || "Désolé, aucune réponse n'a pu être obtenue.";

        // Nettoyer l'image stockée
        delete imageCache[senderId];

        // Envoyer la réponse finale
        return sendMessage(
          senderId,
          { text: `✨Gpt4o pro\n\n${text}\n🕒 ${getMadagascarTime()}` },
          pageAccessToken
        );
      }

      // --- 4. Aucun texte ou action incorrecte ---
      return sendMessage(
        senderId,
        { text: "❌ Veuillez ajouter une image ou du texte pour commencer l'analyse." },
        pageAccessToken
      );
    } catch (error) {
      console.error('Erreur lors de l\'exécution :', error.message);

      // Gestion des erreurs
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
