const axios = require('axios');

module.exports = {
  name: 'gpt4o-pro',
  description: 'Analyse une image ou répond à une question via l’API Kaiz.',
  author: 'Kaiz Integration',
  async execute(senderId, message, pageAccessToken, sendMessage) {
    try {
      // Vérifier si un fichier (image) est envoyé
      if (message.attachments && message.attachments[0]?.type === 'image') {
        const imageUrl = message.attachments[0].payload.url;

        // Stocker l'URL de l'image et demander à l'utilisateur ce qu'il veut faire
        await sendMessage(senderId, { 
          text: `📷 Image reçue. Que voulez-vous que je fasse avec cette image ? ✨ Posez toutes vos questions à propos de cette photo ! 📸😊` 
        }, pageAccessToken);

        // Attendre que l'utilisateur réponde (dans un autre message)
        return { imageUrl }; // Retourne l'URL de l'image pour traitement futur
      }

      // Vérifier si l'utilisateur répond après avoir envoyé une image
      if (message.text && message.context?.imageUrl) {
        const prompt = message.text;
        const imageUrl = message.context.imageUrl;

        // Construire l'URL pour appeler l'API avec l'image et la question
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}&imageUrl=${encodeURIComponent(imageUrl)}`;
        
        await sendMessage(senderId, { 
          text: '💬 Analyse de l’image et traitement de votre demande en cours⏳...\n\n─────★─────' 
        }, pageAccessToken);

        // Appel à l'API Kaiz
        const response = await axios.get(apiUrl);

        // Vérifier et récupérer la réponse
        const text = response.data?.response || "Désolé, je n'ai pas pu obtenir une réponse valide.";
        const formattedResponse = `─────★─────\n` +
                                  `✨gpt4o pro\n\n${text}\n` +
                                  `─────★─────`;

        // Envoyer la réponse à l'utilisateur
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

        return; // Fin du traitement
      }

      // Si un texte simple est envoyé sans image
      const prompt = message.text;

      if (prompt) {
        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
        await sendMessage(senderId, { 
          text: '💬 Gpt4o pro est en train de répondre⏳...\n\n─────★─────' 
        }, pageAccessToken);

        // Appel à l'API Kaiz
        const response = await axios.get(apiUrl);

        // Vérifier et récupérer la réponse
        const text = response.data?.response || "Désolé, je n'ai pas pu obtenir une réponse valide.";
        const formattedResponse = `─────★─────\n` +
                                  `✨Gpt4o pro\n\n${text}\n` +
                                  `─────★─────`;

        // Envoyer la réponse à l'utilisateur
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API Kaiz :', error);

      // Envoyer un message d'erreur en cas de problème
      await sendMessage(senderId, { 
        text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' 
      }, pageAccessToken);
    }
  }
};
