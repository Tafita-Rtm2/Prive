const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

// Modules pour la gestion des abonnements
const moment = require('moment-timezone');
const usersFilePath = path.join(__dirname, '../users.json');

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

// Liste des codes d'activation valides
let validActivationCodes = ['2201', '2003', '2424'];

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`../commands/${file}`);
    commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
    const senderId = event.sender.id;

    // Ajouter le message reçu à l'historique de l'utilisateur
    if (!userConversations.has(senderId)) {
        userConversations.set(senderId, []);
    }
    userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

    // Chargement des données utilisateur depuis le fichier
    let usersData = loadUsersData();
    const userData = usersData.users.find(user => user.user_id === senderId);
    const isSubscribed = userData && moment(userData.expiration_date).isAfter(moment());


    // Gestion de l'abonnement
    if (!isSubscribed) {
        // Si l'utilisateur n'est pas abonné ou son abonnement est expiré
        const messageText = event.message.text ? event.message.text.trim() : '';

        if (validActivationCodes.includes(messageText)) {
            // Code d'activation correct
            const expirationDate = moment().tz('Africa/Nairobi').add(30, 'days').format();
            usersData.users.push({ user_id: senderId, expiration_date: expirationDate });
            saveUsersData(usersData);
            await sendMessage(senderId, {
                 text: `✅ Votre abonnement de 30 jours est activé avec succès! 🎉 Votre abonnement est valide jusqu'au ${moment(expirationDate).tz('Africa/Nairobi').format('DD/MM/YYYY HH:mm:ss')} (Heure de Madagascar). 🇲🇬` 
                }, pageAccessToken);
            
            return;

        } else {
             // Pas de code ou code incorrect
             await sendMessage(senderId, {
                  text: `🔒 Pour utiliser nos services, veuillez fournir votre code d'activation. 🔑 Si vous n'avez pas encore de code, abonnez-vous à Rtm Tafitaniaina via Facebook (https://www.facebook.com/rtm.tafitaniaina). Ou contactez-le via WhatsApp sur le numéro +261385858330 ou appelez-le directement. 📞\n\n Si le code fourni est incorrect, le chat enverra un message d'erreur. ❌ Pour obtenir un code correct, veuillez vous abonner !`
                 }, pageAccessToken);
            return;
        }
    }


    // Traitement des images et commandes (si l'utilisateur est abonné)
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
             await sendMessage(senderId, { text: "👋 Miarahaba! Mba ahafahana mampiasa ny serivisy dia, tsindrio ny bokotra 'menu' eo ambany. 🎛️" }, pageAccessToken);
        }
    }
}


// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
    await sendMessage(senderId, { text: "📷 Image reçue! Que voulez-vous que je fasse avec cette image? 🤔 Posez vos questions! 📸 😊" }, pageAccessToken);
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
            const formattedResponse = `📄 Voici la réponse à votre question concernant l'image:\n${imageAnalysis}`;
            const maxMessageLength = 2000;
      
            if (formattedResponse.length > maxMessageLength) {
                const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
                for (const message of messages) {
                    await sendMessage(senderId, { text: message }, pageAccessToken);
                }
             } else {
                 await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
            }
        } else {
            await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
        }

        userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
    } catch (error) {
        console.error('Erreur lors de l\'analyse de l\'image:', error);
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
        console.error('Erreur avec Gemini:', error);
        throw new Error('Erreur lors de l\'analyse avec Gemini');
    }
}


// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
    const chunks = [];
    for (let i = 0; i < message.length; i += chunkSize) {
        chunks.push(message.slice(i, i + chunkSize));
    }
    return chunks;
}

// --- Gestion des utilisateurs ---

// Fonction pour charger les données des utilisateurs depuis le fichier JSON
function loadUsersData() {
    try {
        const data = fs.readFileSync(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si le fichier n'existe pas ou est invalide, retourner un objet vide
        return { users: [] };
    }
}

// Fonction pour sauvegarder les données des utilisateurs dans le fichier JSON
function saveUsersData(usersData) {
    fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2));
}

module.exports = { handleMessage };
