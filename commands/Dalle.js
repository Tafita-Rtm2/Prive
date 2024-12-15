const axios = require('axios');

const imageCache = {};

module.exports = {
  name: 'gpt4o-pro',
  description: "Analyse une image ou répond à une question texte via l'API Kaiz.",
  author: 'Kaiz Integration',

  async execute(senderId, args, attachments, pageAccessToken, sendMessage) {
    try {
      const prompt = args.join(' ').trim();

      if (attachments && Array.isArray(attachments) && attachments.length > 0 && attachments[0]?.type === 'image') {
        const imageUrl = attachments[0].payload?.url;
        if (!imageUrl) throw new Error("L'URL de l'image est manquante.");

        imageCache[senderId] = imageUrl;
        await sendMessage(senderId, { text: '✅ Image reçue ! Veuillez ajouter du texte pour que je puisse analyser l’image.' }, pageAccessToken);
        return;
      }

      if (prompt && !imageCache[senderId]) {
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
        await sendMessage(senderId, { text: '⏳ Réponse en cours de génération...' }, pageAccessToken);

        const response = await axios.get(apiUrl);
        const text = response.data?.response || "Désolé, aucune réponse n'a pu être obtenue.";
        return sendMessage(senderId, { text: `✨Gpt4o pro\n\n${text}\n🕒 ${getMadagascarTime()}` }, pageAccessToken);
      }

      if (prompt && imageCache[senderId]) {
        const storedImageUrl = imageCache[senderId];
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?imageUrl=${encodeURIComponent(storedImageUrl)}&q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;

        await sendMessage(senderId, { text: '⏳ Analyse de l’image en cours, veuillez patienter...' }, pageAccessToken);
        const response = await axios.get(apiUrl);

        const text = response.data?.response || "Désolé, aucune réponse n'a pu être obtenue.";
        delete imageCache[senderId];

        return sendMessage(senderId, { text: `✨Gpt4o pro\n\n${text}\n🕒 ${getMadagascarTime()}` }, pageAccessToken);
      }

      return sendMessage(senderId, { text: "❌ Veuillez ajouter une image ou du texte pour commencer l'analyse." }, pageAccessToken);
    } catch (error) {
      console.error('Erreur lors de l\'exécution :', error.message);
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};

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
