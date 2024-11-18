const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Gestion des commandes et états
const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userSubscriptions = new Map(); // Enregistre les abonnements utilisateurs avec une date d'expiration
const validCodes = ["2201", "1206", "0612", "1212", "2003"];
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // Durée de l'abonnement : 30 jours en millisecondes
const subscriptionCost = 3000; // Coût de l'abonnement : 3000 AR

// Charger les abonnements sauvegardés
const subscriptionFile = path.join(__dirname, 'subscriptions.json');
loadSubscriptions();

function loadSubscriptions() {
  if (fs.existsSync(subscriptionFile)) {
    const data = JSON.parse(fs.readFileSync(subscriptionFile));
    for (const [userId, expiration] of Object.entries(data)) {
      userSubscriptions.set(userId, expiration);
    }
  }
}

function saveSubscriptions() {
  const data = Object.fromEntries(userSubscriptions);
  fs.writeFileSync(subscriptionFile, JSON.stringify(data, null, 2));
}

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Vérification de l'abonnement
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);
  if (!expirationDate) return false; // Pas d'abonnement
  if (Date.now() < expirationDate) return true; // Abonnement valide
  // Supprimer si expiré
  userSubscriptions.delete(senderId);
  saveSubscriptions();
  return false;
}

// Notifications avant expiration
async function notifySubscriptionExpiry(senderId, pageAccessToken) {
  const expirationDate = userSubscriptions.get(senderId);
  if (expirationDate && Date.now() > expirationDate - 3 * 24 * 60 * 60 * 1000) { // 3 jours avant expiration
    await sendMessage(senderId, {
      text: `⏳ Votre abonnement expirera bientôt (le ${new Date(expirationDate).toLocaleDateString()}). Renouvelez-le en entrant un code valide.`
    }, pageAccessToken);
  }
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, {
    text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? ✨ Posez toutes vos questions à propos de cette photo ! 📸😊."
  }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔 ⏳" }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }

    // Rester en mode d'analyse d'image tant que l'utilisateur ne tape pas "menu"
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

// Afficher le menu principal
async function showMenu(senderId, pageAccessToken) {
  const isSubscribed = checkSubscription(senderId);
  if (isSubscribed) {
    const expirationDate = new Date(userSubscriptions.get(senderId));
    await sendMessage(senderId, {
      text: `📋 Menu principal :\n- Votre abonnement est actif jusqu'au ${expirationDate.toLocaleDateString()}.\n- Tapez un code pour le renouveler.\n- Tapez 'menu abonnement' pour gérer vos options.`
    }, pageAccessToken);
  } else {
    await sendMessage(senderId, {
      text: `❌ Vous n'êtes pas abonné.\n- Entrez un code d'abonnement pour activer votre accès.\n- Coût : ${subscriptionCost} AR pour 30 jours.`
    }, pageAccessToken);
  }
}

// Gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    // Gérer les images
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim().toLowerCase();

    // Gestion du menu
    if (messageText === 'menu') {
      return await showMenu(senderId, pageAccessToken);
    }

    if (messageText === 'menu abonnement') {
      const isSubscribed = checkSubscription(senderId);
      if (isSubscribed) {
        const expirationDate = new Date(userSubscriptions.get(senderId));
        await sendMessage(senderId, {
          text: `📅 Votre abonnement est actif jusqu'au ${expirationDate.toLocaleDateString()}.\nRenouvelez-le avant expiration.`
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `❌ Vous n'êtes pas abonné. Utilisez un code valide pour activer l'accès.`
        }, pageAccessToken);
      }
      return;
    }

    // Validation d'un code d'abonnement
    if (validCodes.includes(messageText)) {
      const expirationDate = Date.now() + subscriptionDuration;
      userSubscriptions.set(senderId, expirationDate);
      saveSubscriptions();
      await sendMessage(senderId, {
        text: `✅ Code validé ! Votre abonnement de 30 jours est maintenant actif jusqu'au ${new Date(expirationDate).toLocaleDateString()} !`
      }, pageAccessToken);
      return;
    }

    // Notifications avant expiration
    if (checkSubscription(senderId)) {
      await notifySubscriptionExpiry(senderId, pageAccessToken);
    }

    // Par défaut, traiter le reste des commandes
    await sendMessage(senderId, {
      text: "❓ Commande non reconnue. Tapez 'menu' pour voir les options disponibles."
    }, pageAccessToken);
  }
}

module.exports = { handleMessage };
