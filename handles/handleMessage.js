const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Liste des codes valides
const validCodes = ['1206', '2201', '8280', '2003', '0612', '1212'];
const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userContexts = new Map(); // Suivi du contexte des utilisateurs pour continuer la conversation

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Chemin vers le fichier JSON pour sauvegarder les abonnements
const subscriptionsFilePath = path.join(__dirname, '../subscriptions.json');

// Charger les abonnements depuis le fichier JSON
function loadSubscriptions() {
  if (fs.existsSync(subscriptionsFilePath)) {
    const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
    return JSON.parse(data);
  }
  return {};
}

// Sauvegarder les abonnements dans le fichier JSON
function saveSubscriptions(subscriptions) {
  fs.writeFileSync(subscriptionsFilePath, JSON.stringify(subscriptions, null, 2), 'utf8');
}

// Vérifier si l'utilisateur a un abonnement actif
function isSubscriptionActive(senderId) {
  const subscriptions = loadSubscriptions();
  if (!subscriptions[senderId]) return false;

  const expirationDate = new Date(subscriptions[senderId].expiresAt);
  return new Date() <= expirationDate;
}

// Ajouter un abonnement pour un utilisateur
function addSubscription(senderId, days = 30) {
  const subscriptions = loadSubscriptions();
  const now = new Date();
  const expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  subscriptions[senderId] = {
    subscribedAt: now.toISOString(),
    expiresAt: expirationDate.toISOString(),
  };

  saveSubscriptions(subscriptions);
  return expirationDate;
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  if (!isSubscriptionActive(senderId)) {
    if (event.message.text) {
      const messageText = event.message.text.trim();

      if (validCodes.includes(messageText)) {
        const expirationDate = addSubscription(senderId);
        await sendMessage(senderId, {
          text: `✅ Votre abonnement a été activé avec succès ! 🎉\n📅 Date d'activation : ${new Date().toLocaleString()}\n📅 Expiration : ${expirationDate.toLocaleString()}\n\nMerci d'utiliser notre service ! 🚀`,
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `❌ Code invalide. Veuillez acheter un abonnement pour activer ce service. 🙏\n\n👉 Facebook : [RTM TAFITANIANA](https://www.facebook.com/manarintso.niaina)\n📞 WhatsApp : +261 38 58 58 330\n\n💳 Abonnement : 3000 Ar pour 30 jours.`,
        }, pageAccessToken);
      }
    }
    return;
  }

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez 'menu' pour continuer. ✔" }, pageAccessToken);
      return;
    }

    if (messageText.toLowerCase() === 'continuer') {
      if (userContexts.has(senderId) && userContexts.get(senderId).lastResponse) {
        const continuationPrompt = `${userContexts.get(senderId).lastResponse} Continue...`;
        await processPrompt(senderId, continuationPrompt, pageAccessToken);
      } else {
        await sendMessage(senderId, { text: "Je ne sais pas quoi continuer. Posez une nouvelle question. 😊" }, pageAccessToken);
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
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    await processPrompt(senderId, messageText, pageAccessToken);
  }
}

// Sauvegarder et continuer les conversations
async function processPrompt(senderId, prompt, pageAccessToken) {
  try {
    const apiUrl = `https://ccprojectapis.ddns.net/api/gpt4o-pro?q=${encodeURIComponent(prompt)}&uid=${encodeURIComponent(senderId)}`;
    await sendMessage(senderId, { text: "⏳ GPT4o Pro est en train de répondre..." }, pageAccessToken);

    const response = await axios.get(apiUrl);
    const text = response.data.answer || "Désolé, je n'ai pas pu obtenir une réponse.";

    userContexts.set(senderId, { lastResponse: text });

    await sendMessage(senderId, { text: text }, pageAccessToken);
  } catch (error) {
    console.error("Erreur avec GPT4o Pro :", error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue. Veuillez réessayer plus tard." }, pageAccessToken);
  }
}

// Gestion des images
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue ! Que voulez-vous en faire ? Posez vos questions. 😊" }, pageAccessToken);
}

async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Traitement de votre image. Un instant... ⏳" }, pageAccessToken);

    const response = await axios.get(`https://sandipbaruwal.onrender.com/gemini2?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
    const analysis = response.data.answer || "Je n'ai pas pu analyser cette image. 😕";

    await sendMessage(senderId, { text: `📝 Résultat : ${analysis}` }, pageAccessToken);
  } catch (error) {
    console.error("Erreur d'analyse d'image :", error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

module.exports = { handleMessage };
