const axios = require('axios');

module.exports = {
  name: 'gpt4-o',
  description: 'Pose une question à GPT-4o via l\'API fournie.',
  author: 'Deku (rest api)',
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(senderId, { text: "Veuillez entrer une question valide." }, pageAccessToken);
    }

    try {
      // Envoyer un message indiquant que GPT-4o est en train de répondre
      await sendMessage(senderId, { text: '💬 GPT-4o est en train de te répondre⏳...\n\n─────★─────' }, pageAccessToken);

      // Construire l'URL de l'API
      const apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o?ask=${encodeURIComponent(prompt)}&id=${senderId}`;
      
      // Faire la requête à l'API
      const response = await axios.get(apiUrl);

      // Extraire uniquement la réponse du champ "response"
      const text = response.data.response;

      // Formater la réponse
      const formattedResponse = `─────★─────\n` +
                                `✨GPT-4o\n\n${text}\n` +
                                `─────★─────`;

      // Envoyer la réponse au destinataire
      const maxMessageLength = 2000;
      if (formattedResponse.length > maxMessageLength) {
        const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
        for (const message of messages) {
          await sendMessage(senderId, { text: message }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }

    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API GPT-4o :', error);
      // Envoyer un message d'erreur en cas de problème
      await sendMessage(senderId, { text: 'Désolé, une erreur est survenue. Veuillez réessayer plus tard.' }, pageAccessToken);
    }
  }
};

// Fonction pour découper les messages longs
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}
