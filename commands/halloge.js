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
      const apiUrl = `https://ccprojectapis.ddns.net/api/generate-art?prompt=${encodeURIComponent(prompt)}`;
      const response = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'arraybuffer', // Reçoit le fichier image en tant que binaire
      });

      // Vérification : vérifier que le retour est une image
      const contentType = response.headers['content-type'];
      if (!contentType.startsWith('image/')) {
        throw new Error("L'API n'a pas renvoyé une image valide.");
      }

      // Sauvegarder temporairement l'image localement
      const imagePath = path.resolve(__dirname, 'generated-image.jpg');
      fs.writeFileSync(imagePath, response.data);

      // Envoyer l'image via l'API Facebook Messenger
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

      // Supprimer le fichier temporaire après l'envoi
      fs.unlinkSync(imagePath);

      // Envoyer un message d'instructions après l'image
      await sendMessage(senderId, {
        text: "✅ Votre image a été envoyée avec succès. 🎨\n\n👉 N'hésitez pas à explorer les autres fonctionnalités ! 🚀"
      }, pageAccessToken);
    } catch (error) {
      console.error('Erreur lors de la génération ou de l\'envoi de l\'image :', error);

      // Informer l'utilisateur en cas d'erreur
      await sendMessage(senderId, { 
        text: "❌ Une erreur est survenue lors de la génération ou de l'envoi de l'image." 
      }, pageAccessToken);
    }
  },
};
