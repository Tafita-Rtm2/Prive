const axios = require('axios');

module.exports = {
  name: 'gemini',
  description: 'Pose une question à Gemini via l’API fournie.',
  author: 'Deku (rest api)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Informer que Gemini est en train de répondre
      await sendMessage(senderId, { text: '💬 Gemini est en train de te répondre ⏳...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API Gemini
      const apiUrl = `https://ccprojectapis.ddns.net/api/gen?ask=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Vérifier si la réponse est valide
      if (response.data && response.data.response) {
        const text = response.data.response;

        // Formater la réponse
        const formattedResponse = `─────★─────\n` +
                                  `✨Gemini\n\n${text}\n` +
                                  `─────★─────`;

        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      } else {
        throw new Error('La réponse de Gemini est invalide.');
      }

    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API Gemini :', error);

      // Envoyer un message d'erreur
      await sendMessage(senderId, { text: 'Désolé, une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};
