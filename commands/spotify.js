const axios = require('axios');
const fs = require('fs');
const { sendMessage } = require('../handles/sendMessage');

// Lecture du token d'accès pour Messenger
const token = fs.readFileSync('token.txt', 'utf8');

module.exports = {
  name: 'imagine',
  description: 'Génère une image basée sur un prompt utilisateur via Messenger.',
  author: 'Tata',
  usage: 'imagine [description de l\'image]',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const prompt = args.join(' ').trim();

    // Vérifie que l'utilisateur a bien fourni un prompt
    if (!prompt) {
      return await sendMessage(
        senderId,
        { text: '❌ Veuillez fournir une description pour générer une image.' },
        pageAccessToken
      );
    }

    try {
      // Notifie l'utilisateur que l'image est en cours de génération
      await sendMessage(
        senderId,
        { text: '🎨 Génération de votre image en cours... Merci de patienter un moment ! 🤩' },
        pageAccessToken
      );

      // Appel à l'API pour générer l'image
      const apiUrl = `https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&model=4`;
      const response = await axios.get(apiUrl);

      // Vérifie si l'API retourne une URL valide
      if (response.status === 200 && response.data && response.data.url) {
        const imageUrl = response.data.url;

        // Envoie l'image générée à l'utilisateur
        await sendMessage(
          senderId,
          {
            attachment: {
              type: 'image',
              payload: {
                url: imageUrl, // URL directe de l'image générée
                is_reusable: true,
              },
            },
          },
          pageAccessToken
        );
      } else {
        // Message en cas d'échec de génération
        await sendMessage(
          senderId,
          { text: '❌ Échec de la génération de l\'image. Essayez un autre prompt.' },
          pageAccessToken
        );
      }
    } catch (error) {
      console.error('Erreur lors de la génération de l\'image :', error);

      // Message d'erreur en cas de problème avec l'API
      await sendMessage(
        senderId,
        { text: '❌ Une erreur est survenue lors de la génération de l\'image. Veuillez réessayer plus tard.' },
        pageAccessToken
      );
    }
  },
};
