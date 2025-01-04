const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let lobbies = {};

wss.on('connection', (ws) => {
    console.log('New player connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'createLobby':
                const lobbyId = Date.now(); // Simple lobby ID based on timestamp
                lobbies[lobbyId] = { players: {} };
                ws.send(JSON.stringify({ type: 'lobbyCreated', lobbyId }));
                break;

            case 'joinLobby':
                const { lobbyId: joinLobbyId, username } = data;
                if (lobbies[joinLobbyId]) {
                    lobbies[joinLobbyId].players[ws] = { username, position: { x: 0, y: 0 }, finished: false };
                    ws.send(JSON.stringify({ type: 'joinedLobby', players: lobbies[joinLobbyId].players }));
                    broadcast(joinLobbyId, { type: 'playerJoined', username });
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Lobby not found' }));
                }
                break;

            case 'updatePosition':
                const { lobbyId: updateLobbyId, position } = data;
                if (lobbies[updateLobbyId] && lobbies[updateLobbyId].players[ws]) {
                    lobbies[updateLobbyId].players[ws].position = position;
                    broadcast(updateLobbyId, { type: 'positionUpdate', username: lobbies[updateLobbyId].players[ws].username, position });
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'You are not in this lobby or it does not exist.' }));
                }
                break;

            case 'finishGame':
                const { lobbyId: finishLobbyId } = data;
                if (lobbies[finishLobbyId]) {
                    const results = Object.entries(lobbies[finishLobbyId].players).map(([client, player]) => ({
                        username: player.username,
                        position: player.position,
                        finished: player.finished
                    }));
                    broadcast(finishLobbyId, { type: 'gameFinished', results });
                    // Optionally, you can delete the lobby after the game is finished
                    delete lobbies[finishLobbyId];
                }
                break;

            case 'disconnect':
                handleDisconnect(ws);
                break;
        }
    });

    ws.on('close', () => {
        console.log('Player disconnected');
        handleDisconnect(ws);
    });
});

function handleDisconnect(ws) {
    for (const lobby in lobbies) {
        if (lobbies[lobby].players[ws]) {
            const username = lobbies[lobby].players[ws].username; // Store username before deleting
            delete lobbies[lobby].players[ws];
            broadcast(lobby, { type: 'playerLeft', username });
            break;
        }
    }
}

function broadcast(lobbyId, message) {
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && lobbies[lobbyId].players[client]) {
            client.send(JSON.stringify(message));
        }
    }
}

console.log('WebSocket server is running on ws://localhost:8080');