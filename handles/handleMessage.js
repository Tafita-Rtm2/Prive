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

// Liste des codes valides pour l'abonnement
const validCodes = ['1208', '2201', '8280', '2003', '0612', '1212'];
// Chemin vers le fichier JSON pour sauvegarder les abonnements
const subscriptionsFilePath = path.join(__dirname, 'handles/subscriptions.json');

// Charger les abonnements depuis le fichier JSON
function loadSubscriptions() {
  if (fs.existsSync(subscriptionsFilePath)) {
    const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
    return JSON.parse(data);
  }
  return {};
}

// Sauvegarder les abonnements dans le fichier JSON
function saveSubscriptions(subscriptions) {
  fs.writeFileSync(subscriptionsFilePath, JSON.stringify(subscriptions, null, 2), 'utf8');
}

// Vérifier si l'utilisateur a un abonnement actif
function isSubscriptionActive(senderId) {
  const subscriptions = loadSubscriptions();
  if (!subscriptions[senderId]) return false;

  const expirationDate = new Date(subscriptions[senderId].expiresAt);
  return new Date() <= expirationDate;
}

// Ajouter un abonnement pour un utilisateur
function addSubscription(senderId, days = 30) {
  const subscriptions = loadSubscriptions();
  const now = new Date();
  const expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  subscriptions[senderId] = {
    subscribedAt: now.toISOString(),
    expiresAt: expirationDate.toISOString(),
  };

  saveSubscriptions(subscriptions);
  return expirationDate;
}

// Valider les codes d'abonnement
function isValidCode(code) {
  return validCodes.includes(code);
}

// Nettoyer les abonnements expirés
function cleanExpiredSubscriptions() {
  const subscriptions = loadSubscriptions();
  const now = new Date();
  for (const senderId in subscriptions) {
    if (new Date(subscriptions[senderId].expiresAt) < now) {
      delete subscriptions[senderId];
    }
  }
  saveSubscriptions(subscriptions);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique de l'utilisateur
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    // Gestion des codes d'abonnement
    if (messageText.startsWith("code")) {
      const userCode = messageText.split(" ")[1]; // Supposons que le code soit fourni après "code"
      if (isValidCode(userCode)) {
        const expirationDate = addSubscription(senderId, 30); // Abonnement pour 30 jours
        await sendMessage(senderId, {
          text: `🎉 Votre abonnement est activé et sera valide jusqu'au ${expirationDate.toLocaleDateString()}!`,
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: "❌ Code invalide. Veuillez vérifier et réessayer.",
        }, pageAccessToken);
      }
      return;
    }

    // Vérification de l'abonnement avant d'utiliser une commande
    if (!isSubscriptionActive(senderId)) {
      await sendMessage(senderId, {
        text: "⛔ Vous n'avez pas d'abonnement actif. Veuillez activer un abonnement avec un code valide.",
      }, pageAccessToken);
      return;
    }

    // Traitement des commandes
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    await sendMessage(senderId, {
      text: "miarahaba mba ahafahana mampiasa dia. tapez le bouton 'menu' pour continuer.",
    }, pageAccessToken);
  }
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
      const formattedResponse = `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}`;
      const maxMessageLength = 2000;

      if (formattedResponse.length > maxMessageLength) {
        const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
        for (const message of messages) {
          await sendMessage(senderId, { text: message }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }
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

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

module.exports = { handleMessage };
