const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

const usersFilePath = path.join(__dirname, '../handle/User.json');
const CODE_GENERATION_KEY = '2201018280';

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Charger les utilisateurs
function loadUsers() {
  if (!fs.existsSync(usersFilePath)) return {};
  return JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Vérifier si l'utilisateur a un abonnement actif
function isSubscriptionActive(senderId) {
  const users = loadUsers();
  if (!users[senderId]) return false;

  const currentDate = new Date();
  const expirationDate = new Date(users[senderId].expiration);
  return currentDate <= expirationDate;
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;
  const users = loadUsers();

  // Vérifier l'abonnement de l'utilisateur
  if (!isSubscriptionActive(senderId)) {
    return await handleSubscription(senderId, event.message.text, pageAccessToken);
  }

  // Ajouter le message reçu à l'historique
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Gestion des images
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop"
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      return await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez 'menu' pour continuer ✔." }, pageAccessToken);
    }

    // Traitement des commandes
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    await sendMessage(senderId, { text: "Tapez 'menu' pour voir les options disponibles." }, pageAccessToken);
  }
}

// Gestion de l'abonnement
async function handleSubscription(senderId, code, pageAccessToken) {
  if (!code) {
    return await sendMessage(senderId, {
      text: "🔒 Pour utiliser ce service, veuillez fournir un code d'activation.\n\nSi vous n'avez pas de code, abonnez-vous en contactant RTM Tafitaniana :\n📞 WhatsApp : +261385858330\n📞 Téléphone : 0385858330\n💰 Prix : 3000 Ar pour 30 jours."
    }, pageAccessToken);
  }

  const users = loadUsers();

  // Valider le code
  if (validateCode(code)) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // Ajouter 30 jours

    users[senderId] = { expiration: expirationDate.toISOString() };
    saveUsers(users);

    return await sendMessage(senderId, {
      text: `✅ Votre abonnement a été activé avec succès !\n📅 Date d'expiration : ${expirationDate.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}\n\nMerci d'utiliser notre service !`
    }, pageAccessToken);
  } else {
    return await sendMessage(senderId, {
      text: "❌ Code invalide. Veuillez fournir un code d'activation valide ou contacter RTM Tafitaniana pour en obtenir un."
    }, pageAccessToken);
  }
}

// Fonction pour valider le code d'activation
function validateCode(code) {
  // Le code est valide s'il est généré avec la clé principale
  const validCode = generateActivationCode(CODE_GENERATION_KEY);
  return code === validCode;
}

// Fonction pour générer un code d'activation (exemple simple)
function generateActivationCode(key) {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);

  // Exemple : code à 4 chiffres basé sur le jour, mois et clé
  return `${key.slice(-4)}${day}${month}${year}`;
}

module.exports = { handleMessage };
