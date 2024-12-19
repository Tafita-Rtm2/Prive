const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs pour gérer les sessions
const userConversations = new Map(); // Historique des conversations des utilisateurs

// Charger toutes les commandes disponibles
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérifier si le message contient une image
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;

    // Passer en mode attente de question sur l'image
    return await askForImageQuestion(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Gestion de la commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      return await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel." }, pageAccessToken);
    }

    // Vérifier si l'utilisateur a envoyé une question pour une image
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImageQuestion) {
      const { imageUrl } = userStates.get(senderId);

      // Envoyer la question et l'URL de l'image pour analyse
      const gpt4oCommand = commands.get('gpt-4o');
      if (gpt4oCommand && gpt4oCommand.analyzeImage) {
        userStates.delete(senderId); // Quitter le mode d'attente
        return await gpt4oCommand.analyzeImage(senderId, imageUrl, messageText, pageAccessToken, sendMessage);
      }
    }

    // Traitement des commandes normales
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Message par défaut si aucune commande ne correspond
    return await sendMessage(
      senderId,
      { text: "❓ Commande non reconnue. Tapez 'menu' pour voir les options disponibles." },
      pageAccessToken
    );
  }
}

// Demander une question pour analyser l'image
async function askForImageQuestion(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImageQuestion: true, imageUrl: imageUrl });

  await sendMessage(
    senderId,
    { text: "📷 Image reçue. Veuillez entrer votre question concernant cette image. 😊" },
    pageAccessToken
  );
}

module.exports = { handleMessage };
