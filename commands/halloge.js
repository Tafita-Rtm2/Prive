const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

module.exports = {
  name: 'image-gen-flux',
  description: 'Génère une image via l\'API Flux et l\'envoie dans Messenger.',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' '); // Récupération de la description entrée par l'utilisateur

    if (!prompt || prompt.trim().length === 0) {
      return sendMessage(senderId, {
        text: "Bienvenue ! 👋 Veuillez fournir une description pour générer une image. 🖼️✨"
      }, pageAccessToken);
    }

    try {
      // Informer l'utilisateur que le processus est lancé
      await sendMessage(senderId, {
        text: "✨ Génération de votre image en cours... ⏳"
      }, pageAccessToken);

      // Appel à l'API Flux pour générer l'image
      const apiUrl = `https://kaiz-apis.gleeze.com/api/flux?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      if (response.data && response.data.image_url) {
        const imageUrl = response.data.image_url;

        // Télécharger l'image depuis l'URL renvoyée
        const imageResponse = await axios({
          url: imageUrl,
          method: 'GET',
          responseType: 'stream',
        });

        // Sauvegarder temporairement l'image
        const tempFilePath = path.resolve(__dirname, 'generated_image.jpg');
        const writer = fs.createWriteStream(tempFilePath);
        imageResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Préparer l'image pour l'envoi dans Messenger
        const formData = new FormData();
        formData.append('recipient', JSON.stringify({ id: senderId }));
        formData.append('message', JSON.stringify({
          attachment: {
            type: 'image',
            payload: {}
          }
        }));
        formData.append('filedata', fs.createReadStream(tempFilePath));

        // Envoyer l'image dans Messenger
        const fbResponse = await axios.post(
          `https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`,
          formData,
          { headers: formData.getHeaders() }
        );

        console.log('Image envoyée avec succès:', fbResponse.data);

        // Supprimer le fichier temporaire
        fs.unlinkSync(tempFilePath);

        // Confirmer à l'utilisateur
        await sendMessage(senderId, {
          text: "✅ Votre image a été créée et envoyée avec succès ! 🎨"
        }, pageAccessToken);

      } else {
        throw new Error("L'API n'a pas retourné d'URL d'image.");
      }

    } catch (error) {
      console.error('Erreur :', error.message);

      // Informer l'utilisateur en cas d'erreur
      await sendMessage(senderId, {
        text: "❌ Une erreur est survenue lors de la génération de l'image. Détails : " + error.message
      }, pageAccessToken);
    }
  },
};
