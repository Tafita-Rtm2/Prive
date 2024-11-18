const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userSubscriptions = new Map(); // Enregistre les abonnements utilisateurs
const userFreeQuestions = new Map(); // Suivi des questions gratuites par utilisateur (par jour)
const validCodes = ["2201", "1206", "0612", "1212", "2003"]; // Codes d'abonnement valides
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // Durée de l'abonnement : 30 jours (en ms)
const subscriptionCost = 3000; // Coût de l'abonnement : 3000 AR
const freeQuestionLimit = 2; // Limite de 2 questions gratuites par jour

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Vérifier l'abonnement de l'utilisateur ou sa limite de questions gratuites
  if (!isUserAllowed(senderId)) {
    await sendMessage(senderId, {
      text: "🚫 Vous avez atteint votre limite de questions gratuites pour aujourd'hui ou vous n'êtes pas abonné. Veuillez entrer un code d'abonnement valide pour continuer."
    }, pageAccessToken);
    return;
  }

  // Gestion des messages envoyés par l'utilisateur
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    // Gérer les images
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Validation d'un code d'abonnement
    if (validCodes.includes(messageText)) {
      const expirationDate = Date.now() + subscriptionDuration;

      // Enregistrer l'abonnement
      userSubscriptions.set(senderId, {
        expirationDate,
        paymentVerified: true
      });

      await sendMessage(senderId, {
        text: `✅ Code validé ! Votre abonnement de 30 jours est maintenant actif jusqu'au ${new Date(expirationDate).toLocaleDateString()} !`
      }, pageAccessToken);

      // Exécution automatique de la commande "help" après validation
      const helpCommand = commands.get('help');
      if (helpCommand) {
        await helpCommand.execute(senderId, [], pageAccessToken, sendMessage);
      } else {
        await sendMessage(senderId, { text: "❌ La commande 'help' n'est pas disponible." }, pageAccessToken);
      }
      return;
    }

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel." }, pageAccessToken);
      return;
    }

    // Gestion des questions gratuites pour les utilisateurs non abonnés
    updateFreeQuestions(senderId);

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
      // Si l'utilisateur était verrouillé sur une autre commande, on déverrouille
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          await sendMessage(senderId, { text: `🔓 Vous n'êtes plus verrouillé sur ☑'${previousCommand}'. Basculé vers ✔'${commandName}'.` }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée✔. Toutes vos questions seront traitées par cette commande🤖. Tapez 'stop' pour quitter🚫.` }, pageAccessToken);
      }
      // Verrouiller sur la nouvelle commande
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si l'utilisateur est déjà verrouillé sur une commande
    if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
      const lockedCommand = userStates.get(senderId).lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance) {
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    } else {
      // Sinon, traiter comme texte générique ou commande non reconnue
      await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande. Essayez une commande valide ou tapez 'help'." }, pageAccessToken);
    }
  }
}

// Fonction pour vérifier si un utilisateur est autorisé (abonné ou dans la limite gratuite)
function isUserAllowed(senderId) {
  const isSubscribed = checkSubscription(senderId);

  if (isSubscribed) {
    return true; // Utilisateur abonné, aucune limite
  }

  // Vérifier les questions gratuites restantes
  const freeQuestionsLeft = checkFreeQuestions(senderId);
  return freeQuestionsLeft > 0;
}

// Fonction pour vérifier l'abonnement de l'utilisateur
function checkSubscription(senderId) {
  const subscription = userSubscriptions.get(senderId);
  if (!subscription) return false; // Pas d'abonnement

  const { expirationDate, paymentVerified } = subscription;
  if (!paymentVerified) return false; // Paiement non vérifié
  if (Date.now() < expirationDate) return true; // Abonnement encore valide

  // Supprimer l'abonnement si expiré
  userSubscriptions.delete(senderId);
  return false;
}

// Fonction pour vérifier les questions gratuites disponibles
function checkFreeQuestions(senderId) {
  const today = new Date().toLocaleDateString(); // Clé basée sur la date
  if (!userFreeQuestions.has(senderId)) {
    userFreeQuestions.set(senderId, { [today]: freeQuestionLimit });
    return freeQuestionLimit;
  }

  const userStats = userFreeQuestions.get(senderId);
  if (!userStats[today]) {
    userStats[today] = freeQuestionLimit;
    return freeQuestionLimit;
  }

  return userStats[today];
}

// Fonction pour réduire les questions gratuites restantes
function updateFreeQuestions(senderId) {
  const today = new Date().toLocaleDateString();
  if (!userFreeQuestions.has(senderId)) {
    userFreeQuestions.set(senderId, { [today]: freeQuestionLimit - 1 });
  } else {
    const userStats = userFreeQuestions.get(senderId);
    userStats[today] = (userStats[today] || freeQuestionLimit) - 1;
    userFreeQuestions.set(senderId, userStats);
  }
}

module.exports = { handleMessage };
