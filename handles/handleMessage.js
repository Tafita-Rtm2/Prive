const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`../commands/${file}`);
    commands.set(command.name, command);
}

// Configuration MongoDB
const uri = 'mongodb+srv://niainatafita85:Tafitaniaina1206@malagasybottraduction.km5s6.mongodb.net/?retryWrites=true&w=majority&appName=Malagasybottraduction';

const userSchema = new mongoose.Schema({
    senderId: { type: String, required: true, unique: true },
    name: { type: String },
    subscribed: { type: Boolean, default: false },
    subscriptionDate: { type: Date },
    expiryDate: { type: Date },
});
const User = mongoose.model('User', userSchema);

async function connectDB() {
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ Connexion à MongoDB réussie.');
    } catch (error) {
        console.error('❌ Erreur de connexion à MongoDB :', error.message);
        process.exit(1)
    }
}

connectDB();


// Code de génération de codes d'activation (à adapter selon ton besoin)
function generateActivationCode(baseCode) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return code;
}

const activationBaseCode = '2201018280';

function isCodeValid(code) {
    try{
        const generatedCode = generateActivationCode(activationBaseCode)
        return code === generatedCode;
    }
    catch (error){
        console.log("Error isCodeValid: ", error)
        return false
    }
}

function calculateExpiryDate() {
    const now = new Date();
    now.setDate(now.getDate() + 30); // Ajouter 30 jours
    return now;
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
    const senderId = event.sender.id;
  
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
      // Vérifier si l'utilisateur est abonné
      let user = await User.findOne({ senderId });

        if (!user) {
             user = new User({ senderId, name: 'Utilisateur', subscribed: false });
            await user.save();
        }


        if (messageText.toLowerCase().startsWith('code') ) {
            const code = messageText.split(' ')[1];
            if (isCodeValid(code)) {
                const expiryDate = calculateExpiryDate();
                user.subscribed = true;
                user.subscriptionDate = new Date();
                user.expiryDate = expiryDate;
                await user.save();
                
                const now = new Date();
                const formattedActivationDate = now.toLocaleString('fr-MG', {
                    timeZone: 'Indian/Antananarivo',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                });
                const formattedExpiryDate = expiryDate.toLocaleString('fr-MG', {
                    timeZone: 'Indian/Antananarivo',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                });
               await sendMessage(senderId, { text: `✅ Votre abonnement est activé avec succès le ${formattedActivationDate} . Il expirera le ${formattedExpiryDate}. Merci d'utiliser notre service et on vous propose toujours un bon service.` }, pageAccessToken);
            }
            else {
                 await sendMessage(senderId, { text: `Votre code est invalide. Veuillez faire un abonnement pour obtenir un code valide de 30 jours.` }, pageAccessToken);
            }
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
  
        if (user && user.subscribed) {
            if (user.expiryDate && user.expiryDate < new Date()) {
                 user.subscribed = false;
                await user.save();
                await sendMessage(senderId, { text: `Votre abonnement a expiré. Veuillez utiliser un code d'activation.` }, pageAccessToken);
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
            }
            else {
                await sendMessage(senderId, { text: "miarahaba mba ahafahana mampiasa dia. tapez le bouton 'menu' pour continuer ." }, pageAccessToken);
            }
        }
        else {
            await sendMessage(senderId, { text: "Pour utiliser nos services, veuillez fournir votre code d'activation.\nSi vous n'avez pas encore de code d'activation, veuillez faire un abonnement à RTM Tafitaniana via Facebook ou appeler le directement sur WhatsApp +261385858330 ou sur le numéro 0385858330. Si vous avez fait un abonnement, RTM Tafitaniana vous donne un code d'activation pour 30 jours." }, pageAccessToken);
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
