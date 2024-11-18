const axios = require('axios');

module.exports = {
  name: 'imagegen',
  description: 'Génère une image à partir d’un prompt fourni.',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez fournir une description pour générer une image." }, pageAccessToken);
    }

    try {
      // Indiquer que l'image est en cours de génération
      await sendMessage(senderId, { text: `🎨 Génération de votre image avec le prompt : "${prompt}"...` }, pageAccessToken);

      // Construire l'URL de l'API avec les paramètres
      const width = 1024;
      const height = 1024;
      const apiUrl = `https://api.kenliejugarap.com/turbo-image-gen/?width=${width}&height=${height}&prompt=${encodeURIComponent(prompt)}`;

      // Appeler l'API de génération d'image
      const response = await axios.get(apiUrl);

      // Vérifier si l'API renvoie une URL valide
      const imageUrl = response.data.url; // Supposons que l'API renvoie { "url": "<lien de l'image>" }
      if (!imageUrl) {
        throw new Error("L'API n'a pas renvoyé d'URL d'image.");
      }

      // Envoyer l'image générée à l'utilisateur
      await sendMessage(senderId, {
        attachment: {
          type: 'image',
          payload: { url: imageUrl }
        }
      }, pageAccessToken);

    } catch (error) {
      console.error('Erreur lors de la génération de l’image :', error);

      // Message d'erreur en cas d'échec
      await sendMessage(senderId, { text: "❌ Une erreur est survenue lors de la génération de l'image. Veuillez réessayer plus tard." }, pageAccessToken);
    }
  }
};
