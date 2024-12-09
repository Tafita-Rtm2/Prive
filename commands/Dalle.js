const axios = require('axios');

module.exports = {
  name: 'gpt4',
  description: 'Interact with GPT-4o',
  author: 'coffee',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Usage: gpt4 <question>" }, pageAccessToken);
    }

    try {
      // Indiquer que l'API est en cours de traitement
      await sendMessage(senderId, { text: '🔄 Génération de la réponse en cours, merci de patienter...' }, pageAccessToken);

      // Construire l'URL de l'API
      const apiUrl = `https://api.kenliejugarap.com/blackbox-gpt4o/?text=${encodeURIComponent(prompt)}`;

      // Faire une requête GET à l'API
      const response = await axios.get(apiUrl);

      // Vérifier si la réponse est valide
      const { data } = response;
      if (!data || !data.response) {
        throw new Error('La réponse de l\'API est vide ou invalide.');
      }

      // Extraire et formater la réponse
      const text = data.response;
      const formattedResponse = `🤖 GPT-4o:\n\n${text}`;

      // Envoyer la réponse
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API :', error);
      
      // Envoyer un message d'erreur
      await sendMessage(senderId, { text: '❌ Une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};
