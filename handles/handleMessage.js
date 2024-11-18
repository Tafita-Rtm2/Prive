const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userSubscriptions = new Map(); // Enregistre les abonnements utilisateurs avec une date d'expiration
const userFreeQuestions = new Map(); // Enregistre le nombre de questions gratuites par utilisateur par jour
const validCodes = ["2201", "1206", "0612", "1212", "2003"];
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // Durée de l'abonnement : 30 jours en millisecondes
const subscriptionCost = 3000; // Coût de l'abonnement : 3000 AR
const freeQuestionsLimit = 5; // Limite quotidienne de questions gratuites pour les non-abonnés

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

  // Gestion des questions gratuites
  if (!isSubscribed) {
    const today = new Date().toDateString();
    const userFreeData = userFreeQuestions.get(senderId) || {};
    if (userFreeData.date !== today) {
      userFreeData.date = today;
      userFreeData.count = 0;
    }

    if (userFreeData.count >= freeQuestionsLimit) {
      await sendMessage(senderId, {
        text: `⚠️ Vous avez atteint votre limite quotidienne de ${freeQuestionsLimit} questions gratuites. Abonnez-vous pour un accès illimité ! Tapez "menu" pour voir les options.`
      }, pageAccessToken);
      return;
    } else {
      userFreeData.count += 1;
      userFreeQuestions.set(senderId, userFreeData);
    }
  }

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Validation d'un code d'abonnement
    if (validCodes.includes(messageText)) {
      const expirationDate = Date.now() + subscriptionDuration;
      userSubscriptions.set(senderId, expirationDate);
      await sendMessage(senderId, {
        text: `✅ Code validé ! Votre abonnement de 30 jours est actif jusqu'au ${new Date(expirationDate).toLocaleDateString()} !`
      }, pageAccessToken);

      // Exécution automatique de la commande "menu" après validation
      const menuCommand = commands.get('menu');
      if (menuCommand) {
        await menuCommand.execute(senderId, [], pageAccessToken, sendMessage);
      } else {
        await sendMessage(senderId, { text: "❌ La commande 'menu' n'est pas disponible." }, pageAccessToken);
      }
      return;
    }

    // Commande "menu" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'menu') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous êtes maintenant dans le menu principal. Tapez une commande pour continuer." }, pageAccessToken);
      return;
    }

    // Vérifier si l'utilisateur est en mode d'analyse d'image
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    // Vérification si le message correspond au nom d'une commande
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          await sendMessage(senderId, { text: `🔓 Vous n'êtes plus verrouillé sur '${previousCommand}'. Basculé vers '${commandName}'.` }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est verrouillée. Tapez 'menu' pour quitter.` }, pageAccessToken);
      }
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
      const lockedCommand = userStates.get(senderId).lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance) {
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    } else {
      await sendMessage(senderId, { text: "Commande non reconnue. Tapez 'menu' pour voir les options disponibles." }, pageAccessToken);
    }
  }
}

// Fonction pour demander le prompt pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous faire avec cette image ? Posez vos questions ! 📸" }, pageAccessToken);
}

// Fonction pour analyser une image avec un prompt
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Traitement de votre image en cours..." }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Résultat de l'analyse :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune donnée exploitable détectée." }, pageAccessToken);
    }

    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Erreur lors de l'analyse de l'image." }, pageAccessToken);
  }
}

// Vérifier l'abonnement de l'utilisateur
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);
  if (!expirationDate) return false;
  if (Date.now() < expirationDate) return true;
  userSubscriptions.delete(senderId);
  return false;
}

module.exports = { handleMessage };
