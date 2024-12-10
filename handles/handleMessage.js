const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Liste des codes valides
const validCodes = ['1206', '2201', '8280', '2003', '0612', '1212'];
const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const conversationTimeout = 20 * 60 * 1000; // 20 minutes

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

// Gestion des conversations contextuelles
function updateUserState(senderId, key, value) {
  const state = userStates.get(senderId) || {};
  state[key] = value;
  state.lastActive = Date.now(); // Mettre à jour l'activité
  userStates.set(senderId, state);
}

function getUserState(senderId) {
  const state = userStates.get(senderId);
  if (!state) return null;

  // Vérifier si la conversation a expiré
  if (Date.now() - state.lastActive > conversationTimeout) {
    userStates.delete(senderId);
    return null;
  }
  return state;
}

// Gestion des messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  if (!isSubscriptionActive(senderId)) {
    if (event.message.text) {
      const messageText = event.message.text.trim();
      if (validCodes.includes(messageText)) {
        const expirationDate = addSubscription(senderId);
        await sendMessage(senderId, {
          text: `✅ Votre abonnement a été activé avec succès ! 🎉\n📅 Date d'activation : ${new Date().toLocaleString()}\n📅 Expiration : ${expirationDate.toLocaleString()}.\n\ntaper le bouton menu maintenant pour continuer et choisir d'ia Merci d'utiliser notre service ! 🚀`,
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `❌ Le code fourni est invalide. Veuillez acheter un abonnement pour activer ce service. 🛑\n\n👉 Lien Facebook : [RTM TAFITANIANA](https://www.facebook.com/manarintso.niaina)\n📞 WhatsApp: +261 38 58 58 330\n\n💳 Abonnement : 3000 Ar pour 30 jours.`,
        }, pageAccessToken);
      }
    }
    return;
  }

  const userState = getUserState(senderId);

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;

    if (userState && userState.lockedCommand) {
      await askForImagePrompt(senderId, imageUrl, pageAccessToken, userState.lockedCommand);
    } else {
      await askForImagePrompt(senderId, imageUrl, pageAccessToken);
    }
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton menu pour continuer ✔." }, pageAccessToken);
      return;
    }

    if (userState && userState.awaitingImagePrompt) {
      await analyzeImageWithPrompt(senderId, userState.imageUrl, messageText, pageAccessToken, userState.lockedCommand);
      return;
    }

    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      updateUserState(senderId, 'lockedCommand', commandName);
      await sendMessage(senderId, { text: `🔒 La commande '${commandName}' est maintenant verrouillée. Tapez 'stop' pour quitter.` }, pageAccessToken);
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    if (userState && userState.lockedCommand) {
      const lockedCommand = userState.lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance) {
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    } else {
      await sendMessage(senderId, { text: "Je n'ai pas pu traiter votre demande. Essayez une commande valide ou tapez le bouton 'menu'✔." }, pageAccessToken);
    }
  }
}

async function askForImagePrompt(senderId, imageUrl, pageAccessToken, lockedCommand = null) {
  updateUserState(senderId, 'awaitingImagePrompt', true);
  updateUserState(senderId, 'imageUrl', imageUrl);
  await sendMessage(senderId, {
    text: lockedCommand
      ? `📷 Vous êtes verrouillé sur '${lockedCommand}'. Que voulez-vous faire avec cette image ? ✨`
      : "📷 Image reçue. Que voulez-vous faire avec cette image ? ✨",
  }, pageAccessToken);
}

async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken, lockedCommand = null) {
  const apiUrl = lockedCommand === 'gpt4'
    ? `https://ccprojectapis.ddns.net/api/gpt4o-pro?q=${encodeURIComponent(prompt)}&uid=${senderId}&imageUrl=${encodeURIComponent(imageUrl)}`
    : `http://sgp1.hmvhostings.com:25721/gemini?question=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(imageUrl)}`;

  try {
    await sendMessage(senderId, { text: "🔍 Analyse en cours. Patientez un instant... 🤔 ⏳" }, pageAccessToken);
    const response = await axios.get(apiUrl);
    const answer = response.data && response.data.response
      ? response.data.response
      : '❌ Aucune réponse obtenue.';
    await sendMessage(senderId, { text: answer }, pageAccessToken);
    updateUserState(senderId, 'awaitingImagePrompt', false);
  } catch (error) {
    console.error('Erreur analyse image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse." }, pageAccessToken);
  }
}

module.exports = { handleMessage };
