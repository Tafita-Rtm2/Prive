const axios = require('axios');

module.exports = {
  name: 'aidetect',
  description: 'Détecte si un texte est généré par une IA via l\'API AI Detector.',
  
  async execute(senderId, args, pageAccessToken, sendMessage) {
    const prompt = args.join(' ');

    if (!prompt) {
      return sendMessage(
        senderId,
        { text: "─────★─────\n✨AI Detect\n❗ Veuillez fournir un texte pour analyse.\n─────★─────." },
        pageAccessToken
      );
    }

    try {
      const apiUrl = `https://kaiz-apis.gleeze.com/api/aidetector-v2?q=${encodeURIComponent(prompt)}`;

      await sendMessage(
        senderId,
        { text: '🧠 Analyse de votre texte en cours⏳...\n─────★─────' },
        pageAccessToken
      );

      const response = await axios.get(apiUrl);
      const data = response.data;

      // Validation des champs retournés par l'API
      const aiPercentage = parseFloat(data.ai);
      const humanPercentage = parseFloat(data.human);
      const wordCount = data.wordcount || 0;
      const message = data.message || "Désolé, je n'ai pas pu obtenir une réponse valide.";

      if (
        isNaN(aiPercentage) || isNaN(humanPercentage) ||
        aiPercentage < 0 || aiPercentage > 100 ||
        humanPercentage < 0 || humanPercentage > 100
      ) {
        throw new Error('Pourcentages invalides retournés par l\'API.');
      }

      const madagascarTime = getMadagascarTime();

      const formattedResponse = `─────★─────\n` +
                                `✨AI Detect\n\n` +
                                `🔍 Résultat :\n` +
                                `- Généré par IA : ${aiPercentage.toFixed(2)}%\n` +
                                `- Généré par un humain : ${humanPercentage.toFixed(2)}%\n` +
                                `- Nombre de mots analysés : ${wordCount}\n\n` +
                                `📄 Message : ${message}\n` +
                                `─────★─────\n` +
                                `🕒 ${madagascarTime}`;

      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);

    } catch (error) {
      console.error('Erreur :', error.message || error);

      await sendMessage(
        senderId,
        { text: '❌ Une erreur est survenue lors de l\'analyse du texte. Veuillez réessayer plus tard.' },
        pageAccessToken
      );
    }
  }
};

function getMadagascarTime() {
  const options = { timeZone: 'Indian/Antananarivo', hour12: false };
  return new Date().toLocaleString('fr-FR', {
    ...options,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
