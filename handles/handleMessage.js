const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs et des abonnements

// Liste des codes d'abonnement valides
const validCodes = ["1206", "2201", "0612", "2003", "1212", "1203", "8280"];
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // 30 jours en millisecondes

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Vérification de l'état de l'utilisateur
  const userState = userStates.get(senderId) || {};
  const isSubscriptionActive = userState.expirationDate && Date.now() < userState.expirationDate;

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    // Gérer les images
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Gestion de l'abonnement
    if (messageText.toLowerCase() === 'abonement') {
      if (isSubscriptionActive) {
        const remainingTime = userState.expirationDate - Date.now();
        const remainingDays = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
        const expirationDate = new Date(userState.expirationDate).toLocaleString();
        await sendMessage(senderId, {
          text: `✅ Vous êtes déjà abonné.\n- Début : ${new Date(userState.subscriptionDate).toLocaleString()}\n- Expire : ${expirationDate}\n- Reste : ${remainingDays} jour(s).`
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `💡 Pour vous abonner, utilisez l'un des codes valides ou contactez-nous :\n- Par MVola : +261385858330\n- Facebook : [RTM Tafitaniaina](https://www.facebook.com/manarintso.niaina).\nL'abonnement coûte 3000 Ar pour 30 jours.`
        }, pageAccessToken);
      }
      return;
    }

    // Vérification si un code d'abonnement est envoyé
    if (validCodes.includes(messageText)) {
      if (isSubscriptionActive) {
        await sendMessage(senderId, { text: "✅ Vous êtes déjà abonné. Aucun besoin d'activer un autre code pour le moment." }, pageAccessToken);
      } else {
        const expirationDate = Date.now() + subscriptionDuration; // 30 jours à partir de maintenant
        userStates.set(senderId, { subscriptionDate: Date.now(), expirationDate });
        await sendMessage(senderId, {
          text: `✅ Code valide ! Vous êtes maintenant abonné.\n- Début : ${new Date().toLocaleString()}\n- Expire : ${new Date(expirationDate).toLocaleString()}.\nMerci de votre confiance !`
        }, pageAccessToken);
      }
      return;
    }

    // Bloquer l'accès si l'abonnement est inactif
    if (!isSubscriptionActive) {
      await sendMessage(senderId, {
        text: "❌ Vous n'êtes pas abonné. Envoyez 'abonement' pour savoir comment vous abonner."
      }, pageAccessToken);
      return;
    }

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel." }, pageAccessToken);
      return;
    }

    // Vérifier si l'utilisateur est en mode d'analyse d'image
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    // Vérification si le message correspond au nom d'une commande pour déverrouiller et basculer
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      // Si l'utilisateur était verrouillé sur une autre commande, on déverrouille
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          await sendMessage(senderId, { text: `🔓 Vous n'êtes plus verrouillé sur '${previousCommand}'. Basculé vers '${commandName}'.` }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée. Tapez 'stop' pour quitter.` }, pageAccessToken);
      }
      // Verrouiller sur la nouvelle commande
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si l'utilisateur est déjà verrouillé sur une commande
    if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
      const lockedCommand = userStates.get(senderId).lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance) {
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    } else {
      // Sinon, traiter comme texte générique ou commande non reconnue
      await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande. Essayez une commande valide ou tapez 'help'." }, pageAccessToken);
    }
  }
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ?" }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant..." }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }

    // Rester en mode d'analyse d'image tant que l'utilisateur ne tape pas "stop"
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
