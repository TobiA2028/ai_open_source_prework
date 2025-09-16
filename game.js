class Avatar {
    constructor(avatarData) {
        this.name = avatarData.name;
        this.frames = avatarData.frames;
        this.loadedImages = {};
        this.loadImages();
    }
    
    loadImages() {
        // Load all avatar frame images
        for (const direction in this.frames) {
            this.loadedImages[direction] = [];
            this.frames[direction].forEach((base64Data, index) => {
                const img = new Image();
                img.onload = () => {
                    this.loadedImages[direction][index] = img;
                };
                img.src = base64Data;
            });
        }
    }
    
    draw(ctx, x, y, facing, animationFrame, isWest = false) {
        const direction = isWest ? 'east' : facing;
        const frame = this.loadedImages[direction]?.[animationFrame];
        
        if (!frame) return;
        
        const avatarSize = 32; // Standard avatar size
        
        ctx.save();
        
        if (isWest) {
            // Flip horizontally for west direction
            ctx.scale(-1, 1);
            ctx.drawImage(frame, -x - avatarSize/2, y - avatarSize/2, avatarSize, avatarSize);
        } else {
            ctx.drawImage(frame, x - avatarSize/2, y - avatarSize/2, avatarSize, avatarSize);
        }
        
        ctx.restore();
    }
}

class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // WebSocket and game state
        this.ws = null;
        this.playerId = null;
        this.players = {};
        this.avatars = {};
        this.viewportX = 0;
        this.viewportY = 0;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateViewport();
            this.render();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.render();
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.ws.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from game server');
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Olutobi'
        };
        
        this.ws.send(JSON.stringify(message));
    }
    
    handleMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.playerId = message.playerId;
                    this.players = message.players;
                    this.avatars = {};
                    
                    // Load avatar data
                    for (const avatarName in message.avatars) {
                        this.avatars[avatarName] = new Avatar(message.avatars[avatarName]);
                    }
                    
                    this.updateViewport();
                    this.render();
                    console.log('Joined game successfully, player ID:', this.playerId);
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                if (message.avatar) {
                    this.avatars[message.avatar.name] = new Avatar(message.avatar);
                }
                this.render();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateViewport();
                this.render();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.render();
                break;
        }
    }
    
    updateViewport() {
        if (!this.playerId || !this.players[this.playerId]) return;
        
        const player = this.players[this.playerId];
        const centerX = player.x;
        const centerY = player.y;
        
        // Center the viewport on the player, but don't go beyond map edges
        this.viewportX = Math.max(0, Math.min(
            this.worldWidth - this.canvas.width,
            centerX - this.canvas.width / 2
        ));
        
        this.viewportY = Math.max(0, Math.min(
            this.worldHeight - this.canvas.height,
            centerY - this.canvas.height / 2
        ));
    }
    
    worldToCanvas(worldX, worldY) {
        return {
            x: worldX - this.viewportX,
            y: worldY - this.viewportY
        };
    }
    
    render() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,  // Source rectangle
            0, 0, this.canvas.width, this.canvas.height  // Destination rectangle
        );
        
        // Draw all players
        for (const playerId in this.players) {
            const player = this.players[playerId];
            const canvasPos = this.worldToCanvas(player.x, player.y);
            
            // Only draw if player is within viewport
            if (canvasPos.x >= -50 && canvasPos.x <= this.canvas.width + 50 &&
                canvasPos.y >= -50 && canvasPos.y <= this.canvas.height + 50) {
                
                this.drawPlayer(player, canvasPos.x, canvasPos.y);
            }
        }
    }
    
    drawPlayer(player, x, y) {
        const avatar = this.avatars[player.avatar];
        if (!avatar) return;
        
        // Draw avatar
        const isWest = player.facing === 'west';
        avatar.draw(this.ctx, x, y, player.facing, player.animationFrame, isWest);
        
        // Draw username label
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const labelY = y - 25; // Position above avatar
        this.ctx.strokeText(player.username, x, labelY);
        this.ctx.fillText(player.username, x, labelY);
        
        this.ctx.restore();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
