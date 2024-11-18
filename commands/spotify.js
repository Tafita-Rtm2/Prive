const axios = require('axios');
const fs = require('fs');
const { sendMessage } = require('../handles/sendMessage');

// Lecture du token d'accès pour Messenger
const tokenPath = './token.txt';
const pageAccessToken = fs.readFileSync(tokenPath, 'utf8').trim();

if (!pageAccessToken) {
  throw new Error('Le fichier token.txt est manquant ou vide. Ajoutez votre token d’accès Messenger.');
}

module.exports = {
  name: 'generate',
  description: 'Génère une image en fonction d’un prompt et l’envoie via Messenger.',
  usage: 'generate prompt',
  author: 'Tata',

  async execute(senderId, args) {
    // Vérifie si un prompt a été fourni
    if (!args || !Array.isArray(args) || args.length === 0) {
      await sendMessage(senderId, { text: '❌ Veuillez fournir une description pour générer une image.' }, pageAccessToken);
      return;
    }

    // Construire le prompt
    const prompt = args.join(' ').trim();

    try {
      // Indiquer à l'utilisateur que l'image est en cours de génération
      await sendMessage(senderId, { text: '🎨 Génération de l’image en cours... 🤩' }, pageAccessToken);

      // Appeler l'API pour générer l'image
      const apiUrl = `https://api.kenliejugarap.com/flux-realism-v2/?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Vérifier si une URL d'image est retournée
      const imageUrl = response.data?.url;

      if (!imageUrl) {
        await sendMessage(senderId, { text: '❌ Échec de la génération de l’image. Essayez un autre prompt.' }, pageAccessToken);
        return;
      }

      // Envoyer l'image via Messenger
      const attachment = {
        type: 'image',
        payload: { url: imageUrl }
      };

      await sendMessage(senderId, { attachment }, pageAccessToken);
      console.log('Image envoyée avec succès.');

    } catch (error) {
      console.error('Erreur lors de la génération ou de l’envoi de l’image :', error.message);
      await sendMessage(senderId, { text: '❌ Une erreur est survenue lors de la génération de l’image. Réessayez plus tard.' }, pageAccessToken);
    }
  }
};
