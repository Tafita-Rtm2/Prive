const axios = require('axios');

module.exports = {
  name: 'gemini',
  description: 'Pose une question à l’API Gemini textuelle',
  author: 'Adapté par votre assistant',

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ').trim();

    if (!prompt) {
      return sendMessage(senderId, { 
        text: "❓ Vous utilisez la commande Gemini. Veuillez entrer une question ou une demande pour obtenir une réponse de l'intelligence artificielle." 
      }, pageAccessToken);
    }

    // Informer l'utilisateur que l'IA est en train de répondre
    await sendMessage(senderId, { 
      text: '💬 Gemini est en train de répondre à votre question ⏳...\n─────★─────' 
    }, pageAccessToken);

    try {
      // Appel à l'API textuelle de Gemini
      const response = await callGeminiTextAPI(prompt);

      if (!response || response.trim() === '') {
        throw new Error("L'API Gemini a renvoyé une réponse vide.");
      }

      const formattedResponse = formatResponse(response);
      await handleLongResponse(formattedResponse, senderId, pageAccessToken, sendMessage);

    } catch (error) {
      console.error("Erreur avec l'API Gemini:", error);
      await sendMessage(senderId, { 
        text: 'Désolé, je n’ai pas pu obtenir de réponse pour cette question. Veuillez réessayer plus tard.' 
      }, pageAccessToken);
    }
  }
};

// Fonction pour appeler l'API textuelle de Gemini
async function callGeminiTextAPI(prompt) {
  const apiUrl = `https://api.ruii.site/api/gemini?q=${encodeURIComponent(prompt)}`;
  const response = await axios.get(apiUrl);
  return response.data?.response || ""; // Adaptez selon la structure de la réponse API
}

// Fonction pour formater la réponse avec un style personnalisé
function formatResponse(text) {
  return `─────★─────\n✨ Gemini 🤖\n\n${text}\n─────★─────`;
}

// Fonction pour découper les messages longs en morceaux de 2000 caractères
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

// Fonction pour gérer les messages longs
async function handleLongResponse(response, senderId, pageAccessToken, sendMessage) {
  const maxMessageLength = 2000;
  if (response.length > maxMessageLength) {
    const messages = splitMessageIntoChunks(response, maxMessageLength);
    for (const message of messages) {
      await sendMessage(senderId, { text: message }, pageAccessToken);
    }
  } else {
    await sendMessage(senderId, { text: response }, pageAccessToken);
  }
}
