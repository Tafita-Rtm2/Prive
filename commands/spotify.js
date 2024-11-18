const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');

// Lecture du token d'accès pour l'envoi des messages
const token = fs.readFileSync('token.txt', 'utf8');

module.exports = {
  name: 'imagine',
  description: 'Génère une image basée sur une invite utilisateur et l\'envoie directement.',
  author: 'Tata',
  usage: 'imagine [description de l\'image]',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const prompt = args.join(' ').trim();

    // Vérifie que l'utilisateur a bien entré une commande
    if (!prompt) {
      return await sendMessage(senderId, { text: 'Veuillez fournir un prompt pour le générateur d\'images.' }, pageAccessToken);
    }

    try {
      // Envoyer un message pour indiquer que l'image est en cours de génération
      await sendMessage(senderId, { text: '🎨 Génération de votre image en cours...🤩' }, pageAccessToken);

      // Appel à l'API pour générer l'image
      const apiUrl = `https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&model=4`;
      const response = await axios.get(apiUrl);

      // Vérification de la réponse de l'API
      if (response.status === 200 && response.data && response.data.url) {
        const imageUrl = response.data.url;

        // Envoyer l'image à l'utilisateur
        await sendMessage(senderId, {
          attachment: {
            type: 'image',
            payload: {
              url: imageUrl, // URL directe de l'image générée
            },
          },
        }, pageAccessToken);
      } else {
        // Envoyer un message d'erreur si l'API ne renvoie pas une URL
        await sendMessage(senderId, { text: 'Échec de la génération de l\'image. Veuillez essayer un autre prompt.' }, pageAccessToken);
      }
    } catch (error) {
      console.error('Erreur lors de la génération de l\'image :', error);
      // Envoyer un message d'erreur à l'utilisateur
      await sendMessage(senderId, { text: 'Une erreur est survenue lors de la génération de l\'image. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};
