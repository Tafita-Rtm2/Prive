const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs

const USERS_FILE = path.join(__dirname, '../handles/User.json');
const ACTIVATION_KEY = '2201018280'; // Code maître pour générer des codes
const ACTIVATION_DAYS = 30; // Durée de validité des abonnements

// Charger les utilisateurs existants
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Sauvegarder les utilisateurs
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Vérifier si un utilisateur est abonné
function isUserSubscribed(userId) {
  const users = loadUsers();
  if (users[userId]) {
    const expiration = new Date(users[userId].expiresAt);
    return new Date() < expiration; // Vérifie si l'abonnement est encore valide
  }
  return false;
}

// Fonction pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;
  const users = loadUsers();

  // Ajouter le message reçu à l'historique
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérification de l'abonnement
  if (!isUserSubscribed(senderId)) {
    if (!userStates.has(senderId)) {
      userStates.set(senderId, { awaitingActivation: true });
      return await sendMessage(senderId, { text: "🔒 Pour utiliser mes services, veuillez fournir un code d'activation. Si vous n'en avez pas, contactez RTM Tafitaniana pour un abonnement de 30 jours à 3000Ar (WhatsApp : +261385858330)." }, pageAccessToken);
    }

    const code = event.message.text.trim();
    if (/^\d{4}$/.test(code)) {
      const validCode = generateValidCode(ACTIVATION_KEY);
      if (validCode.includes(code)) {
        // Activer l'abonnement
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + ACTIVATION_DAYS);
        users[senderId] = { code, expiresAt: expirationDate };

        saveUsers(users);
        userStates.delete(senderId);
        return await sendMessage(senderId, { text: `✅ Votre abonnement a été activé avec succès.\nDate d'activation : ${new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}\nDate d'expiration : ${expirationDate.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}.\n\nMerci d'utiliser nos services !` }, pageAccessToken);
      } else {
        return await sendMessage(senderId, { text: "❌ Code invalide. Veuillez fournir un code valide ou contacter RTM Tafitaniana pour un abonnement." }, pageAccessToken);
      }
    } else {
      return await sendMessage(senderId, { text: "⚠️ Le code doit être composé de 4 chiffres. Veuillez réessayer." }, pageAccessToken);
    }
  }

  // Si abonné, continuer les commandes
  if (event.message.text) {
    const messageText = event.message.text.trim();
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    await sendMessage(senderId, { text: "⚠️ Commande inconnue. Tapez 'menu' pour voir les options disponibles." }, pageAccessToken);
  }
}

// Générer des codes valides (simulation)
function generateValidCode(key) {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = (parseInt(key) + i).toString().slice(-4); // Générer 4 chiffres
    codes.push(code);
  }
  return codes;
}

module.exports = { handleMessage };
