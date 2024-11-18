const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');

// Lecture du token d'accès pour l'envoi des messages
const token = fs.readFileSync('token.txt', 'utf8').trim();

if (!token) {
  throw new Error('Le token d’accès est manquant ou invalide.');
}

module.exports = {
  name: 'imagine',
  description: 'Generate an AI-based image using a prompt',
  author: 'Tata',
  usage: 'imagine une fille au bord de la mer avec une voiture et un chat',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const prompt = args.join(' ').trim();

    // Vérifie que l'utilisateur a bien entré une commande
    if (!prompt) {
      return await sendMessage(senderId, { text: '❌ Veuillez fournir une description pour générer une image.' }, pageAccessToken);
    }

    try {
      await sendMessage(senderId, { text: '🎨 Génération de l’image en cours... 🤩' }, pageAccessToken);

      // Appel à l'API pour générer l'image
      const apiUrl = `https://api.kenliejugarap.com/turbo-image-gen/?width=1024&height=1024&prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);
      const imageUrl = response.data?.url;

      if (imageUrl) {
        // Envoyer l'image générée à l'utilisateur
        await sendMessage(senderId, {
          attachment: { type: 'image', payload: { url: imageUrl } }
        }, pageAccessToken);
      } else {
        // Si aucune URL n'est retournée, envoyer un message d'erreur
        await sendMessage(senderId, { text: '❌ Échec de la génération. Essayez un autre prompt.' }, pageAccessToken);
      }

    } catch (error) {
      console.error('Erreur lors de la génération de l’image:', error.response?.data || error.message);
      await sendMessage(senderId, { text: '❌ Une erreur inattendue est survenue. Réessayez plus tard.' }, pageAccessToken);
    }
  }
};
