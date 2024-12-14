const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

module.exports = {
  name: 'image-gen-dalle',
  description: 'Génère une image via l\'API Flux et l\'envoie dans Messenger.',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' '); // Description de l'image fournie par l'utilisateur

    if (!prompt || prompt.trim().length === 0) {
      return sendMessage(senderId, {
        text: "Bienvenue ! 👋 Veuillez fournir une description pour générer une image. 🖼️✨"
      }, pageAccessToken);
    }

    try {
      // Informer l'utilisateur que l'image est en cours de génération
      await sendMessage(senderId, {
        text: "✨ Génération de votre image en cours... ⏳"
      }, pageAccessToken);

      // Appeler l'API pour récupérer directement l'image (format binaire)
      const apiUrl = `https://kaiz-apis.gleeze.com/api/flux?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'stream', // Récupérer la réponse sous forme de stream (image)
      });

      // Sauvegarder temporairement l'image générée
      const tempFilePath = path.resolve(__dirname, 'generated_image.jpg');
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);

      // Attendre la fin du téléchargement
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Préparer l'image pour l'envoyer à Messenger
      const formData = new FormData();
      formData.append('recipient', JSON.stringify({ id: senderId }));
      formData.append('message', JSON.stringify({
        attachment: {
          type: 'image',
          payload: {}
        }
      }));
      formData.append('filedata', fs.createReadStream(tempFilePath));

      // Envoyer l'image générée à Facebook Messenger
      const fbResponse = await axios.post(
        `https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`,
        formData,
        { headers: formData.getHeaders() }
      );

      console.log('Image envoyée avec succès:', fbResponse.data);

      // Supprimer le fichier temporaire après l'envoi
      fs.unlinkSync(tempFilePath);

      // Informer l'utilisateur que l'image a été envoyée
      await sendMessage(senderId, {
        text: "✅ Votre image a été créée et envoyée avec succès ! 🎨"
      }, pageAccessToken);

    } catch (error) {
      console.error('Erreur lors de la génération ou de l\'envoi de l\'image :', error);

      // Informer l'utilisateur en cas d'erreur
      await sendMessage(senderId, {
        text: "❌ Une erreur est survenue lors de la génération de l'image. Détails : " + error.message
      }, pageAccessToken);
    }
  },
};
