const axios = require('axios');

module.exports = {
  name: 'blackbox-api',
  description: 'Envoie une requête à l\'API Blackbox.',
  author: 'Votre Nom',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const text = args.join(' '); // Texte à envoyer à l'API

    if (!text) {
      return sendMessage(senderId, { text: "❌ Veuillez entrer un texte valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message pour indiquer que le traitement est en cours
      await sendMessage(senderId, { text: '💬 Traitement de votre requête...⏳' }, pageAccessToken);

      // Construire l'URL de l'API
      const apiUrl = `https://api.kenliejugarap.com/blackbox/?text=${encodeURIComponent(text)}`;

      // Effectuer une requête GET vers l'API
      const response = await axios.get(apiUrl);

      // Vérifier la réponse
      if (response.data && response.data.result) {
        const result = response.data.result;

        // Formater la réponse
        const formattedResponse = `✨ Réponse de Blackbox API :\n\n${result}`;

        // Envoyer la réponse formatée
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      } else {
        throw new Error('Résultat non valide reçu de l\'API.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API Blackbox :', error);

      // Envoyer un message d'erreur
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};
