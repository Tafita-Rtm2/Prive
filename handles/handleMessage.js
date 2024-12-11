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

    // Vérifier si l'utilisateur est en attente d'un prompt pour une image
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      // Si une commande est verrouillée, elle peut traiter l'analyse d'image
      if (userStates.has(senderId)) {
        const lockedCommand = userStates.get(senderId).lockedCommand || commandName;
        userStates.set(senderId, { lockedCommand, history: userStates.get(senderId).history || [] });

        await sendMessage(senderId, { text: `🔒 La commande '${lockedCommand}' est maintenant active. Tapez le bouton 'menu' pour quitter.` }, pageAccessToken);
        return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      }

      userStates.set(senderId, { lockedCommand: commandName, history: [] });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si aucune commande n'est active, envoyer un message d'erreur
    await sendMessage(senderId, { text: "Commande non reconnue. Essayez une commande valide ou tapez le bouton 'menu'✔." }, pageAccessToken);
  }
}

// Demander un prompt pour une image envoyée
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl, history: userStates.get(senderId)?.history || [] });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez vos questions ! 📸😊." }, pageAccessToken);
}

// Analyser une image avec un prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Analyse de l'image en cours... ⏳" }, pageAccessToken);

    const analysisResult = await analyzeImageWithGemini(imageUrl, prompt);

    if (analysisResult) {
      await sendMessage(senderId, { text: `📄 Voici la réponse à votre question concernant l'image :\n${analysisResult}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }

    // Ajouter à l'historique
    const userState = userStates.get(senderId) || {};
    const updatedHistory = [...(userState.history || []), { type: 'image-analysis', imageUrl, prompt, response: analysisResult }];
    userStates.set(senderId, { ...userState, awaitingImagePrompt: false, history: updatedHistory });
  } catch (error) {
    console.error("Erreur lors de l'analyse de l'image :", error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

// Appeler l'API Gemini pour analyser une image
async function analyzeImageWithGemini(imageUrl, prompt) {
  const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';

  try {
    const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
    return response.data && response.data.answer ? response.data.answer : '';
  } catch (error) {
    console.error("Erreur avec Gemini :", error);
    throw new Error("Erreur lors de l'analyse avec Gemini");
  }
}

module.exports = { handleMessage };
