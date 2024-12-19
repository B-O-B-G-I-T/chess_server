const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors()); // Permet les requêtes CORS

////////////////////////////////////////
// Les fonctions
// Fonction pour récupérer les données d'un joueur
async function fetchPlayerData(username) {
    const apiUrl = `https://api.chess.com/pub/player/${username}`;
    const response = await axios.get(apiUrl);
    return {
        id: response.data["@id"],
        url: response.data.url,
        username: response.data.username,
        player_id: response.data.player_id,
        title: response.data.title || "Aucun titre",
        status: response.data.status,
        name: response.data.name || "Nom non spécifié",
        avatar: response.data.avatar || "Aucun avatar disponible",
        location: response.data.location || "Emplacement inconnu",
        country: response.data.country,
        joined: new Date(response.data.joined * 1000).toISOString(),
        last_online: new Date(response.data.last_online * 1000).toISOString(),
        followers: response.data.followers || 0,
        is_streamer: response.data.is_streamer || false,
        verified: response.data.verified || false,
        league: response.data.league || "Pas de ligue",
        streaming_platforms : response.data.streaming_platforms || "Pas de plateforme de streaming",
        // il y est dans la doc mais pas dans le retour de chess 
        // twitch_url: response.data.twitch_url || "Pas de lien Twitch",
        // fide: response.data.fide || "Non classé",
    };
}

// Fonction pour récupérer les archives de jeux d'un joueur
async function fetchPlayerGameArchives(username) {
    const apiUrl = `https://api.chess.com/pub/player/${username}/games/archives`;
    const response = await axios.get(apiUrl);
    return response.data.archives; 
}

// Fonction pour récupérer les jeux d'une archive spécifique
async function fetchGamesFromArchive(archiveUrl) {
    const response = await axios.get(archiveUrl);
    return response.data.games;
}

function calculateHeadToHeadResults(games, username1, username2) {
    const resultCodes = {
        win: ["win"],
        draw: ["repetition", "agreed", "stalemate", "insufficient", "50move", "timevsinsufficient"],
        loss: ["checkmated", "timeout", "resigned", "lose", "abandoned"]
    };
    const countGames = games.length;   
    const results = {
        [username1]: { wins: 0, draws: 0, losses: 0 },
        [username2]: { wins: 0, draws: 0, losses: 0 },
        totalGames: countGames
    };

    games.forEach(game => {
        if (game.white.username.toLowerCase() === username1 && game.black.username.toLowerCase() === username2) {
            const result = game.white.result;
            if (resultCodes.win.includes(result)) {
                results[username1].wins += 1;
                results[username2].losses += 1;
            } else if (resultCodes.draw.includes(result)) {
                results[username1].draws += 1;
                results[username2].draws += 1;
            } else if (resultCodes.loss.includes(result)) {
                results[username1].losses += 1;
                results[username2].wins += 1;
            }
        } else if (game.white.username.toLowerCase() === username2 && game.black.username.toLowerCase() === username1) {
            const result = game.white.result;
            if (resultCodes.win.includes(result)) {
                results[username2].wins += 1;
                results[username1].losses += 1;
            } else if (resultCodes.draw.includes(result)) {
                results[username1].draws += 1;
                results[username2].draws += 1;
            } else if (resultCodes.loss.includes(result)) {
                results[username2].losses += 1;
                results[username1].wins += 1;
            }
        }
    });

    return results;
}

////////////////////////////////////////
// info joueurs

// GET: pour récupérer les informations d'un joueur spécifique
app.get('/api/chess/player/:username', async (req, res) => {
    try {
        const { username } = req.params; 
        const playerData = await fetchPlayerData(username);
        res.json({
            status: "success",
            player: playerData
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des données du joueur :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les informations du joueur"
        });
    }
});

// GET: pour récupérer les informations de deux joueur spécifique
app.get('/api/chess/players/:username1/:username2', async (req, res) => {
    try {
        const { username1, username2 } = req.params; 

        const [playerData1, playerData2] = await Promise.all([
            fetchPlayerData(username1),
            fetchPlayerData(username2)
        ]);

        res.json({
            status: "success",
            players: {
                player1: playerData1,
                player2: playerData2
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des données des joueurs :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les informations des joueurs"
        });
    }
});

////////////////////////////////////////
// code pour les archives des jeux
// GET: pour récupérer les archives de jeux d'un joueur
app.get('/api/chess/player/:username/games/archives', async (req, res) => {
    try {
        const { username } = req.params; 
        const archives = await fetchPlayerGameArchives(username);
        res.json({
            status: "success",
            archives
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des archives des jeux :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les archives des jeux"
        });
    }
});

// GET: Récupere les archives de jeux communes entre deux joueurs et ressort les urls
app.get('/api/chess/players/:username1/:username2/games/archives', async (req, res) => {
    try {
        const { username1, username2 } = req.params; 

        const [archives1, archives2] = await Promise.all([
            fetchPlayerGameArchives(username1),
            fetchPlayerGameArchives(username2)
        ]);
        
        // formatLink: "https://api.chess.com/pub/player/firouzja2003/games/2018/01" => "2018/01"
        const formatLink = link => link.split('/').slice(-2).join('/');
        const commonArchives = archives1.filter(archive1 =>
            archives2.some(archive2 => formatLink(archive1) === formatLink(archive2))
        );
        
        res.json({
            status: "success",
            commonArchives
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des archives communes :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les archives communes"
        });
    }
});

// GET: tous les matches entre deux joueurs les données brut de chess
app.get('/api/chess/players/:username1/:username2/games/matches', async (req, res) => {
    try {
        const { username1, username2 } = req.params;

        // Récupérer les archives des deux joueurs
        const [archives1, archives2] = await Promise.all([
            fetchPlayerGameArchives(username1),
            fetchPlayerGameArchives(username2)
        ]);

        const formatLink = link => link.split('/').slice(-2).join('/');
        const commonArchives = archives1.filter(archive1 =>
            archives2.some(archive2 => formatLink(archive1) === formatLink(archive2))
        );

        let matches = [];

        for (const archive of commonArchives) {
            const games = await fetchGamesFromArchive(archive);
            
            const playerMatches = games.filter(game =>
                (game.white.username.toLowerCase() === username1.toLowerCase() && game.black.username.toLowerCase() === username2.toLowerCase()) 
                ||
                (game.white.username.toLowerCase() === username2.toLowerCase() && game.black.username.toLowerCase() === username1.toLowerCase())
            );
            matches = matches.concat(playerMatches);
        }

        res.json({
            status: "success",
            matches
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des matchs :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les matchs"
        });
    }
});

// GET: les résultats des matchs entre deux joueurs
app.get('/api/chess/players/:username1/:username2/games/results', async (req, res) => {
    try {
        const { username1, username2 } = req.params;

        // Récupérer les archives des deux joueurs
        const [archives1, archives2] = await Promise.all([
            fetchPlayerGameArchives(username1),
            fetchPlayerGameArchives(username2)
        ]);

        const formatLink = link => link.split('/').slice(-2).join('/');
        const commonArchives = archives1.filter(archive1 =>
            archives2.some(archive2 => formatLink(archive1) === formatLink(archive2))
        );

        let matches = [];

        for (const archive of commonArchives) {
            const games = await fetchGamesFromArchive(archive);
            const playerMatches = games.filter(game =>
                (game.white.username.toLowerCase() === username1.toLowerCase() && game.black.username.toLowerCase() === username2.toLowerCase()) 
                ||
                (game.white.username.toLowerCase() === username2.toLowerCase() && game.black.username.toLowerCase() === username1.toLowerCase())
            );
            matches = matches.concat(playerMatches);
        }

        // Calculer les résultats tête-à-tête
        const results = calculateHeadToHeadResults(matches, username1.toLowerCase(), username2.toLowerCase());

        res.json({
            status: "success",
            results
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des résultats tête-à-tête :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les résultats tête-à-tête"
        });
    }
});

////////////////////////////////////////
// l'agrégarion des données

app.get('/api/chess/players/:username1/:username2/comparation', async (req, res) => {
    try {
        const { username1, username2 } = req.params;

        const [playerData1, playerData2] = await Promise.all([
            fetchPlayerData(username1),
            fetchPlayerData(username2)
        ]);

        const [archives1, archives2] = await Promise.all([
            fetchPlayerGameArchives(username1),
            fetchPlayerGameArchives(username2)
        ]);

        const formatLink = link => link.split('/').slice(-2).join('/');
        const commonArchives = archives1.filter(archive1 =>
            archives2.some(archive2 => formatLink(archive1) === formatLink(archive2))
        );

        let matches = [];

        for (const archive of commonArchives) {
            const games = await fetchGamesFromArchive(archive);
            const playerMatches = games.filter(game =>
                (game.white.username.toLowerCase() === username1.toLowerCase() && game.black.username.toLowerCase() === username2.toLowerCase())
                ||
                (game.white.username.toLowerCase() === username2.toLowerCase() && game.black.username.toLowerCase() === username1.toLowerCase())
            );
            matches = matches.concat(playerMatches);
        }

        const results = calculateHeadToHeadResults(matches, username1.toLowerCase(), username2.toLowerCase());

        res.json({
            status: "success",
            players: {
                player1: playerData1,
                player2: playerData2
            },
            results
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des données et résultats :', error.message);
        res.status(500).json({
            status: "error",
            message: "Impossible de récupérer les informations et résultats"
        });
    }
});


app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});