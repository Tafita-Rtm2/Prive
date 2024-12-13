const axios = require('axios');

module.exports = {
  name: 'humanize',
  description: 'Humanize your AI-written works',
  author: 'Clarence',
  role: 1,

  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    // Vérifier si un prompt valide est fourni
    if (!prompt) {
      return sendMessage(
        senderId,
        { text: "Bienvenue sur l'humanisation des textes d'intelligence artificielle ! 👋🤖\n\nJe suis Humanizine, prêt à humaniser tous vos textes créés par des intelligences artificielles. 🌟✍️\n\nVeuillez entrer votre texte, et je l'humaniserai pour vous. 📝🔍." },
        pageAccessToken
      );
    }

    try {
      // Activer le mode de saisie
      await typingIndicator(senderId, pageAccessToken);

      // Appeler l'API Humanizer
      const apiUrl = `https://kaiz-apis.gleeze.com/api/humanizer?q=${encodeURIComponent(prompt)}`;
      const response = await axios.get(apiUrl);

      // Vérifier si une réponse valide est reçue
      const text = response.data.response || "Désolé, aucun résultat valide n'a été obtenu.";

      // Gérer les réponses longues en découpant en morceaux si nécessaire
      const maxMessageLength = 2000;
      if (text.length > maxMessageLength) {
        const messages = splitMessageIntoChunks(text, maxMessageLength);
        for (const message of messages) {
          await sendMessage(senderId, { text: message }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text }, pageAccessToken);
      }
    } catch (error) {
      console.error("Erreur lors de l'appel à l'API Humanize :", error);

      // Envoyer un message d'erreur si l'appel API échoue
      await sendMessage(
        senderId,
        { text: "❌ Une erreur est survenue. Veuillez réessayer plus tard." },
        pageAccessToken
      );
    }
  },
};

// Fonction utilitaire : Activer le mode de saisie
async function typingIndicator(senderId, pageAccessToken) {
  if (!senderId) {
    console.error('Invalid senderId for typing indicator.');
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v13.0/me/messages`,
      {
        recipient: { id: senderId },
        sender_action: 'typing_on',
      },
      {
        params: { access_token: pageAccessToken },
      }
    );
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'indicateur de saisie :', error.response?.data || error.message);
  }
}

// Fonction utilitaire : Découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  let chunk = '';
  const words = message.split(' ');

  for (const word of words) {
    if ((chunk + word).length > chunkSize) {
      chunks.push(chunk.trim());
      chunk = '';
    }
    chunk += `${word} `;
  }

  if (chunk) {
    chunks.push(chunk.trim());
  }

  return chunks;
}
