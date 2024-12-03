const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'image-gen-flux',
  description: 'Génère une image via l\'API Flux Realism, télécharge l\'image et l\'envoie à l\'utilisateur.',
  author: 'Personnalisé',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, {
        text: "❌ Veuillez fournir une description valide pour générer une image."
      }, pageAccessToken);
    }

    try {
      // Informer l'utilisateur que l'image est en cours de génération
      await sendMessage(senderId, {
        text: "✨ Génération de votre image en cours... Veuillez patienter quelques instants ⏳"
      }, pageAccessToken);

      // Appeler l'API pour générer l'image
      const apiUrl = `https://api.kenliejugarap.com/flux-realism/?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      if (response.data.status && response.data.response) {
        const imageUrl = response.data.response;

        // Téléchargement de l'image
        const imagePath = path.resolve(__dirname, 'generated-image.jpg');
        const imageResponse = await axios({
          url: imageUrl,
          method: 'GET',
          responseType: 'arraybuffer', // Téléchargement du fichier binaire
        });

        fs.writeFileSync(imagePath, imageResponse.data);

        // Envoyer l'image téléchargée via Messenger
        const formData = {
          recipient: JSON.stringify({ id: senderId }),
          message: JSON.stringify({ attachment: { type: 'image', payload: {} } }),
          filedata: fs.createReadStream(imagePath),
        };

        const fbResponse = await axios.post(
          `https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );

        console.log('Image envoyée avec succès:', fbResponse.data);

        // Supprimer le fichier local après envoi
        fs.unlinkSync(imagePath);

        // Envoyer un message supplémentaire après l'image
        await sendMessage(senderId, {
          text: "✅ Votre image a été envoyée avec succès. 🎨\n\n👉 N'hésitez pas à explorer les autres fonctionnalités ! 🚀"
        }, pageAccessToken);
      } else {
        throw new Error("L'API n'a pas retourné une URL d'image valide.");
      }
    } catch (error) {
      console.error('Erreur lors de la génération ou de l\'envoi de l\'image :', error);

      // Informer l'utilisateur de l'erreur
      await sendMessage(senderId, {
        text: "❌ Une erreur est survenue lors de la génération ou de l'envoi de l'image."
      }, pageAccessToken);
    }
  },
};
