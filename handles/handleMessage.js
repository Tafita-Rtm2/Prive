const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userSubscriptions = new Map(); // Enregistre les abonnements utilisateurs avec une date d'expiration
const userFreeQuestions = new Map(); // Enregistre le nombre de questions gratuites par utilisateur par jour
const validCodes = ["2201", "1206", "0612", "1212", "2003"];
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // Durée d'abonnement : 30 jours en millisecondes
const subscriptionCost = 3000; // Prix de l'abonnement

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Vérifier si l'utilisateur est abonné
  const isSubscribed = checkSubscription(senderId);

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    // Gérer les images sans vérifier l'abonnement
    const imageUrl = event.message.attachments[0].payload.url;
    await handleImage(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    if (!isSubscribed) {
      if (validCodes.includes(messageText)) {
        // Activer l'abonnement pour 30 jours
        const expirationDate = Date.now() + subscriptionDuration;
        userSubscriptions.set(senderId, expirationDate);
        await sendMessage(senderId, { text: `✅ Abonnement activé pour 30 jours ! Vous pouvez maintenant utiliser le chatbot sans restrictions. L'abonnement coûte ${subscriptionCost} ar.` }, pageAccessToken);
      } else if (canAskFreeQuestion(senderId)) {
        // Gérer les questions gratuites limitées à 2 par jour
        incrementFreeQuestionCount(senderId);
        await handleText(senderId, messageText, pageAccessToken);
      } else {
        // L'utilisateur a atteint sa limite de questions gratuites
        await sendMessage(senderId, { text: "🚫 Oups ! Vous avez utilisé vos 2 questions gratuites pour aujourd'hui. Pour continuer, abonnez-vous pour 3000 ar ou obtenez un code d'activation." }, pageAccessToken);
      }
    } else {
      // Utilisateur abonné, traiter normalement les messages texte
      await handleText(senderId, messageText, pageAccessToken);
    }
  }
}

// Fonction pour vérifier l'abonnement d'un utilisateur
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);

  if (!expirationDate) return false; // Pas d'abonnement
  if (Date.now() < expirationDate) return true; // Abonnement encore valide

  // Supprimer l'abonnement si expiré
  userSubscriptions.delete(senderId);
  return false;
}

// Fonction pour gérer les images
async function handleImage(senderId, imageUrl, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: '' }, pageAccessToken);
    const imageAnalysis = await analyzeImageWithGemini(imageUrl);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: 'Que voulez-vous que je fasse avec cette image ?' }, pageAccessToken);
      userStates.set(senderId, { mode: 'image_action', imageAnalysis });
    } else {
      await sendMessage(senderId, { text: "Je n'ai pas pu obtenir de réponse concernant cette image." }, pageAccessToken);
    }
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: 'Erreur lors de l\'analyse de l\'image.' }, pageAccessToken);
  }
}

// Fonction pour gérer les textes
async function handleText(senderId, text, pageAccessToken) {
  const args = text.split(' ');
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  const userState = userStates.get(senderId);

  if (text.toLowerCase().startsWith("gemini générer")) {
    const prompt = text.replace("gemini générer", "").trim();
    await handleGeminiImageCommand(senderId, prompt, pageAccessToken);
  } else if (userState && userState.mode === 'image_action') {
    // Action sur l'image
    await handleImageAction(senderId, text, userState.imageAnalysis, pageAccessToken);
  } else if (command) {
    try {
      await command.execute(senderId, args, pageAccessToken, sendMessage);
    } catch (error) {
      console.error(`Erreur lors de l'exécution de la commande ${commandName}:`, error);
      await sendMessage(senderId, { text: `Erreur lors de l'exécution de la commande ${commandName}.` }, pageAccessToken);
    }
  } else {
    await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande." }, pageAccessToken);
  }
}

// Fonction pour vérifier et limiter les questions gratuites à 2 par jour
function canAskFreeQuestion(senderId) {
  const today = new Date().toDateString();
  const userData = userFreeQuestions.get(senderId) || { count: 0, date: today };

  if (userData.date !== today) {
    userFreeQuestions.set(senderId, { count: 1, date: today });
    return true;
  } else if (userData.count < 2) {
    return true;
  }
  return false;
}

// Fonction pour incrémenter le nombre de questions gratuites
function incrementFreeQuestionCount(senderId) {
  const today = new Date().toDateString();
  const userData = userFreeQuestions.get(senderId) || { count: 0, date: today };
  userData.count += 1;
  userFreeQuestions.set(senderId, userData);
}

// Fonction pour appeler l'API Gemini pour analyser une image
async function analyzeImageWithGemini(imageUrl) {
  const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';

  try {
    const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}`);
    return response.data && response.data.answer ? response.data.answer : '';
  } catch (error) {
    console.error('Erreur avec Gemini :', error);
    throw new Error('Erreur lors de l\'analyse avec Gemini');
  }
}

module.exports = { handleMessage };
