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
    // Gérer les images
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Validation d'un code d'abonnement
    if (validCodes.includes(messageText)) {
      const expirationDate = Date.now() + subscriptionDuration;
      userSubscriptions.set(senderId, expirationDate);
      await sendMessage(senderId, {
        text: `✅ Code validé ! Votre abonnement de 30 jours est maintenant actif jusqu'au ${new Date(expirationDate).toLocaleDateString()} !`
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

    // Commande "menu" pour quitter le mode actuel ou afficher le menu
    if (messageText.toLowerCase() === 'menu') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez une commande pour continuer." }, pageAccessToken);
      return;
    }

    // Vérifier si l'utilisateur est en mode d'analyse d'image
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    // Vérification si le message correspond au nom d'une commande pour déverrouiller et basculer
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      // Si l'utilisateur était verrouillé sur une autre commande, on déverrouille
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          await sendMessage(senderId, { text: `🔓 Vous n'êtes plus verrouillé sur '${previousCommand}'. Basculé vers '${commandName}'.` }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée. Toutes vos questions seront traitées par cette commande. Tapez 'menu' pour quitter.` }, pageAccessToken);
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
      await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande. Essayez une commande valide ou tapez 'menu'." }, pageAccessToken);
    }
  }
}

// Fonction pour vérifier l'abonnement de l'utilisateur
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);
  if (!expirationDate) return false; // Pas d'abonnement
  if (Date.now() < expirationDate) return true; // Abonnement encore valide
  // Supprimer l'abonnement si expiré
  userSubscriptions.delete(senderId);
  return false;
}

module.exports = { handleMessage };
