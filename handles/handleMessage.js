const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Charger les utilisateurs avec abonnement
const usersFilePath = path.join(__dirname, '../handles/users.json');
let activeUsers = {};
if (fs.existsSync(usersFilePath)) {
  activeUsers = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
}

// Fonction pour sauvegarder les utilisateurs
function saveUsers() {
  fs.writeFileSync(usersFilePath, JSON.stringify(activeUsers, null, 2), 'utf-8');
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique de l'utilisateur
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérifier l'abonnement de l'utilisateur
  const now = Date.now();
  if (!activeUsers[senderId] || activeUsers[senderId].expiry < now) {
    await sendMessage(senderId, {
      text: `⛔️ Votre abonnement a expiré ou est inexistant. Veuillez fournir un code d'activation valide pour activer un abonnement de 30 jours.\n\n➡️ Contactez RTM Tafitaniaina :\n- [Lien Facebook](https://facebook.com/rtmtafitaniaina)\n- WhatsApp : +261385858330\n- Téléphone : +261385858330\n\n🔑 Entrez votre code d'activation pour continuer.`
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
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    // Validation du code d'activation
    if (/^\d{4}$/.test(messageText)) {
      const validCodes = ['2201', '2003', '2424']; // Liste des codes valides
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
            text: `🔒 Une commande est déjà en cours (${previousCommand}). Veuillez terminer avant de lancer une nouvelle commande.`
          }, pageAccessToken);
          return;
        }
      } else {
        await sendMessage(senderId, {
          text: `📌 Commande détectée : ${commandName}`
        }, pageAccessToken);
      }
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si aucune commande trouvée
    await sendMessage(senderId, {
      text: "🤖 Je ne comprends pas votre demande. Tapez 'menu' pour voir les options disponibles."
    }, pageAccessToken);
  }
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous faire avec cette image ? Posez votre question ! 📸." }, pageAccessToken);
}

// Analyser une image avec un prompt
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Analyse en cours. Patientez... ⏳" }, pageAccessToken);
    const result = await analyzeImageWithGemini(imageUrl, prompt);
    await sendMessage(senderId, {
      text: `📄 Résultat de l'analyse :\n${result}`
    }, pageAccessToken);
  } catch (error) {
    console.error("Erreur lors de l'analyse de l'image :", error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse." }, pageAccessToken);
  }
}

// Appeler l'API Gemini
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

module.exports = { handleMessage };
