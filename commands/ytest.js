const axios = require('axios');

module.exports = {
  name: 'file',
  description: 'Résumé les fichiers envoyés par l’utilisateur.',
  async execute(senderId, message, pageAccessToken, sendMessage) {
    try {
      // Vérifiez si un fichier a été envoyé dans le message
      if (message.attachments && message.attachments.length > 0) {
        const attachment = message.attachments[0];

        // Vérifiez que l'attachement est un fichier
        if (attachment.type === 'file' && attachment.payload.url) {
          const fileUrl = attachment.payload.url;

          // Envoyer un message temporaire indiquant que le fichier est en cours de traitement
          await sendMessage(senderId, { text: "📄 Votre fichier est en cours d'analyse... ⏳" }, pageAccessToken);

          // Appel à l'API pour résumer le fichier
          const apiUrl = `https://ccprojectapis.ddns.net/api/aisum?link=${encodeURIComponent(fileUrl)}&id=12345`; // Ajoutez votre propre ID si nécessaire
          const response = await axios.get(apiUrl);

          // Vérifiez la réponse de l'API
          const summary = response.data.summary || "Je n'ai pas pu résumer ce fichier.";

          // Envoyer le résumé à l'utilisateur
          const formattedResponse = `✨ Résumé du fichier :\n\n${summary}`;
          await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

        } else {
          // Si l'attachement n'est pas un fichier
          await sendMessage(senderId, { text: "❌ Je ne peux traiter que les fichiers de type docx, pdf ou txt." }, pageAccessToken);
        }
      } else {
        // Si aucun fichier n'a été détecté
        await sendMessage(senderId, { text: "❌ Aucun fichier détecté. Veuillez envoyer un fichier pour que je le résume." }, pageAccessToken);
      }
    } catch (error) {
      console.error('Erreur lors de l’analyse du fichier :', error);
      await sendMessage(senderId, { text: "❌ Une erreur est survenue pendant l'analyse du fichier. Veuillez réessayer." }, pageAccessToken);
    }
  }
};
