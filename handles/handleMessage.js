const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs
const validCodes = ['2201', '2003', '2424']; // Liste des codes d'activation valides
const subscriptionFile = path.join(__dirname, 'users.json');

// Charger les utilisateurs abonnés
let users = fs.existsSync(subscriptionFile) ? JSON.parse(fs.readFileSync(subscriptionFile)) : {};

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Vérifier si l'utilisateur a un abonnement actif
  if (!isUserSubscribed(senderId)) {
    await handleSubscription(senderId, event.message.text, pageAccessToken);
    return;
  }

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

    // Si l'utilisateur attend une analyse d'image et entre une commande
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const args = messageText.split(' ');
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);

      if (command) {
        userStates.delete(senderId); // Quitter le mode image
        await sendMessage(senderId, { text: `🔓 Le mode image a été quitté. Exécution de la commande '${commandName}'.` }, pageAccessToken);
        return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      }

      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    // Traitement des commandes
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      await sendMessage(senderId, { text: `` }, pageAccessToken);
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    } else {
      await sendMessage(senderId, { text: "Miarahaba! Tapez 'menu' pour voir les options disponibles." }, pageAccessToken);
    }
  }
}

// Vérifier si un utilisateur a un abonnement actif
function isUserSubscribed(senderId) {
  const user = users[senderId];
  if (!user) return false;

  const now = new Date();
  const expirationDate = new Date(user.expiration);
  return now < expirationDate;
}

// Gérer les abonnements
async function handleSubscription(senderId, messageText, pageAccessToken) {
  if (!messageText) {
    await sendMessage(senderId, { 
      text: "⚠️ Pour utiliser mes services, veuillez fournir un code d'activation.\n👉 Si vous n'avez pas de code, contactez :\n1️⃣ Facebook : RTM Tafitaniaina\n2️⃣ WhatsApp : +261385858330"
    }, pageAccessToken);
    return;
  }

  if (validCodes.includes(messageText)) {
    activateSubscription(senderId);
    const expirationDate = getExpirationDate(senderId);
    await sendMessage(senderId, { 
      text: `🎉 Votre abonnement a été activé avec succès !\n📅 Valide jusqu'au : ${expirationDate}` 
    }, pageAccessToken);
  } else {
    await sendMessage(senderId, { 
      text: "❌ Code d'activation incorrect. Veuillez obtenir un code valide pour continuer."
    }, pageAccessToken);
  }
}

// Activer un abonnement pour un utilisateur
function activateSubscription(senderId) {
  const now = new Date();
  const expiration = new Date();
  expiration.setDate(now.getDate() + 30);

  users[senderId] = {
    activation: now.toISOString(),
    expiration: expiration.toISOString(),
  };

  fs.writeFileSync(subscriptionFile, JSON.stringify(users, null, 2));
}

// Obtenir la date d'expiration d'un abonnement
function getExpirationDate(senderId) {
  const user = users[senderId];
  if (!user) return null;

  const options = { timeZone: 'Indian/Antananarivo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const expirationDate = new Date(user.expiration);
  return expirationDate.toLocaleString('fr-FR', options);
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  // Inchangé
}

// Fonction pour appeler l'API Gemini pour analyser une image avec un prompt
async function analyzeImageWithGemini(imageUrl, prompt) {
  // Inchangé
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  // Inchangé
}

module.exports = { handleMessage };
