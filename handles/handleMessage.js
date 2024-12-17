const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

const usersFilePath = path.join(__dirname, '../handle/User.json');
const activationCodes = new Map(); // Stocker temporairement les codes générés

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Charger les utilisateurs
function loadUsers() {
  if (!fs.existsSync(usersFilePath)) return {};
  return JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Vérifier si l'utilisateur a un abonnement actif
function isSubscriptionActive(senderId) {
  const users = loadUsers();
  if (!users[senderId]) return false;

  const currentDate = new Date();
  const expirationDate = new Date(users[senderId].expiration);
  return currentDate <= expirationDate;
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Vérification de l'abonnement
  if (!isSubscriptionActive(senderId)) {
    return await handleSubscription(senderId, event.message.text, pageAccessToken);
  }

  // Ajouter le message reçu à l'historique de l'utilisateur
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    await sendMessage(senderId, { text: "Tapez 'menu' pour voir les options disponibles." }, pageAccessToken);
  }
}

// Gestion de l'abonnement
async function handleSubscription(senderId, code, pageAccessToken) {
  if (!code) {
    const generatedCode = generateCode();
    activationCodes.set(senderId, generatedCode);

    await sendMessage(senderId, {
      text: `🔒 Pour utiliser ce service, veuillez fournir un code d'activation.\nVotre code temporaire : **${generatedCode}**\n\nSi vous n'avez pas de code, contactez l'administrateur :\n📞 Téléphone : +261385858330\n💰 Prix : 3000 Ar pour 30 jours.`
    }, pageAccessToken);
    return;
  }

  const users = loadUsers();
  const validCode = activationCodes.get(senderId);

  if (code === validCode) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    users[senderId] = { expiration: expirationDate.toISOString() };
    saveUsers(users);

    activationCodes.delete(senderId);

    await sendMessage(senderId, {
      text: `✅ Votre abonnement a été activé avec succès !\n📅 Expiration : ${expirationDate.toLocaleDateString('fr-FR')}\n\nMerci d'utiliser notre service !`
    }, pageAccessToken);
  } else {
    await sendMessage(senderId, { text: "❌ Code invalide. Veuillez entrer le bon code temporaire." }, pageAccessToken);
  }
}

// Générer un code d'activation à 4 chiffres
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Demander le prompt pour une image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔⏳" }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}` }, pageAccessToken);
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }
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

module.exports = { handleMessage };
