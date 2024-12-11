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

  // Récupérer l'état de l'utilisateur
  const userState = userStates.get(senderId);

  // Gestion des images envoyées par l'utilisateur
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;

    // Si une commande est verrouillée, passer l'image à la commande active
    if (userState && userState.lockedCommand) {
      const commandName = userState.lockedCommand;
      const command = commands.get(commandName);
      if (command) {
        return await command.execute(senderId, { imageUrl }, pageAccessToken, sendMessage);
      }
    } else {
      // Sinon, demander à l'utilisateur ce qu'il veut faire avec l'image
      await askForImagePrompt(senderId, imageUrl, pageAccessToken);
      return;
    }
  }

  // Gestion des messages texte
  if (event.message.text) {
    const messageText = event.message.text.trim();

    // Gestion de la commande "stop" pour quitter une commande verrouillée
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton menu pour continuer ✔." }, pageAccessToken);
      return;
    }

    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    // Si une commande est reconnue
    if (command) {
      // Activer le verrouillage sur cette commande
      userStates.set(senderId, { lockedCommand: commandName });
      await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant active. Posez vos questions ou interagissez avec cette commande. Tapez 'stop' pour quitter.` }, pageAccessToken);
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si aucune commande n'est active, mais que l'utilisateur interagit
    if (userState && userState.lockedCommand) {
      const lockedCommand = userState.lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);

      if (lockedCommandInstance) {
        // Passer la requête à la commande verrouillée
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    }

    // Si le message n'est pas reconnu
    await sendMessage(senderId, { text: "Commande non reconnue. Essayez une commande valide ou tapez le bouton 'menu'✔." }, pageAccessToken);
  }
}

// Demander un prompt pour une image envoyée
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez vos questions ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser une image avec un prompt (sans Gemini)
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔 ⏳" }, pageAccessToken);

    // Simuler une analyse d'image (remplace Gemini ici)
    const response = `Voici une analyse simulée pour l'image : ${imageUrl}, avec votre question : "${prompt}"`;

    await sendMessage(senderId, { text: response }, pageAccessToken);
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

// Module exports
module.exports = { handleMessage };
