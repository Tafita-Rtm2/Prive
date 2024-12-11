const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Gestion des commandes et des états utilisateur
const commands = new Map();
const userStates = new Map(); // Suivi des états et conversations des utilisateurs

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Vérifier si l'utilisateur est dans une commande verrouillée
  const userState = userStates.get(senderId);

  if (userState && userState.lockedCommand) {
    const commandName = userState.lockedCommand;
    const command = commands.get(commandName);

    if (command) {
      // Passer la requête à la commande verrouillée
      return await command.execute(senderId, event.message.text || "", pageAccessToken, sendMessage);
    }
  }

  // Gérer les images envoyées par l'utilisateur
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
    return;
  }

  // Gérer les messages texte
  if (event.message.text) {
    const messageText = event.message.text.trim();

    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton menu pour continuer ✔." }, pageAccessToken);
      return;
    }

    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      // Activer la commande verrouillée
      userStates.set(senderId, { lockedCommand: commandName });
      await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant active. Posez vos questions ou interagissez avec cette commande. Tapez 'stop' pour quitter.` }, pageAccessToken);
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si aucune commande n'est active, envoyer un message d'erreur
    await sendMessage(senderId, { text: "Commande non reconnue. Essayez une commande valide ou tapez le bouton 'menu'✔." }, pageAccessToken);
  }
}

// Demander un prompt pour une image envoyée
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez vos questions ! 📸😊." }, pageAccessToken);
}

// Module exports
module.exports = { handleMessage };
