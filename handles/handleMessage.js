const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map();
const userConversations = new Map();

// Path to the user data file
const USERS_FILE_PATH = path.join(__dirname, 'users.json');

// Function to load users from the JSON file
function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist or is invalid JSON, return an empty object
        return {};
    }
}
  
// Function to save users to the JSON file
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

// Function to get a user by senderId
function getUser(senderId) {
    const users = loadUsers();
    return users[senderId];
}

// Function to create or update a user
function updateUser(senderId, userData) {
    const users = loadUsers();
    users[senderId] = userData;
    saveUsers(users);
}

// Function to check if a user is subscribed
function isUserSubscribed(senderId) {
    const user = getUser(senderId);
    if (user && user.subscribed) {
        return user.expiryDate > new Date();
    }
    return false;
}

// Load commands
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Code de génération de codes d'activation
function generateActivationCode(baseCode) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return code;
}
const activationBaseCode = '2201018280';
function isCodeValid(code) {
    try {
        const generatedCode = generateActivationCode(activationBaseCode)
        return code === generatedCode;
    }
    catch (error) {
        console.log("Error isCodeValid: ", error)
        return false
    }
}
function calculateExpiryDate() {
    const now = new Date();
    now.setDate(now.getDate() + 30); // Add 30 days
    return now;
}

// Main function to handle messages
async function handleMessage(event, pageAccessToken) {
    const senderId = event.sender.id;

    // Add message to user's history
    if (!userConversations.has(senderId)) {
        userConversations.set(senderId, []);
    }
    userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

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
    
        if (messageText.toLowerCase().startsWith('code')) {
            const code = messageText.split(' ')[1];
            if (isCodeValid(code)) {
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
            await sendMessage(senderId, { text: `✅ Your subscription has been successfully activated on ${formattedActivationDate}. It will expire on ${formattedExpiryDate}. Thank you for using our service, and we always offer you excellent service.` }, pageAccessToken);
            } else {
                await sendMessage(senderId, { text: `Your code is invalid. Please subscribe to get a valid 30-day code.` }, pageAccessToken);
            }
            return;
        }
  
        // If user waits for an image analysis
        if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
            const args = messageText.split(' ');
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName);
  
            if (command) {
                userStates.delete(senderId); // Exit image mode
                await sendMessage(senderId, { text: `🔓 Image mode has been exited. Executing command '${commandName}'.` }, pageAccessToken);
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
                            // removed display
                     }
                } else {
                    await sendMessage(senderId, { text: `` }, pageAccessToken);
                }
               userStates.set(senderId, { lockedCommand: commandName });
                return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
            }
           
        // If a command is locked, use it for processing the request
          if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
                const lockedCommand = userStates.get(senderId).lockedCommand;
                const lockedCommandInstance = commands.get(lockedCommand);
                if (lockedCommandInstance) {
                     return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
                  }
            }
            else {
                await sendMessage(senderId, { text: "Hello, to use our service, please type the 'menu' button to continue." }, pageAccessToken);
            }
       } else {
            await sendMessage(senderId, { text: "To use our services, please provide your activation code.\nIf you do not yet have an activation code, please subscribe to RTM Tafitaniana via Facebook or call him directly on WhatsApp +261385858330 or on the number 0385858330. If you have subscribed, RTM Tafitaniana will give you a 30-day activation code." }, pageAccessToken);
        }
    }
}

// Ask for user prompt for image analysis
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image received. What do you want me to do with this image? Ask all your questions! 📸😊." }, pageAccessToken);
}

// Function to analyze the image with the user prompt
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
      await sendMessage(senderId, { text: "🔍 I'm processing your request regarding the image. Please wait a moment... 🤔⏳" }, pageAccessToken);

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
         await sendMessage(senderId, { text: `📄 Here's the answer to your question regarding the image:\n${imageAnalysis}` }, pageAccessToken);
      } else {
        await sendMessage(senderId, { text: "❌ No usable information was detected in this image." }, pageAccessToken);
      }
      userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  } catch (error) {
     console.error('Error during image analysis:', error);
      await sendMessage(senderId, { text: "⚠️ An error occurred while analyzing the image." }, pageAccessToken);
  }
}

// Function to call Gemini API to analyze an image
async function analyzeImageWithGemini(imageUrl, prompt) {
    const geminiApiEndpoint = 'https://sandipbaruwal.onrender.com/gemini2';

    try {
        const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`);
        return response.data && response.data.answer ? response.data.answer : '';
    } catch (error) {
      console.error('Error with Gemini:', error);
      throw new Error('Error during Gemini analysis');
   }
}
  

module.exports = { handleMessage };
