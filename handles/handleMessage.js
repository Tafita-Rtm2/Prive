const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

// Path to the user data file
const USERS_FILE_PATH = path.join(__dirname, 'users.json');

// Stockage des codes d'activation (en mémoire, à adapter pour la persistance)
const activationCodes = new Map();

// --- Helper Functions ---
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [MessageHandler] ${message}`);
}

function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        log(`Error loading users: ${error.message}, using empty object`, 'warn');
        return {}; // Return empty object to avoid breaking if file doesn't exist
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
        log(`Users data saved successfully.`);
    } catch (error) {
        log(`Error saving users: ${error.message}`, 'error');
    }
}

function getUser(senderId) {
    const users = loadUsers();
    return users[senderId];
}

function updateUser(senderId, userData) {
    const users = loadUsers();
    users[senderId] = userData;
    saveUsers(users);
}

function isUserSubscribed(senderId) {
    const user = getUser(senderId);
    if (user && user.subscribed) {
        return user.expiryDate > new Date();
    }
    return false;
}


// --- Command Loading ---
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    try {
        const command = require(`../commands/${file}`);
        commands.set(command.name, command);
        log(`Loaded command: ${command.name}`);
    } catch (error) {
        log(`Failed to load command file ${file}: ${error.message}`, 'error');
    }
}

// --- Activation Code Logic ---
function generateUniqueActivationCode(senderId) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    activationCodes.set(senderId, code);
    return code;
}

function isCodeValid(senderId, code) {
    if (!activationCodes.has(senderId)) {
        return false;
    }
    return activationCodes.get(senderId) === code;
}

function calculateExpiryDate() {
    const now = new Date();
    now.setDate(now.getDate() + 30); // Add 30 days
    return now;
}

// --- Main Message Handler ---
async function handleMessage(event, pageAccessToken) {
    const senderId = event.sender.id;
    log(`Received message from ${senderId}: ${event.message?.text || 'Image'}`);

      // Add message to user's history
      if (!userConversations.has(senderId)) {
         userConversations.set(senderId, []);
    }
    userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });


    try {
        if (event.message.attachments && event.message.attachments[0].type === 'image') {
            const imageUrl = event.message.attachments[0].payload.url;
            await askForImagePrompt(senderId, imageUrl, pageAccessToken);
        } else if (event.message.text) {
            const messageText = event.message.text.trim();

              // "stop" command to exit current mode
              if (messageText.toLowerCase() === 'stop') {
                userStates.delete(senderId);
                await sendMessage(senderId, { text: "🔓 You have left the current mode. Type the 'menu' button to continue ✔." }, pageAccessToken);
                 return;
            }
            let user = getUser(senderId);
            if (!user) {
                  user = { senderId, name: 'User', subscribed: false };
                  updateUser(senderId, user);
            }
              // New command to get activation code
            if (messageText.toLowerCase() === 'obtenir code') {
               const code = generateUniqueActivationCode(senderId);
               await sendMessage(senderId, { text: `Voici votre code d'activation : ${code}` }, pageAccessToken);
                return;
             }
             if (messageText.toLowerCase().startsWith('code')) {
                const code = messageText.split(' ')[1];
                 if (isCodeValid(senderId, code)) {
                      const expiryDate = calculateExpiryDate();
                    user.subscribed = true;
                    user.subscriptionDate = new Date();
                    user.expiryDate = expiryDate;
                      updateUser(senderId, user);
                 
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
                  await sendMessage(senderId, { text: `✅ Votre abonnement est activé avec succès le ${formattedActivationDate}. Il expirera le ${formattedExpiryDate}. Merci d'utiliser notre service et nous vous proposons toujours un excellent service.` }, pageAccessToken);
                  activationCodes.delete(senderId);
                } else {
                    await sendMessage(senderId, { text: `Votre code est invalide. Veuillez utiliser un code d'activation valide.` }, pageAccessToken);
                }
                return;
              }
                if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
                   const args = messageText.split(' ');
                    const commandName = args[0].toLowerCase();
                   const command = commands.get(commandName);

                    if (command) {
                         userStates.delete(senderId); // Exit image mode
                         await sendMessage(senderId, { text: `🔓 Le mode image a été quitté. Exécution de la commande '${commandName}'.` }, pageAccessToken);
                         return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
                   }
                  const { imageUrl } = userStates.get(senderId);
                    await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
                    return;
                }

             if (isUserSubscribed(senderId)) {
                const args = messageText.split(' ');
                 const commandName = args[0].toLowerCase();
                 const command = commands.get(commandName);
            
                    if (command) {
                        if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
                            const previousCommand = userStates.get(senderId).lockedCommand;
                           if (previousCommand !== commandName) {
                            }
                        } else {
                            await sendMessage(senderId, { text: `` }, pageAccessToken);
                        }
                        userStates.set(senderId, { lockedCommand: commandName });
                           return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
                    }
                
                      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
                        const lockedCommand = userStates.get(senderId).lockedCommand;
                        const lockedCommandInstance = commands.get(lockedCommand);
                           if (lockedCommandInstance) {
                              return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
                         }
                    }
                    else {
                        await sendMessage(senderId, { text: "Bonjour, pour utiliser nos services, veuillez taper le bouton 'menu' pour continuer." }, pageAccessToken);
                     }
            } else {
                await sendMessage(senderId, { text: "Pour utiliser nos services, veuillez fournir votre code d'activation.\nSi vous n'avez pas encore de code d'activation, veuillez taper 'obtenir code'." }, pageAccessToken);
              }
           }
    } catch (error) {
        log(`Error handling message from ${senderId}: ${error.message}`, 'error');
    }
}

// --- Image Analysis ---
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
    await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions ! 📸😊." }, pageAccessToken);
}

async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
    try {
        await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Veuillez patienter un instant... 🤔⏳" }, pageAccessToken);

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
      log(`Error during image analysis for ${senderId}: ${error.message}`, 'error');
        await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
    }
}


async function analyzeImageWithGemini(imageUrl, prompt) {
    const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';

    try {
        const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
          return response.data && response.data.answer ? response.data.answer : '';
    } catch (error) {
        log(`Error with Gemini API: ${error.message}`, 'error');
        throw new Error('Error during Gemini analysis');
   }
}

module.exports = { handleMessage };
