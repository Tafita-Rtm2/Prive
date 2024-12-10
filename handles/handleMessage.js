const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Liste des codes valides
const validCodes = ['1206', '2201', '8280', '2003', '0612', '1212'];
const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userContexts = new Map(); // Suivi du contexte des utilisateurs pour "continuer"

// Objet en mémoire pour stocker les abonnements
const subscriptions = {};

// Charger les commandes
const fs = require('fs');
const path = require('path');
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Vérifier si l'utilisateur a un abonnement actif
function isSubscriptionActive(senderId) {
  if (!subscriptions[senderId]) return false;

  const expirationDate = new Date(subscriptions[senderId].expiresAt);
  return new Date() <= expirationDate;
}

// Ajouter un abonnement pour un utilisateur
function addSubscription(senderId, days = 30) {
  const now = new Date();
  const expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  subscriptions[senderId] = {
    subscribedAt: now.toISOString(),
    expiresAt: expirationDate.toISOString(),
  };

  return expirationDate;
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  if (!isSubscriptionActive(senderId)) {
    if (event.message.text) {
      const messageText = event.message.text.trim();

      // Vérification des codes d'abonnement
      if (validCodes.includes(messageText)) {
        const expirationDate = addSubscription(senderId);
        await sendMessage(senderId, {
          text: `✅ Votre abonnement a été activé avec succès ! 🎉\n📅 Date d'activation : ${new Date().toLocaleString()}\n📅 Expiration : ${expirationDate.toLocaleString()}.\n\ntaper le bouton menu maintenant pour continuer et choisir d'ia Merci d'utiliser notre service ! 🚀`,
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `❌ Le code fourni est invalide. Veuillez acheter un abonnement pour activer ce service. 🙏\n\n👉 Lien Facebook : [RTM TAFITANIANA](https://www.facebook.com/manarintso.niaina)\n📞 WhatsApp: +261 38 58 58 330\n\n💳 Abonnement : 3000 Ar pour 30 jours.`,
        }, pageAccessToken);
      }
    }
    return;
  }

  // Gestion des messages avec image
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;

    // Vérifier si l'utilisateur est verrouillé sur une commande
    if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
      const lockedCommand = userStates.get(senderId).lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);

      if (lockedCommandInstance && lockedCommandInstance.execute) {
        return await lockedCommandInstance.execute(senderId, [imageUrl], pageAccessToken, sendMessage);
      } else {
        await sendMessage(senderId, { text: "⚠️ La commande verrouillée n'est pas valide ou ne supporte pas les images." }, pageAccessToken);
      }
    } else {
      // Logique par défaut pour les images
      await askForImagePrompt(senderId, imageUrl, pageAccessToken);
    }
    return;
  }

  // Gestion des messages texte
  if (event.message.text) {
    const messageText = event.message.text.trim();

    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel taper le bouton menu pour continuer ✔." }, pageAccessToken);
      return;
    }

    if (messageText.toLowerCase() === 'continuer') {
      if (userContexts.has(senderId) && userContexts.get(senderId).lastResponse) {
        const continuationPrompt = `${userContexts.get(senderId).lastResponse} Continue...`;
        await processPrompt(senderId, continuationPrompt, pageAccessToken);
      } else {
        await sendMessage(senderId, { text: "Je ne sais pas quoi continuer. Posez une nouvelle question." }, pageAccessToken);
      }
      return;
    }

    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
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
      await processPrompt(senderId, messageText, pageAccessToken);
    }
  }
}

// Autres fonctions auxiliaires restent inchangées...

module.exports = { handleMessage };
