const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');

// Lecture du token d'accès pour l'envoi des messages
const token = fs.readFileSync('token.txt', 'utf8');

// Dictionnaire pour suivre le dernier horodatage de chaque utilisateur
const lastUsage = {};

module.exports = {
  name: 'image',
  description: 'Generate an AI-based image with a 2-minute cooldown',
  author: 'Tafita',
  usage: 'imagine dog',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const prompt = args.join(' ').trim();

    // Vérifie que l'utilisateur a bien entré une commande
    if (!prompt) {
      return await sendMessage(senderId, { text: 'Veuillez fournir un prompt pour le générateur d\'images.' }, pageAccessToken);
    }

    // Vérifier l'intervalle de 2 minutes pour cet utilisateur
    const currentTime = Date.now();
    const cooldownPeriod = 2 * 60 * 1000; // 2 minutes en millisecondes

    if (lastUsage[senderId] && currentTime - lastUsage[senderId] < cooldownPeriod) {
      const remainingTime = Math.ceil((cooldownPeriod - (currentTime - lastUsage[senderId])) / 1000);
      return await sendMessage(senderId, { text: `Veuillez attendre encore ${remainingTime} secondes avant de réutiliser cette commande.` }, pageAccessToken);
    }

    // Mettre à jour le dernier horodatage d'utilisation de la commande
    lastUsage[senderId] = currentTime;

    try {
      // Envoyer un message pour indiquer que l'image est en cours de génération
      await sendMessage(senderId, { text: '🎨 Génération de votre image en cours...🤩' }, pageAccessToken);

      // Appel à l'API pour générer l'image
      const apiUrl = `https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&model=4`;
      const response = await axios.get(apiUrl);

      // Vérifier si l'API a renvoyé un résultat valide
      if (response.status === 200 && response.data && response.data.url) {
        const imageUrl = response.data.url;

        // Envoyer l'image à l'utilisateur
        await sendMessage(senderId, {
          attachment: { type: 'image', payload: { url: imageUrl } }
        }, pageAccessToken);
      } else {
        // Envoyer un message d'erreur si l'API ne renvoie pas d'URL
        await sendMessage(senderId, { text: 'Échec de la génération de l\'image. Veuillez essayer un autre prompt.' }, pageAccessToken);
      }
    } catch (error) {
      console.error('Erreur lors de la génération de l\'image :', error);
      // Envoyer un message d'erreur à l'utilisateur
      await sendMessage(senderId, { text: 'Une erreur inattendue est survenue lors de la génération de l\'image. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};
