const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Variables globales
const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs

// Chemin vers le fichier users.json
const usersFilePath = path.join(__dirname, '../handles/users.json');
let activeUsers = {};
if (fs.existsSync(usersFilePath)) {
  activeUsers = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
}

// Sauvegarder les utilisateurs dans le fichier
function saveUsers() {
  fs.writeFileSync(usersFilePath, JSON.stringify(activeUsers, null, 2), 'utf-8');
}

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérification de l'abonnement
  const now = Date.now();
  if (!activeUsers[senderId] || activeUsers[senderId].expiry < now) {
    await sendMessage(senderId, {
      text: `⛔️ Votre abonnement a expiré ou est inexistant. Veuillez fournir un code d'activation pour activer un abonnement de 30 jours.\n\n🔑 Codes valides : 2201, 2003, 2424.\n\n➡️ Contactez RTM Tafitaniaina :\n- [Lien Facebook](https://facebook.com/rtmtafitaniaina)\n- WhatsApp : +261385858330\n- Téléphone : +261385858330.`
    }, pageAccessToken);
    return;
  }

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez 'menu' pour continuer." }, pageAccessToken);
      return;
    }

    // Validation du code d'activation
    if (/^\d{4}$/.test(messageText)) {
      const validCodes = ['2201', '2003', '2424'];
      if (validCodes.includes(messageText)) {
        const expiryDate = new Date(now + 30 * 24 * 60 * 60 * 1000); // 30 jours
        activeUsers[senderId] = { expiry: expiryDate.getTime() };
        saveUsers();
        await sendMessage(senderId, {
          text: `✅ Votre abonnement de 30 jours a été activé avec succès.\n\n📅 Valide jusqu'au : ${expiryDate.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}`
        }, pageAccessToken);
        return;
      } else {
        await sendMessage(senderId, {
          text: "❌ Code d'activation incorrect. Veuillez fournir un code valide."
        }, pageAccessToken);
        return;
      }
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
            text: `🔒 Une commande est déjà en cours (${previousCommand}). Veuillez terminer avant d'en lancer une nouvelle.`
          }, pageAccessToken);
          return;
        }
      } else {
        userStates.set(senderId, { lockedCommand: commandName });
        return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      }
    }

    // Aucun texte ou commande reconnue
    await sendMessage(senderId, {
      text: "🤖 Je ne comprends pas votre demande. Tapez 'menu' pour voir les options disponibles."
    }, pageAccessToken);
  }
}

// Gestion des images
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl });
  await sendMessage(senderId, {
    text: "📷 Image reçue. Que voulez-vous faire avec cette image ? Posez votre question."
  }, pageAccessToken);
}

async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Analyse en cours. Patientez..." }, pageAccessToken);
    const result = await analyzeImageWithGemini(imageUrl, prompt);
    await sendMessage(senderId, {
      text: `📄 Résultat de l'analyse :\n${result}`
    }, pageAccessToken);
  } catch (error) {
    console.error("Erreur lors de l'analyse de l'image :", error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse." }, pageAccessToken);
  }
}

async function analyzeImageWithGemini(imageUrl, prompt) {
  const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';
  try {
    const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
    return response.data && response.data.answer ? response.data.answer : 'Aucune donnée trouvée.';
  } catch (error) {
    console.error("Erreur avec Gemini :", error);
    throw new Error("Erreur avec l'analyse Gemini.");
  }
}

// Envoi des messages
async function sendMessage(senderId, message, pageAccessToken) {
  const url = `https://graph.facebook.com/v11.0/me/messages?access_token=${pageAccessToken}`;
  try {
    await axios.post(url, { recipient: { id: senderId }, message });
  } catch (error) {
    console.error("Erreur lors de l'envoi du message :", error.response ? error.response.data : error.message);
  }
}

module.exports = { handleMessage };
