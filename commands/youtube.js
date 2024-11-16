const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');

const token = fs.readFileSync('token.txt', 'utf8');

module.exports = {
  name: 'video',
  description: 'Search YouTube video and send video',
  author: 'Tata',

  async execute(senderId, args) {
    const pageAccessToken = token;
    const query = args.join(' ');

    // Validation de la recherche utilisateur
    if (!query.trim()) {
      await sendMessage(senderId, { text: "Veuillez fournir un titre ou des mots-clés pour rechercher une vidéo." }, pageAccessToken);
      return;
    }

    try {
      // Recherche de vidéos YouTube en fonction de l'entrée utilisateur
      const searchResponse = await axios.get(`https://me0xn4hy3i.execute-api.us-east-1.amazonaws.com/staging/api/resolve/resolveYoutubeSearch?search=${encodeURIComponent(query)}`);
      const videos = searchResponse.data.data;

      if (!videos || videos.length === 0) {
        await sendMessage(senderId, { text: "Aucune vidéo trouvée pour votre recherche." }, pageAccessToken);
        return;
      }

      // Prendre la première vidéo trouvée
      const video = videos[0];
      const videoId = video.videoId;

      // Télécharger la vidéo
      const downloadUrl = `https://api-improve-production.up.railway.app/yt/download?url=https://www.youtube.com/watch?v=${videoId}&format=mp4&quality=360`;

      const downloadResponse = await axios.get(downloadUrl);
      const videoUrl = downloadResponse.data.video;

      if (!videoUrl) {
        throw new Error("URL de la vidéo introuvable.");
      }

      // Envoi de la vidéo en message
      await sendMessage(senderId, {
        attachment: {
          type: "video",
          payload: { url: videoUrl }
        }
      }, pageAccessToken);
    } catch (error) {
      console.error('Erreur lors du téléchargement ou de l\'envoi de la vidéo:', error.message);
      await sendMessage(senderId, { text: "Erreur lors du téléchargement ou de l'envoi de la vidéo." }, pageAccessToken);
    }
  }
};
