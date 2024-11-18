const axios = require('axios');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Lecture du token d'accès pour l'envoi des messages
const token = fs.readFileSync('token.txt', 'utf8').trim();

if (!token) {
  throw new Error('Le token d’accès est manquant ou invalide. Vérifiez le fichier token.txt.');
}

// Fonction principale exportée
module.exports = {
  name: 'imagine',
  description: 'Génère une image basée sur un prompt et l’envoie via Messenger',
  author: 'Tata',
  usage: 'imagine girl',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const prompt = args.join(' ').trim();

    // Vérifie si l'utilisateur a fourni un prompt
    if (!prompt) {
      return await sendMessage(senderId, { text: '❌ Veuillez fournir une description pour générer une image.' }, pageAccessToken);
    }

    try {
      // Message de confirmation
      await sendMessage(senderId, { text: '🎨 Génération de l’image en cours... 🤩' }, pageAccessToken);

      // Appel à l'API pour générer l'image
      const apiUrl = `https://api.kenliejugarap.com/flux-realism/?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Récupération de l'URL de l'image générée
      const imageUrl = response.data?.url;

      if (!imageUrl) {
        return await sendMessage(senderId, { text: '❌ Échec de la génération de l’image. Essayez un autre prompt.' }, pageAccessToken);
      }

      // Téléchargement de l'image générée
      const imagePath = path.join(__dirname, 'generated_image.jpg');
      await downloadImage(imageUrl, imagePath);

      // Envoi de l'image générée via Messenger
      const formData = new FormData();
      formData.append('recipient', JSON.stringify({ id: senderId }));
      formData.append('message', JSON.stringify({
        attachment: {
          type: 'image',
          payload: {}
        }
      }));
      formData.append('filedata', fs.createReadStream(imagePath));

      await axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${pageAccessToken}`, formData, {
        headers: formData.getHeaders()
      });

      console.log('Image envoyée avec succès.');

    } catch (error) {
      console.error('Erreur lors de la génération ou de l’envoi de l’image :', error.message);
      await sendMessage(senderId, { text: '❌ Une erreur inattendue est survenue. Réessayez plus tard.' }, pageAccessToken);
    }
  }
};

// Fonction pour envoyer un message texte via Messenger
async function sendMessage(senderId, messageData, pageAccessToken) {
  try {
    await axios.post(`https://graph.facebook.com/v12.0/me/messages?access_token=${pageAccessToken}`, {
      recipient: { id: senderId },
      message: messageData
    });
  } catch (error) {
    console.error('Erreur lors de l’envoi du message :', error.message);
  }
}

// Fonction pour télécharger une image à partir d'une URL
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => reject(err));
    });
  });
}
