const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Initialiser l'historique de l'utilisateur s'il n'existe pas encore
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }

  const userHistory = userConversations.get(senderId);

  // Enregistrer le message de l'utilisateur dans l'historique
  const userMessage = event.message.text || 'Image';
  userHistory.push({ type: 'user', text: userMessage });

  // Gérer les images
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } 
  // Gérer les messages textuels
  else if (event.message.text) {
    const messageText = event.message.text.trim().toLowerCase();

    // Afficher l'historique des questions
    if (messageText === 'quelles sont mes questions ?') {
      const questions = userHistory
        .filter(entry => entry.type === 'user') // Filtrer uniquement les messages utilisateurs
        .map(entry => entry.text)
        .join('\n- ');

      const response = questions 
        ? `📜 Voici vos questions précédentes :\n- ${questions}` 
        : "📜 Vous n'avez posé aucune question pour l'instant.";

      await sendMessage(senderId, { text: response }, pageAccessToken);
      return;
    }

    // Identifier si l'utilisateur pose une question de suivi
    if (isFollowUpQuestion(messageText)) {
      const lastBotResponse = userHistory
        .filter(entry => entry.type === 'bot') // Récupérer la dernière réponse du bot
        .slice(-1)[0]; // Prendre la dernière réponse

      if (lastBotResponse) {
        const followUpResponse = `Voici plus de détails sur ma réponse précédente : ${lastBotResponse.text}`;
        userHistory.push({ type: 'bot', text: followUpResponse });
        await sendMessage(senderId, { text: followUpResponse }, pageAccessToken);
      } else {
        await sendMessage(senderId, { text: "Je n'ai pas de réponse récente à développer. Posez-moi une question d'abord ! 😊" }, pageAccessToken);
      }
      return;
    }

    // Répondre normalement ou exécuter une commande
    const args = messageText.split(' ');
    const commandName = args[0];
    const command = commands.get(commandName);

    if (command) {
      const response = await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      userHistory.push({ type: 'bot', text: response });
      return;
    }

    // Si aucune commande, répondre de manière générale
    const defaultResponse = "Je n'ai pas compris votre question, mais je suis là pour vous aider. Posez-moi n'importe quelle question !";
    userHistory.push({ type: 'bot', text: defaultResponse });
    await sendMessage(senderId, { text: defaultResponse }, pageAccessToken);
  }
}

// Vérifier si le message est une question de suivi
function isFollowUpQuestion(message) {
  const followUpTriggers = ['explique', 'développe', 'peux-tu expliquer', 'plus de détails'];
  return followUpTriggers.some(trigger => message.includes(trigger));
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔⏳" }, pageAccessToken);
    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);
    const response = imageAnalysis 
      ? `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` 
      : "❌ Aucune information exploitable n'a été détectée dans cette image.";
    userConversations.get(senderId).push({ type: 'bot', text: response });
    await sendMessage(senderId, { text: response }, pageAccessToken);
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

// Fonction pour appeler l'API Gemini pour analyser une image avec un prompt
async function analyzeImageWithGemini(imageUrl, prompt) {
  const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';

  try {
    const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
    return response.data && response.data.answer ? response.data.answer : '';
  } catch (error) {
    console.error('Erreur avec Gemini :', error);
    throw new Error('Erreur lors de l\'analyse avec Gemini');
  }
}

module.exports = { handleMessage };
