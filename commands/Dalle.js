const axios = require('axios');

module.exports = {
  name: 'gpt-4o',
  description: 'Pose une question à GPT-4o via l’API fournie.',
  author: 'Votre nom',

  // Exécution normale de la commande
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(
        senderId,
        {
          text: "✨ GPT-4o est prêt à répondre à vos questions. Posez-les, et j'y répondrai ! 😉",
        },
        pageAccessToken
      );
    }

    try {
      await sendMessage(senderId, { text: '💬 GPT-4o est en train de répondre... ⏳' }, pageAccessToken);

      const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
      const response = await axios.get(apiUrl);

      const text = response.data?.response?.trim();
      if (!text) throw new Error('Réponse invalide de l’API.');

      await sendMessage(senderId, { text: `✨ Réponse : ${text}` }, pageAccessToken);
    } catch (error) {
      console.error("Erreur lors de l'appel à l'API GPT-4o :", error);
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  },

  // Analyse d'image avec une question
  async analyzeImage(senderId, imageUrl, question, pageAccessToken, sendMessage) {
    try {
      await sendMessage(senderId, { text: '🔍 Analyse de l\'image en cours... ⏳' }, pageAccessToken);

      const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(question)}&uid=${encodeURIComponent(senderId)}&imageUrl=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(apiUrl);

      const text = response.data?.response?.trim();
      if (!text) throw new Error('Réponse invalide de l’API.');

      await sendMessage(senderId, { text: `📄 Résultat de l'analyse : ${text}` }, pageAccessToken });
    } catch (error) {
      console.error('Erreur lors de l\'analyse de l\'image :', error);
      await sendMessage(senderId, { text: '❌ Une erreur est survenue pendant l\'analyse de l\'image.' }, pageAccessToken);
    }
  },
};
