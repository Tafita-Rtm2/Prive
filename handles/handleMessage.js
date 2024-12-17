const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs

// Variables d'abonnement
const adminCode = "2201018280";
const userSubscriptions = new Map(); // Utilisateurs et leurs dates d'expiration d'abonnement

// MongoDB connection
const mongoUri = 'mongodb+srv://niainatafita85:<db_Tafitaniaina1206>@malagasybottraduction.km5s6.mongodb.net/?retryWrites=true&w=majority&appName=Malagasybottraduction';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Schéma de l'utilisateur pour MongoDB
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    subscriptionExpiration: { type: Date },
    isAdmin: { type: Boolean, default: false },
    activationCodes: { type: [String], default: [] }
});

const User = mongoose.model('User', userSchema);

// Fonction pour générer un code d'activation unique
function generateActivationCode() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Fonction pour vérifier si un code d'activation est valide en le comparant à la base de donne
async function isActivationCodeValid(code) {
    const users = await User.find({ activationCodes: code });
    return users && users.length > 0;
}

// Fonction pour vérifier si un utilisateur a un abonnement actif (mongodb)
async function isUserSubscribed(userId) {
    const user = await getUserSubscription(userId);
    if (!user || !user.subscriptionExpiration) {
        return false;
    }
    return user.subscriptionExpiration > new Date();
}

// Fonction pour vérifier si un utilisateur est un admin
async function isAdmin(userId) {
  const user = await getUserSubscription(userId);
  return user && user.isAdmin;
}

// Fonction pour récupérer les données d'un utilisateur depuis MongoDB
async function getUserSubscription(userId) {
    try {
        return await User.findOne({ userId });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'abonnement de l'utilisateur :", error);
        return null;
    }
}

// Fonction pour enregistrer ou mettre à jour les données d'abonnement d'un utilisateur dans MongoDB
async function saveUserSubscription(userId, expirationDate) {
    try {
        await User.updateOne(
            { userId: userId },
            { userId: userId, subscriptionExpiration: expirationDate },
            { upsert: true } // Met à jour si existe, sinon crée
        );
        console.log(`Abonnement de l'utilisateur ${userId} mis à jour.`);
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'abonnement de l'utilisateur :", error);
    }
}

// Fonction pour enregistrer ou mettre à jour les codes d'activation d'un utilisateur dans MongoDB
async function saveActivationCodes(userId, codes) {
    try {
        await User.updateOne(
            { userId: userId },
            { $push: { activationCodes: { $each: codes } } },
            { upsert: true } // Met à jour si existe, sinon crée
        );
        console.log(`Codes d'activation de l'utilisateur ${userId} mis à jour.`);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des codes d'activation de l'utilisateur :", error);
  }
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
    const messageText = event.message.text ? event.message.text.trim() : '';

    // Vérification du code administrateur en premier
    if (messageText === adminCode) {
      const admin = await isAdmin(senderId);
      if (!admin) {
        await User.updateOne(
          { userId: senderId },
          { userId: senderId, isAdmin: true },
          { upsert: true } // Met à jour si existe, sinon crée
        );
        await sendMessage(senderId, { text: "✅ Vous êtes désormais un administrateur." }, pageAccessToken);
        return;
      }


    // Gestion de la génération de code d'activation pour les admins
       if (admin) {
          const numberOfCodes = 10; // nombre de codes a générer, vous pouvez le modifier
          const codes = Array.from({ length: numberOfCodes }, () => generateActivationCode());
          await saveActivationCodes(senderId, codes)
         await sendMessage(senderId, { text: `✅ ${numberOfCodes} codes d'activation ont été générés avec succès et sont sauvegardés. Codes : \n${codes.join(', ')}` }, pageAccessToken);
          return;
       }
   }

    // Vérification de l'abonnement depuis MongoDB
    const isSubscribed = await isUserSubscribed(senderId);

    if (!isSubscribed) {
       if (messageText) {
           // Demande du code d'activation
          if (!userStates.has(senderId) || !userStates.get(senderId).awaitingSubscription) {
             userStates.set(senderId, { awaitingSubscription: true });
              await sendMessage(senderId, {
                  text:
                    "Pour utiliser nos services, veuillez fournir le code d'activation.\n\nSi vous n'avez pas encore de code d'activation, veuillez vous abonner à RTM Tafitaniana via Facebook ou appeler directement sur WhatsApp +261385858330 ou sur le numéro 0385858330.\n\nL'abonnement coûte 3000 AR pour une validation de 30 jours.",
              }, pageAccessToken);
            return;
         }

            // Gestion du code d'activation
          if (userStates.has(senderId) && userStates.get(senderId).awaitingSubscription) {
              const activationCode = messageText;

              if (await isActivationCodeValid(activationCode)) {
                 // Ajout de la logique d'abonnement réussie
                const now = new Date();
                const expirationDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 jours d'expiration

                  await saveUserSubscription(senderId, expirationDate); // Enregistrer dans MongoDB
                  await User.updateOne({activationCodes: activationCode}, {$pull:{activationCodes: activationCode}})
                 userStates.delete(senderId);

                  await sendMessage(senderId, {
                      text: `Votre abonnement est activé avec succès le ${now.toLocaleString('fr-MG', { timeZone: 'Indian/Antananarivo' })}.\nExpire le ${expirationDate.toLocaleString('fr-MG', { timeZone: 'Indian/Antananarivo' })}.\n\nMerci d'utiliser notre service, nous vous proposons toujours un bon service.`
                    }, pageAccessToken);
                  return;

              } else {
                  await sendMessage(senderId, {
                      text: "Votre code est invalide. Veuillez faire un abonnement pour obtenir un code valide de 30 jours..."
                    }, pageAccessToken);
                 return;
             }

           }
            return;
        }
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

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    // Si l'utilisateur attend une analyse d'image et entre une commande
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const args = messageText.split(' ');
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);

      if (command) {
        userStates.delete(senderId); // Quitter le mode image
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
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          // Ligne supprimée ici pour éviter l'affichage
        }
      } else {
        await sendMessage(senderId, { text: `` }, pageAccessToken);
      }
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si une commande est verrouillée, utiliser la commande verrouillée pour traiter la demande
    if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
      const lockedCommand = userStates.get(senderId).lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance) {
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    } else {
      await sendMessage(senderId, { text: "miarahaba mba ahafahana mampiasa dia. tapez le bouton 'menu' pour continuer ." }, pageAccessToken);
    }
  }
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions ! 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔⏳" }, pageAccessToken);

    let imageAnalysis;
    const lockedCommand = userStates.get(senderId)?.lockedCommand;

    if (lockedCommand && commands.has(lockedCommand)) {
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance && lockedCommandInstance.analyzeImage) {
        imageAnalysis = await lockedCommandInstance.analyzeImage(imageUrl, prompt);
      }
    } else {
      imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);
    }

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
