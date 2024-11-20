const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'text-to-audio',
  description: 'Transforme un texte en audio avec un ID dynamique et l\'envoie à l\'utilisateur via Messenger.',
  author: 'Deku',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    if (!args.length) {
      return sendMessage(senderId, { text: "❌ Veuillez fournir un texte valide pour générer un audio." }, pageAccessToken);
    }

    // Extraction du texte et de l'ID (si fourni)
    const input = args.join(' ');
    const idMatch = input.match(/-(\d+)$/); // Recherche d'un ID à la fin du texte
    const id = idMatch ? idMatch[1] : 3; // Utilise l'ID trouvé ou 3 par défaut
    const text = idMatch ? input.replace(/-(\d+)$/, '').trim() : input; // Retire l'ID du texte

    try {
      // Étape 1 : Informer l'utilisateur que l'audio est en cours de génération
      await sendMessage(senderId, { text: "🎙️ Génération de votre audio en cours... Veuillez patienter quelques instants ⏳" }, pageAccessToken);

      // Étape 2 : Appeler l'API pour générer l'audio
      const apiUrl = `https://joshweb.click/api/aivoice?q=${encodeURIComponent(text)}&id=${id}`;

      const response = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'arraybuffer', // Important pour gérer le fichier binaire (audio)
      });

      // Vérification : l'API renvoie bien un contenu audio
      const contentType = response.headers['content-type'];
      if (!contentType.startsWith('audio/')) {
        throw new Error("L'API n'a pas renvoyé un fichier audio valide.");
      }

      // Étape 3 : Sauvegarder l'audio localement
      const audioPath = path.resolve(__dirname, 'generated-audio.mp3');
      fs.writeFileSync(audioPath, response.data);

      // Étape 4 : Envoyer l'audio via l'API de Facebook
      const formData = {
        recipient: JSON.stringify({ id: senderId }),
        message: JSON.stringify({ attachment: { type: 'audio', payload: {} } }),
        filedata: fs.createReadStream(audioPath),
      };

      const fbResponse = await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${pageAccessToken}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Audio envoyé avec succès:', fbResponse.data);

      // Supprimer le fichier temporaire après l'envoi
      fs.unlinkSync(audioPath);

      // Étape 5 : Envoyer un message d'instruction après le vocal
      await sendMessage(senderId, { 
        text: "✅ Votre vocal a été envoyé avec succès. 🎧\n\n👉 Cliquez sur le bouton menu pour quitter le mode texte-to-speech et accéder aux menus." 
      }, pageAccessToken);

    } catch (error) {
      console.error('Erreur lors de la génération ou de l\'envoi de l\'audio :', error);

      // Informer l'utilisateur de l'erreur
      await sendMessage(senderId, { text: "❌ Une erreur est survenue lors de la génération ou de l'envoi de l'audio." }, pageAccessToken);
    }
  },
};
