const axios = require('axios');

module.exports = {
  name: 'turbo',
  description: 'Génère une image à partir d\'un prompt via l\'API Turbo Image Generator.',
  author: 'Custom',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "❌ Veuillez fournir une description pour générer une image." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'image est en cours de génération
      await sendMessage(senderId, { text: '💬 Génération de l\'image en cours...⏳' }, pageAccessToken);

      // Construire l'URL de l'API
      const apiUrl = `https://api.kenliejugarap.com/turbo-image-gen/?width=1024&height=1024&prompt=${encodeURIComponent(prompt)}`;

      // Appeler l'API
      const response = await axios.get(apiUrl);

      // Extraire l'URL de l'image générée
      const imageUrl = response.data.response;

      if (!imageUrl) {
        return sendMessage(senderId, { text: "❌ Aucun lien d'image générée n'a été reçu." }, pageAccessToken);
      }

      // Envoyer le lien de l'image générée
      const formattedResponse = `✅ Image générée avec succès !\n\nLien de l'image : ${imageUrl}\n\nVous pouvez cliquer sur le lien pour voir l'image.`;
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

    } catch (error) {
      console.error('Erreur lors de la génération de l\'image :', error);
      // Envoyer un message d'erreur
      await sendMessage(senderId, { text: '❌ Une erreur est survenue lors de la génération de l\'image. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};
