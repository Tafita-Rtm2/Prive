const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Variables globales
const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations

// Chemin pour sauvegarder les abonnements
const subscriptionsFilePath = path.join(__dirname, 'handles/users.json');

// Liste des codes d'abonnement valides
const validCodes = ['1206', '2201', '8280', '2003', '0612', '1212'];

// Vérification du code d'abonnement
if (validCodes.includes(messageText.trim())) {
  const expirationDate = addSubscription(senderId);
  await sendMessage(senderId, {
    text: `✅ Votre abonnement de 30 jours a été activé avec succès ! 🎉\n📅 Activation : ${new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}\n📅 Expiration : ${expirationDate.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}.\n\n🔑 Tapez 'menu' pour continuer !`,
  }, pageAccessToken);
} else {
  // Code invalide
  await sendMessage(senderId, {
    text: `❌ Code d'abonnement invalide. Veuillez acheter un abonnement.\n\n👉 Contact :\n📞 WhatsApp : +261385858330\n🌐 Facebook : [RTM TAFITANIANA](https://www.facebook.com/manarintso.niaina)\n💳 Tarif : 3000 Ar pour 30 jours.`,
  }, pageAccessToken);
}

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

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

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérification de l'abonnement
  const now = Date.now();
  if (!isSubscriptionActive(senderId)) {
    // Si l'utilisateur n'a pas d'abonnement actif
    if (event.message.text) {
      const messageText = event.message.text.trim();

      // Vérification des codes d'abonnement
      if (validCodes.includes(messageText)) {
        const expirationDate = addSubscription(senderId);
        await sendMessage(senderId, {
          text: `✅ Votre abonnement de 30 jours a été activé avec succès ! 🎉\n📅 Activation : ${new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}\n📅 Expiration : ${expirationDate.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}.\n\n🔑 Tapez 'menu' pour continuer !`,
        }, pageAccessToken);
      } else {
        // Code invalide
        await sendMessage(senderId, {
          text: `❌ Code d'abonnement invalide. Veuillez acheter un abonnement.\n\n👉 Contact :\n📞 WhatsApp : +261385858330\n🌐 Facebook : [RTM TAFITANIANA](https://www.facebook.com/manarintso.niaina)\n💳 Tarif : 3000 Ar pour 30 jours.`,
        }, pageAccessToken);
      }
    }
    return;
  }

  // Si l'utilisateur est abonné, continuer le flux normal
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop"
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez 'menu' pour continuer." }, pageAccessToken);
      return;
    }

    // Traitement des commandes
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          await sendMessage(senderId, {
            text: `🔒 Vous utilisez déjà la commande '${previousCommand}'. Tapez 'stop' pour quitter.`,
          }, pageAccessToken);
          return;
        }
      }
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Aucune commande reconnue
    await sendMessage(senderId, {
      text: "❓ Commande non reconnue. Tapez 'menu' pour voir les options disponibles.",
    }, pageAccessToken);
  }
}

// Gestion des prompts pour les images
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl });
  await sendMessage(senderId, {
    text: "📷 Image reçue. Que voulez-vous faire avec cette image ? Posez votre question.",
  }, pageAccessToken);
}

// Fonction utilitaire pour diviser les messages longs
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

module.exports = { handleMessage };
