const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Durée de l'abonnement (30 jours en millisecondes)
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000;

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Obtenir l'ID utilisateur unique via l'API
  let uniqueUserId;
  try {
    uniqueUserId = await fetchUserId(`https://www.facebook.com/${senderId}`);
  } catch (error) {
    await sendMessage(senderId, { text: "❌ Impossible de vérifier votre identité. Réessayez plus tard." }, pageAccessToken);
    return;
  }

  // Initialiser l'état de l'utilisateur si nécessaire
  if (!userStates.has(uniqueUserId)) {
    userStates.set(uniqueUserId, { subscriptionDate: null, expirationDate: null });
  }

  const userState = userStates.get(uniqueUserId);
  const isSubscriptionActive = userState.expirationDate && Date.now() < userState.expirationDate;

  // Vérifier si l'utilisateur envoie un texte
  if (event.message.text) {
    const messageText = event.message.text.trim();

    // Gestion de l'abonnement
    if (messageText.toLowerCase() === 'abonement') {
      if (isSubscriptionActive) {
        const remainingTime = userState.expirationDate - Date.now();
        const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
        const expirationDate = new Date(userState.expirationDate).toLocaleString();
        await sendMessage(senderId, {
          text: `✅ Vous êtes déjà abonné.\n- Début : ${new Date(userState.subscriptionDate).toLocaleString()}\n- Expire : ${expirationDate}\n- Reste : ${remainingDays} jour(s).`
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `💡 Vous n'êtes pas abonné. Utilisez un code d'abonnement valide ou contactez-nous :\n- Par MVola : +261385858330\n- Facebook : [RTM Tafitaniaina](https://www.facebook.com/manarintso.niaina).\nL'abonnement coûte 3000 Ar pour 30 jours.`
        }, pageAccessToken);
      }
      return;
    }

    // Vérifier si un code d'abonnement valide est envoyé
    const validCodes = ['CODE123', 'CODE456']; // Remplacez par vos codes d'abonnement valides
    if (validCodes.includes(messageText)) {
      if (isSubscriptionActive) {
        await sendMessage(senderId, { text: "✅ Vous êtes déjà abonné. Aucun besoin d'activer un autre code pour le moment." }, pageAccessToken);
      } else {
        const expirationDate = Date.now() + subscriptionDuration; // Ajouter 30 jours
        userStates.set(uniqueUserId, { subscriptionDate: Date.now(), expirationDate });
        await sendMessage(senderId, {
          text: `✅ Code valide ! Vous êtes maintenant abonné.\n- Début : ${new Date().toLocaleString()}\n- Expire : ${new Date(expirationDate).toLocaleString()}.\nMerci de votre confiance !`
        }, pageAccessToken);
      }
      return;
    }

    // Bloquer l'accès si l'utilisateur n'est pas abonné
    if (!isSubscriptionActive) {
      await sendMessage(senderId, {
        text: "❌ Vous n'êtes pas abonné. Envoyez 'abonement' pour savoir comment vous abonner."
      }, pageAccessToken);
      return;
    }
  }

  // Gestion des autres messages (sans modification)
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel." }, pageAccessToken);
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
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée. Tapez 'stop' pour quitter.` }, pageAccessToken);
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
      await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande. Essayez une commande valide ou tapez 'help'." }, pageAccessToken);
    }
  }
}

// Fonction pour récupérer l'ID utilisateur unique
async function fetchUserId(fbUrl) {
  try {
    const response = await axios.get(`https://ccprojectapis.ddns.net/api/fb?url=${encodeURIComponent(fbUrl)}`);
    if (response.data && response.data.id) {
      return response.data.id;
    } else {
      throw new Error('Impossible de récupérer l\'ID utilisateur.');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'ID utilisateur :', error);
    throw new Error('Erreur de communication avec l\'API.');
  }
}

async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? ✨ Posez toutes vos questions à propos de cette photo ! 📸😊." }, pageAccessToken);
}

async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... ⏳" }, pageAccessToken);
    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);
    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }
    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

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

module.exports = {
  handleMessage
};
