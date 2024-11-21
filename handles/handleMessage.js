const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userSubscriptions = new Map(); // Enregistre les abonnements utilisateurs avec une date d'expiration
const validCodes = ["2201", "1206", "0612", "1212", "2003"];
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

  // Vérifier si l'utilisateur est abonné
  const isSubscribed = checkSubscription(senderId);

  if (!isSubscribed) {
    // Si l'utilisateur n'est pas abonné ou son abonnement a expiré
    if (event.message.text && validCodes.includes(event.message.text.trim())) {
      const expirationDate = Date.now() + subscriptionDuration;
      userSubscriptions.set(senderId, expirationDate);

      await sendMessage(senderId, {
        text: `✅ Code validé ! Votre abonnement de 30 jours est maintenant actif jusqu'au ${new Date(expirationDate).toLocaleDateString()} !`
      }, pageAccessToken);

      // Exécution automatique de la commande "help" après validation
      const helpCommand = commands.get('help');
      if (helpCommand) {
        await helpCommand.execute(senderId, [], pageAccessToken, sendMessage);
      } else {
        await sendMessage(senderId, { text: "❌ La commande 'help' n'est pas disponible." }, pageAccessToken);
      }
    } else {
      // Demander à l'utilisateur de s'abonner
      await sendMessage(senderId, {
        text: "❌ Vous devez être abonné pour utiliser le bot. Veuillez envoyer un code d'abonnement valide pour activer votre compte.\n\n👉 Pour vous abonner :\n- Envoyez le paiement au numéro Mvola **+261385858330**\n- Contactez-nous pour recevoir votre code."
      }, pageAccessToken);
    }
    return;
  }

  // Traitement des messages si l'utilisateur est abonné
  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    // Gérer les images
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

    // Commande "abonement" pour afficher les informations d'abonnement
    if (messageText.toLowerCase() === 'abonement') {
      const expirationDate = userSubscriptions.get(senderId);
      const remainingDays = Math.ceil((expirationDate - Date.now()) / (24 * 60 * 60 * 1000));
      await sendMessage(senderId, {
        text: `📅 Votre abonnement est actif.\n- Expire le : ${new Date(expirationDate).toLocaleDateString()}\n- Jours restants : ${remainingDays} jour(s).`
      }, pageAccessToken);
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
          await sendMessage(senderId, { text: `🔓 Vous n'êtes plus verrouillé sur ☑'${previousCommand}'. Basculé vers ✔'${commandName}'.` }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée✔. Tapez 'stop' pour quitter🚫.` }, pageAccessToken);
      }
      // Verrouiller sur la nouvelle commande
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si aucune commande correspondante n'est trouvée
    await sendMessage(senderId, { text: "Commande non reconnue. Tapez 'help' pour voir les commandes disponibles." }, pageAccessToken);
  }
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? ✨ Posez vos questions !" }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image... ⏳" }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Résultat :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information détectée." }, pageAccessToken);
    }

    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue." }, pageAccessToken);
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

// Fonction pour vérifier l'abonnement de l'utilisateur
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);
  if (!expirationDate) return false; // Pas d'abonnement
  if (Date.now() < expirationDate) return true; // Abonnement encore valide
  userSubscriptions.delete(senderId); // Supprimer l'abonnement expiré
  return false;
}

module.exports = { handleMessage };
