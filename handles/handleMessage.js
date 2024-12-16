const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { sendMessage } = require('./sendMessage');

// Connexion à MongoDB
const mongoURI = "mongodb+srv://niainatafita85:<Tafitaniaina1206>@malagasybottraduction.km5s6.mongodb.net/?retryWrites=true&w=majority&appName=Malagasybottraduction";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connecté"))
  .catch(err => console.error("❌ Erreur MongoDB:", err));

// Modèle utilisateur pour gérer les abonnements
const UserSchema = new mongoose.Schema({
  senderId: String,
  activationCode: String,
  activatedAt: Date,
  expiresAt: Date
});
const User = mongoose.model('User', UserSchema);

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // **Étape 1 : Vérification de l'abonnement**
  const user = await User.findOne({ senderId });
  const currentDate = new Date();

  if (!user || currentDate > user.expiresAt) {
    await sendMessage(senderId, {
      text: `🔒 Pour utiliser mes services, veuillez fournir votre code d'activation.\n\nSi vous n'avez pas de code, veuillez contacter RTM Tafitaniana :\n- 📞 Téléphone : +261385858330\n- 💬 WhatsApp : 0385858330\n\nL'abonnement coûte 3000 Ar pour une durée de 30 jours.`
    }, pageAccessToken);

    // Vérification du code d'activation
    if (event.message.text && event.message.text.trim().length === 4) {
      const activationCode = event.message.text.trim();
      if (isValidCode(activationCode)) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await User.findOneAndUpdate(
          { senderId },
          { activationCode, activatedAt: currentDate, expiresAt },
          { upsert: true }
        );

        await sendMessage(senderId, {
          text: `✅ Votre abonnement a été activé avec succès le ${currentDate.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}.\n📆 Expiration : ${expiresAt.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}\n\nMerci d'utiliser notre service ! 🎉`
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: "❌ Le code que vous avez entré est invalide. Veuillez vérifier votre code ou contacter RTM Tafitaniana pour obtenir un code valide."
        }, pageAccessToken);
      }
    }
    return;
  }

  // **Étape 2 : Ton code EXISTANT commence ici (inchangé)**

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

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    // Si l'utilisateur attend une analyse d'image
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const args = messageText.split(' ');
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);

      if (command) {
        userStates.delete(senderId);
        await sendMessage(senderId, { text: `🔓 Le mode image a été quitté. Exécution de la commande '${commandName}'.` }, pageAccessToken);
        return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      }

      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    // Traitement des commandes
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    await sendMessage(senderId, {
      text: "❓ Je ne comprends pas votre demande. Tapez 'menu' pour voir les options disponibles."
    }, pageAccessToken);
  }
}

// Vérification de la validité du code
function isValidCode(code) {
  const masterCode = "2201018280";
  const generatedCode = (parseInt(masterCode) + parseInt(code)).toString();
  return generatedCode.endsWith(code);
}

// Demander un prompt image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl });
  await sendMessage(senderId, {
    text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ?"
  }, pageAccessToken);
}

// Analyser une image avec un prompt
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image..." }, pageAccessToken);
    const result = await analyzeImageWithGemini(imageUrl, prompt);
    await sendMessage(senderId, { text: `📄 Résultat : ${result}` }, pageAccessToken);
  } catch (error) {
    console.error(error);
    await sendMessage(senderId, { text: "⚠️ Erreur lors de l'analyse de l'image." }, pageAccessToken);
  }
}

module.exports = { handleMessage };
