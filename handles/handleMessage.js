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
    // Si l'utilisateur n'a pas d'abonnement actif
    if (event.message.text) {
      const messageText = event.message.text.trim();

      // Vérification des codes d'abonnement
      if (validCodes.includes(messageText)) {
        const expirationDate = addSubscription(senderId);
        await sendMessage(senderId, {
          text: `✅ Votre abonnement a été activé avec succès ! 🎉\n📅 Date d'activation : ${new Date().toLocaleString()}\n📅 Expiration : ${expirationDate.toLocaleString()}.\n\ntaper le bouton menu maintenant pour continuer et choisir d'ia Merci d'utiliser notre service ! 🚀`,
        }, pageAccessToken);
      } else {
        // Code invalide
        await sendMessage(senderId, {
          text: `❌ Le code fourni est invalide. Veuillez acheter un abonnement pour activer ce service. 🙏\n\n👉 Lien Facebook : [RTM TAFITANIANA](https://www.facebook.com/manarintso.niaina)\n📞 WhatsApp: +261 38 58 58 330\n\n💳 Abonnement : 3000 Ar pour 30 jours.`,
        }, pageAccessToken);
      }
    }
    return;
  }

  // Si l'abonnement est actif, continuer le flux existant
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel taper le bouton menu pour continuer ✔." }, pageAccessToken);
      return;
    }

    if (messageText.toLowerCase() === 'continuer') {
      // Gérer la commande "continuer"
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
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          await sendMessage(senderId, { text: `🔓 Vous n'êtes plus verrouillé sur '${previousCommand}'. Basculé vers '${commandName}'.` }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée. Tapez le bouton 'menu' pour quitter.` }, pageAccessToken);
      }
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
      // Enregistrer le contexte avant d'envoyer une réponse
      await processPrompt(senderId, messageText, pageAccessToken);
    }
  }
}

// Gérer un prompt et sauvegarder la réponse dans le contexte utilisateur
async function processPrompt(senderId, prompt, pageAccessToken) {
  try {
    const apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
    await sendMessage(senderId, { text: "⏳ GPT4o Pro est en train de répondre..." }, pageAccessToken);

    const response = await axios.get(apiUrl);
    const text = response.data.answer || "Désolé, je n'ai pas pu obtenir une réponse.";

    // Enregistrer la dernière réponse dans le contexte utilisateur
    userContexts.set(senderId, { lastResponse: text });

    await sendMessage(senderId, { text: text }, pageAccessToken);
  } catch (error) {
    console.error("Erreur lors de l'appel à l'API GPT4o Pro :", error);
    await sendMessage(senderId, { text: "Une erreur est survenue. Veuillez réessayer plus tard." }, pageAccessToken);
  }
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? ✨ Posez toutes vos questions à propos de cette photo ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔 ⏳" }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📋 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` }, pageAccessToken);
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

module.exports = { handleMessage };
