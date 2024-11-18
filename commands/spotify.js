const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'image-generator',
  description: 'Génère une image à partir d\'un prompt et envoie le résultat.',
  author: 'Deku (API Image Generator)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer un prompt valide pour générer une image." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que l'image est en cours de génération
      await sendMessage(senderId, { text: '🖌️ Génération de votre image en cours⏳...\n\n─────★─────' }, pageAccessToken);

      // Appel à l'API pour générer l'image
      const apiUrl = `https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&model=4`;
      const response = await axios.get(apiUrl, { responseType: 'stream' }); // Récupérer l'image en tant que flux

      // Chemin temporaire pour enregistrer l'image
      const tempImagePath = path.join(__dirname, `temp-${Date.now()}.jpg`);

      // Enregistrer l'image localement
      const writer = fs.createWriteStream(tempImagePath);
      response.data.pipe(writer);

      // Attendre la fin de l'écriture de l'image
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Envoyer l'image à l'utilisateur
      const imagePayload = {
        attachment: {
          type: 'image',
          payload: {
            is_reusable: true,
            url: `file://${tempImagePath}`,
          },
        },
      };

      await sendMessage(senderId, imagePayload, pageAccessToken);

      // Supprimer le fichier temporaire après l'envoi
      fs.unlinkSync(tempImagePath);

    } catch (error) {
      console.error('Erreur lors de la génération de l\'image:', error);
      // Envoyer un message d'erreur
      await sendMessage(senderId, { text: 'Désolé, une erreur est survenue lors de la génération de l\'image. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  },
};
