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

  // Initialiser l'historique pour cet utilisateur
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }

  const userConversation = userConversations.get(senderId);

  // Ajouter le message utilisateur à l'historique
  const userMessage = event.message.text || 'Image';
  userConversation.push({ type: 'user', text: userMessage });

  // Gestion des messages avec des images
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
    return;
  }

  // Traitement des commandes ou texte
  if (event.message.text) {
    const messageText = event.message.text.trim().toLowerCase();

    // Commande "stop"
    if (messageText === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    // Vérifier si l'utilisateur demande un suivi
    if (isFollowUp(messageText, userConversation)) {
      const lastBotResponse = getLastBotResponse(userConversation);
      if (lastBotResponse) {
        const detailedResponse = await provideDetailedResponse(lastBotResponse, messageText);
        userConversation.push({ type: 'bot', text: detailedResponse });
        await sendMessage(senderId, { text: detailedResponse }, pageAccessToken);
        return;
      }
    }

    // Traitement des commandes classiques
    const args = messageText.split(' ');
    const commandName = args[0];
    const command = commands.get(commandName);

    if (command) {
      userStates.set(senderId, { lockedCommand: commandName });
      const response = await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      userConversation.push({ type: 'bot', text: response });
      return;
    }

    // Si aucune commande ne correspond
    await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande. Essayez une commande valide ou tapez 'stop' pour quitter." }, pageAccessToken);
  }
}

// Détecter si l'utilisateur demande un suivi
function isFollowUp(messageText, conversationHistory) {
  const followUpKeywords = ['explique', 'développe', 'plus de détails', 'comment', 'pourquoi', 'quoi', 'ça veut dire quoi'];
  return followUpKeywords.some(keyword => messageText.includes(keyword)) || conversationHistory.length > 0;
}

// Récupérer la dernière réponse du bot dans l'historique
function getLastBotResponse(conversationHistory) {
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    if (conversationHistory[i].type === 'bot') {
      return conversationHistory[i].text;
    }
  }
  return null;
}

// Générer une réponse détaillée à partir d'une réponse précédente
async function provideDetailedResponse(lastBotResponse, userPrompt) {
  // Appeler une API ou générer une réponse basée sur le texte précédent
  return `Voici une explication détaillée basée sur votre dernière question :\n"${lastBotResponse}".`;
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

    let imageAnalysis;
    const lockedCommand = userStates.get(senderId)?.lockedCommand;

    if (lockedCommand && commands.has(lockedCommand)) {
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance && lockedCommandInstance.analyzeImage) {
        imageAnalysis = await lockedCommandInstance.analyzeImage(imageUrl, prompt);
      }
    } else {
      imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);
    }

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }

    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
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
