const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');

const app = express();
app.use(bodyParser.json());

// Token de vérification et d'accès
const VERIFY_TOKEN = 'pagebot';
const PAGE_ACCESS_TOKEN = fs.readFileSync('token.txt', 'utf8').trim();

// Route GET pour vérifier le webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403); // Erreur si le token est incorrect
    }
  }
});

// Route POST pour gérer les événements Facebook Messenger
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          handleMessage(event, PAGE_ACCESS_TOKEN); // Gérer les messages
        } else if (event.postback) {
          handlePostback(event, PAGE_ACCESS_TOKEN); // Gérer les postbacks
        }
      });
    });

    return res.status(200).send('EVENT_RECEIVED'); // Confirmer la réception des événements
  } else {
    return res.sendStatus(404); // Erreur si ce n'est pas un événement page
  }
});

// Exporter l'application pour Vercel
module.exports = app;
