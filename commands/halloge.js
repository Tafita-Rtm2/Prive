const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

module.exports = {
  name: 'image-gen-flux',
  description: 'Génère une image via l\'API Flux et l\'envoie dans Messenger.',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' '); // La description saisie par l'utilisateur

    if (!prompt || prompt.trim().length === 0) {
      return sendMessage(senderId, {
        text: "Bienvenue ! 👋 Je suis prêt à générer des images pour vous. 🖼️ Veuillez écrire la description de l'image que vous souhaitez, et je la transformerai en réalité visuelle de vos rêves ! ✨🎨."
      }, pageAccessToken);
    }

    try {
      // Informer l'utilisateur du processus de génération
      await sendMessage(senderId, {
        text: "✨ Génération de votre image en cours... Veuillez patienter quelques instants ⏳"
      }, pageAccessToken);

      // Appel à l'API pour générer l'image
      const apiUrl = `https://kaiz-apis.gleeze.com/api/flux-1.1-pro?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      if (response.data && response.data.image_url) {
        const imageUrl = response.data.image_url;

        // Vérification si l'URL de l'image est valide
        if (!imageUrl.startsWith('http')) {
          throw new Error("L'URL retournée par l'API n'est pas valide.");
        }

        // Télécharger l'image générée
        const imageResponse = await axios({
          url: imageUrl,
          method: 'GET',
          responseType: 'stream',
        });

        const tempFilePath = path.resolve(__dirname, 'generated_image.jpg');
        const writer = fs.createWriteStream(tempFilePath);

        imageResponse.data.pipe(writer);

        // Attendre que l'image soit téléchargée
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Préparer et envoyer l'image dans Messenger
        const formData = new FormData();
        formData.append('recipient', JSON.stringify({ id: senderId }));
        formData.append('message', JSON.stringify({
          attachment: {
            type: 'image',
            payload: {}
          }
        }));
        formData.append('filedata', fs.createReadStream(tempFilePath));

        const fbResponse = await axios.post(
          `https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`,
          formData,
          { headers: formData.getHeaders() }
        );

        console.log('Image envoyée avec succès:', fbResponse.data);

        // Supprimer le fichier temporaire après envoi
        fs.unlinkSync(tempFilePath);

        // Informer l'utilisateur que tout est terminé
        await sendMessage(senderId, {
          text: "✅ Votre image a été générée et envoyée avec succès ! 🎨"
        }, pageAccessToken);
      } else {
        throw new Error("L'API n'a pas retourné une URL d'image valide.");
      }
    } catch (error) {
      console.error('Erreur lors de la génération ou de l\'envoi de l\'image :', error);

      // Informer l'utilisateur de l'erreur
      await sendMessage(senderId, {
        text: "❌ Une erreur est survenue : " + (error.response ? JSON.stringify(error.response.data) : error.message)
      }, pageAccessToken);
    }
  },
};
