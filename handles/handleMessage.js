const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs
const userSubscriptions = new Map(); // Gestion des abonnements utilisateurs
const validCodes = ["2201", "1208", "0612", "1212", "2003"]; // Codes d'abonnement valides
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // Durée de l'abonnement : 30 jours en millisecondes

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique de l'utilisateur
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérifier si l'utilisateur est abonné
  const isSubscribed = checkSubscription(senderId);

  if (!isSubscribed) {
    await handleSubscriptionFlow(senderId, event.message.text, pageAccessToken);
    return;
  }

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'menu') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "" }, pageAccessToken);
      return;
    }

    // Si l'utilisateur attend une analyse d'image et entre une commande
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
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
            text: ''
          }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, {
          text: ``
        }, pageAccessToken);
      }
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Réponse par défaut si la commande est inconnue
    await sendMessage(senderId, {
      text: "mila misafidy comande alo ianao vao afaka mametraka fanotaniana ka . Tapez 'Menu' pour voir la liste des commandes disponibles."
    }, pageAccessToken);
  }
}

// Fonction pour gérer le flux d'abonnement
async function handleSubscriptionFlow(senderId, messageText, pageAccessToken) {
  // Si l'utilisateur envoie un code d'abonnement
  if (validCodes.includes(messageText)) {
    const expirationDate = Date.now() + subscriptionDuration;
    userSubscriptions.set(senderId, expirationDate);
    console.log(`Abonnement activé pour l'utilisateur ${senderId}. Valide jusqu'au : ${new Date(expirationDate).toLocaleString()}`);
    await sendMessage(senderId, {
      text: `✅ Félicitations ! Votre abonnement de 30 jours a été activé avec succès.`
    }, pageAccessToken);
    return;
  }

  // Si l'utilisateur envoie un message qui n'est pas un code valide
  await sendMessage(senderId, {
    text: `❌ Code incorrect. Veuillez faire un abonnement pour obtenir un code valide.`
  }, pageAccessToken);
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔⏳" }, pageAccessToken);

    let imageAnalysis;
    const lockedCommand = userStates.get(senderId)?.lockedCommand;

    if (lockedCommand && commands.has(lockedCommand)) {
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance && lockedCommandInstance.analyzeImage) {
        imageAnalysis = await lockedCommandInstance.analyzeImage(imageUrl, prompt);
      }
    } else {
      imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);
    }

    if (imageAnalysis) {
      const formattedResponse = `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}`;
      const maxMessageLength = 2000;

      if (formattedResponse.length > maxMessageLength) {
        const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
        for (const message of messages) {
          await sendMessage(senderId, { text: message }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }

    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

// Fonction pour appeler l'API Gemini pour analyser une image avec un prompt
async function analyzeImageWithGemini(imageUrl, prompt) {
  const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';

  try {
    const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
    return response.data && response.data.answer ? response.data.answer : '';
  } catch (error) {
    console.error('Erreur avec Gemini :', error);
    throw new Error('Erreur lors de l\'analyse avec Gemini');
  }
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

// Fonction pour vérifier l'abonnement de l'utilisateur
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);
  if (!expirationDate) return false; // Pas d'abonnement
  if (Date.now() < expirationDate) return true; // Abonnement encore valide
  userSubscriptions.delete(senderId); // Supprimer l'abonnement expiré
  return false;
}

module.exports = { handleMessage };
