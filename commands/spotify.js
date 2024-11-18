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

      // URL de l'API avec le prompt encodé
      const apiUrl = `https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&model=4`;
      const response = await axios.get(apiUrl);

      // Vérifier si la réponse contient une image
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

      // Ajouter un message complémentaire si nécessaire
      await sendMessage(senderId, { text: "🖼️ Voici votre image générée avec succès !" }, pageAccessToken);

    } catch (error) {
      console.error('Erreur lors de la génération de l’image :', error);
      // Message d'erreur en cas d'échec
      await sendMessage(senderId, { text: "❌ Une erreur est survenue lors de la génération de l'image. Veuillez réessayer plus tard." }, pageAccessToken);
    }
  }
};
