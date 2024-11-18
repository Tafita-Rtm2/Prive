const axios = require('axios');
const fs = require('fs');
const { sendMessage } = require('../handles/sendMessage'); // Fonction d'envoi de message

// Charger le token pour envoyer des messages
const tokenPath = './token.txt';
const pageAccessToken = fs.readFileSync(tokenPath, 'utf8').trim();

module.exports = {
  name: 'imagegen',
  description: 'Generate an image with a prompt and send it to the user.',
  usage: '-imagegen [prompt]',
  author: 'coffee',

  async execute(senderId, args) {
    // Vérifier si le prompt est fourni
    if (!args || args.length === 0) {
      await sendMessage(senderId, { text: 'Veuillez fournir un prompt pour générer une image.' }, pageAccessToken);
      return;
    }

    // Construire le prompt à partir des arguments fournis par l'utilisateur
    const prompt = args.join(' ');

    // Construire l'URL de l'API avec le prompt
    const apiUrl = `https://api.kenliejugarap.com/flux-realism-v2/?prompt=${encodeURIComponent(prompt)}`;

    try {
      // Appel à l'API pour générer l'image
      const { data } = await axios.get(apiUrl);

      // Vérifier si l'API a renvoyé une URL valide pour l'image
      if (data && data.imageUrl) {
        // Construire le message avec l'image
        const attachment = {
          type: 'image',
          payload: { url: data.imageUrl }, // URL de l'image générée
        };

        // Envoyer l'image directement à l'utilisateur
        await sendMessage(senderId, { attachment }, pageAccessToken);
      } else {
        // Aucune image retournée par l'API
        await sendMessage(senderId, { text: 'Aucune image n’a été générée. Veuillez essayer avec un autre prompt.' }, pageAccessToken);
      }
    } catch (error) {
      // Gestion des erreurs
      console.error('Erreur lors de la génération de l’image :', error);
      await sendMessage(senderId, { text: 'Erreur : Impossible de générer l’image. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  },
};
