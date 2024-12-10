const axios = require('axios');

module.exports = {
  name: 'gemini-chat',
  description: 'Pose une question à Gemini via son API.',
  async execute(senderId, args, pageAccessToken, sendMessage, commandName) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "❌ Veuillez entrer une question ou envoyer une image valide." }, pageAccessToken);
    }

    const apiUrl = `http://sgp1.hmvhostings.com:25721/gemini?question=${encodeURIComponent(prompt)}`;

    try {
      await sendMessage(senderId, { text: "💬 Gemini réfléchit à ta question...⏳" }, pageAccessToken);

      const response = await axios.get(apiUrl);
      const text = response.data.response;

      if (!text || typeof text !== 'string') {
        throw new Error("La réponse de Gemini est invalide ou vide.");
      }

      await sendMessage(senderId, { text: `🔮 **Gemini** :\n\n${text.trim()}` }, pageAccessToken);
    } catch (error) {
      console.error("Erreur lors de l'appel à Gemini :", error.message);

      await sendMessage(senderId, {
        text: "❌ Une erreur est survenue lors de l'appel à Gemini. Veuillez réessayer plus tard.",
      }, pageAccessToken);
    }
  },
};
