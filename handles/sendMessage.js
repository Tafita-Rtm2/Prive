const request = require('request');

function sendMessage(senderId, message, pageAccessToken) {
  if (!message || (!message.text && !message.attachment)) {
    console.error('Error: Message must provide valid text or attachment.');
    return;
  }

  const payload = {
    recipient: { id: senderId },
    message: {}
  };

  if (message.text) {
    payload.message.text = message.text;
  }

  if (message.attachment) {
    payload.message.attachment = message.attachment;
  }

  // Ajoute les "Quick Replies" si elles existent dans le message
  if (message.quick_replies) {
    payload.message.quick_replies = message.quick_replies;
  } else {
    // Ajouter le bouton Quick Reply "Menu" si aucun Quick Reply n'est défini
    payload.message.quick_replies = [
      {
        content_type: "text",
        title: "Menu",
        payload: "MENU_PAYLOAD"
      }
    ];
  }

  request({
    url: 'https://graph.facebook.com/v13.0/me/messages',
    qs: { access_token: pageAccessToken },
    method: 'POST',
    json: payload,
  }, (error, response, body) => {
    if (error) {
      console.error('Error sending message:', error);
    } else if (response.body.error) {
      console.error('Error response:', response.body.error);
    } else {
      console.log('Message sent successfully:', body);
    }
  });
}

// Nouvelle fonction pour envoyer une image via une URL
async function sendGeneratedImage(senderId, imageUrl, pageAccessToken) {
  if (!imageUrl) {
    console.error('Error: Image URL is required to send an image.');
    return;
  }

  const payload = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: imageUrl,
          is_reusable: true, // Permet de réutiliser l'image
        }
      }
    }
  };

  request({
    url: 'https://graph.facebook.com/v13.0/me/messages',
    qs: { access_token: pageAccessToken },
    method: 'POST',
    json: payload,
  }, (error, response, body) => {
    if (error) {
      console.error('Error sending image:', error);
    } else if (response.body.error) {
      console.error('Error response:', response.body.error);
    } else {
      console.log('Image sent successfully:', body);
    }
  });
}

module.exports = { sendMessage, sendGeneratedImage };
