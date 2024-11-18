const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');

const token = fs.readFileSync('token.txt', 'utf8');

module.exports = {
  name: 'image',
  description: 'Génère une image en fonction d’un prompt donné',
  author: 'Tata',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const prompt = args.join(' ');

    // Vérification du prompt fourni par l'utilisateur
    if (!prompt.trim()) {
      await sendMessage(senderId, { text: "❌ Veuillez fournir une description pour générer une image." }, pageAccessToken);
      return;
    }

    try {
      // Informer l'utilisateur que l'image est en cours de génération
      await sendMessage(senderId, {
        text: `🎨 Génération d'image pour le prompt : "${prompt}". Veuillez patienter... ⏳`
      }, pageAccessToken);

      // Appeler l'API pour générer l'image
      const apiUrl = `https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&model=4`;
      const apiResponse = await axios.get(apiUrl);

      // Récupération de l'URL de l'image générée
      const imageUrl = apiResponse.data.image;

      if (!imageUrl) {
        throw new Error("Aucune image générée par l'API.");
      }

      // Envoi de l'image à l'utilisateur
      await sendMessage(senderId, {
        attachment: {
          type: "image",
          payload: { url: imageUrl }
        }
      }, pageAccessToken);

    } catch (error) {
      console.error("Erreur lors de la génération de l'image :", error.message);
      await sendMessage(senderId, { text: "❌ Une erreur est survenue lors de la génération de l'image. Veuillez réessayer plus tard. 🙁" }, pageAccessToken);
    }
  }
};
