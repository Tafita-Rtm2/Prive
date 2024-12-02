const axios = require('axios');  
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'image-gen',
  description: 'Génère une image via l\'API et l\'envoie à l\'utilisateur.',
  author: 'Personnalisé',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "❌ Veuillez fournir une description valide pour générer une image." }, pageAccessToken);
    }

    try {
      // Étape 1 : Informer l'utilisateur que l'image est en cours de génération
      await sendMessage(senderId, { text: "✨ Génération de votre image en cours... Veuillez patienter quelques instants ⏳" }, pageAccessToken);

      // Étape 2 : Appeler l'API pour générer l'image
      const apiUrl = `https://ccprojectapis.ddns.net/api/imaginev2?prompt=${encodeURIComponent(prompt)}`;

      // Appel à l'API pour récupérer l'image
      const response = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'arraybuffer', // Important pour gérer le fichier binaire (image)
      });

      // Vérification : l'API renvoie bien un contenu image
      const contentType = response.headers['content-type'];
      if (!contentType.startsWith('image/')) {
        throw new Error("L'API n'a pas renvoyé une image valide.");
      }

      // Étape 3 : Sauvegarder l'image localement
      const imagePath = path.resolve(__dirname, 'generated-image.jpg');
      fs.writeFileSync(imagePath, response.data);

      // Étape 4 : Envoyer l'image via l'API de Facebook
      const formData = {
        recipient: JSON.stringify({ id: senderId }),
        message: JSON.stringify({ attachment: { type: 'image', payload: {} } }),
        filedata: fs.createReadStream(imagePath),
      };

      const fbResponse = await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Image envoyée avec succès:', fbResponse.data);

      // Supprimer le fichier temporaire après l'envoi
      fs.unlinkSync(imagePath);

      // Étape 5 : Envoyer un message d'instruction après l'image
      await sendMessage(senderId, { 
        text: "✅ Votre image a été envoyée avec succès. 🎨\n\n👉 Cliquez sur le bouton menu pour accéder aux autres options et fonctionnalités. 🚀" 
      }, pageAccessToken);

    } catch (error) {
      console.error('Erreur lors de la génération ou de l\'envoi de l\'image :', error);

      // Informer l'utilisateur de l'erreur
      await sendMessage(senderId, { text: "❌ Une erreur est survenue lors de la génération ou de l'envoi de l'image." }, pageAccessToken);
    }
  },
};
