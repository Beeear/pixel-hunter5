const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 静态文件服务 - 直接从根目录提供
app.use(express.static(__dirname));

// 房间管理
const rooms = new Map();

// 生成房间ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 广播给房间内所有玩家（包括自己）
function broadcastToRoom(roomId, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const data = JSON.stringify(message);
    console.log(`[广播到房间 ${roomId}]:`, message.type);
    
    room.players.forEach((player, ws) => {
        if (ws.readyState === 1) {
            ws.send(data);
        }
    });
}

// 发送给特定玩家
function sendTo(ws, message) {
    if (ws.readyState === 1) {
        console.log(`[发送消息]:`, message.type);
        ws.send(JSON.stringify(message));
    }
}

wss.on('connection', (ws) => {
    console.log('✅ 新玩家连接');
    
    let currentRoom = null;
    let playerId = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log(`[收到消息]:`, message.type, message);
            
            switch (message.type) {
                // 创建房间
                case 'create_room': {
                    const roomId = generateRoomId();
                    playerId = 'A';
                    currentRoom = roomId;
                    
                    rooms.set(roomId, {
                        players: new Map([[ws, { id: 'A', ready: false, score: 0, level: 2 }]]),
                        gameStarted: false,
                        gameConfig: {
                            targetLevel: 15,
                            diffStart: 16,
                            diffMin: 1.2
                        }
                    });
                    
                    sendTo(ws, {
                        type: 'room_created',
                        roomId: roomId,
                        playerId: 'A'
                    });
                    console.log(`🏠 房间 ${roomId} 已创建，当前房间数: ${rooms.size}`);
                    break;
                }
                
                // 加入房间
                case 'join_room': {
                    const roomId = message.roomId.toUpperCase();
                    console.log(`🔍 尝试加入房间: ${roomId}`);
                    const room = rooms.get(roomId);
                    
                    if (!room) {
                        console.log(`❌ 房间 ${roomId} 不存在`);
                        sendTo(ws, { type: 'error', message: '房间不存在' });
                        break;
                    }
                    
                    if (room.players.size >= 2) {
                        console.log(`❌ 房间 ${roomId} 已满`);
                        sendTo(ws, { type: 'error', message: '房间已满' });
                        break;
                    }
                    
                    if (room.gameStarted) {
                        console.log(`❌ 房间 ${roomId} 游戏已开始`);
                        sendTo(ws, { type: 'error', message: '游戏已开始' });
                        break;
                    }
                    
                    playerId = 'B';
                    currentRoom = roomId;
                    room.players.set(ws, { id: 'B', ready: false, score: 0, level: 2 });
                    
                    sendTo(ws, {
                        type: 'room_joined',
                        roomId: roomId,
                        playerId: 'B'
                    });
                    
                    // 通知房主有人加入
                    room.players.forEach((player, playerWs) => {
                        if (playerWs !== ws && playerWs.readyState === 1) {
                            playerWs.send(JSON.stringify({
                                type: 'player_joined',
                                playerId: 'B'
                            }));
                        }
                    });
                    
                    console.log(`✅ 玩家B加入房间 ${roomId}，当前人数: ${room.players.size}`);
                    break;
                }
                
                // 玩家准备
                case 'ready': {
                    if (!currentRoom) {
                        console.log('❌ ready: 没有当前房间');
                        break;
                    }
                    const room = rooms.get(currentRoom);
                    if (!room) {
                        console.log('❌ ready: 房间不存在');
                        break;
                    }
                    
                    const player = room.players.get(ws);
                    if (player) {
                        player.ready = true;
                        console.log(`🙋 玩家 ${player.id} 准备好了`);
                        
                        // 通知所有人（包括自己）
                        broadcastToRoom(currentRoom, {
                            type: 'player_ready',
                            playerId: player.id
                        });
                        
                        // 检查是否所有人都准备好了
                        const players = Array.from(room.players.values());
                        const allReady = players.every(p => p.ready);
                        const hasTwo = room.players.size === 2;
                        
                        console.log(`📊 房间状态: 人数=${room.players.size}, 全部准备=${allReady}`);
                        
                        if (allReady && hasTwo) {
                            console.log(`🚀 所有玩家准备完毕，开始倒计时！`);
                            // 开始倒计时
                            broadcastToRoom(currentRoom, { type: 'countdown_start' });
                            
                            // 3秒后开始游戏
                            const roomIdForTimeout = currentRoom;
                            setTimeout(() => {
                                const r = rooms.get(roomIdForTimeout);
                                if (r) {
                                    r.gameStarted = true;
                                    console.log(`🎮 游戏开始！房间: ${roomIdForTimeout}`);
                                    broadcastToRoom(roomIdForTimeout, { type: 'game_start' });
                                }
                            }, 3200);
                        }
                    }
                    break;
                }
                
                // 玩家得分
                case 'score': {
                    if (!currentRoom) break;
                    const room = rooms.get(currentRoom);
                    if (!room || !room.gameStarted) break;
                    
                    const player = room.players.get(ws);
                    if (player) {
                        player.score = message.score;
                        player.level = message.level;
                        
                        // 同步给对手
                        room.players.forEach((p, playerWs) => {
                            if (playerWs !== ws && playerWs.readyState === 1) {
                                playerWs.send(JSON.stringify({
                                    type: 'opponent_score',
                                    playerId: player.id,
                                    score: player.score,
                                    level: player.level
                                }));
                            }
                        });
                        
                        // 检查是否有人达到目标
                        if (player.level > room.gameConfig.targetLevel) {
                            room.gameStarted = false;
                            
                            const scores = {};
                            room.players.forEach((p) => {
                                scores[p.id] = p.score;
                            });
                            
                            console.log(`🏆 游戏结束！胜者: ${player.id}`);
                            broadcastToRoom(currentRoom, {
                                type: 'game_over',
                                winner: player.id,
                                scores: scores
                            });
                        }
                    }
                    break;
                }
                
                // 点击错误
                case 'wrong': {
                    if (!currentRoom) break;
                    const room = rooms.get(currentRoom);
                    if (!room) break;
                    
                    const player = room.players.get(ws);
                    if (player) {
                        room.players.forEach((p, playerWs) => {
                            if (playerWs !== ws && playerWs.readyState === 1) {
                                playerWs.send(JSON.stringify({
                                    type: 'opponent_wrong',
                                    playerId: player.id
                                }));
                            }
                        });
                    }
                    break;
                }
                
                // 重新开始
                case 'restart': {
                    if (!currentRoom) break;
                    const room = rooms.get(currentRoom);
                    if (!room) break;
                    
                    // 重置所有玩家状态
                    room.players.forEach((player) => {
                        player.ready = false;
                        player.score = 0;
                        player.level = 2;
                    });
                    room.gameStarted = false;
                    
                    console.log(`🔄 房间 ${currentRoom} 重置`);
                    broadcastToRoom(currentRoom, { type: 'game_reset' });
                    break;
                }
            }
        } catch (e) {
            console.error('❌ 消息解析错误:', e);
        }
    });

    ws.on('close', () => {
        console.log(`👋 玩家 ${playerId} 断开连接`);
        
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.players.delete(ws);
                
                // 通知其他玩家
                room.players.forEach((p, playerWs) => {
                    if (playerWs.readyState === 1) {
                        playerWs.send(JSON.stringify({
                            type: 'player_left',
                            playerId: playerId
                        }));
                    }
                });
                
                // 如果房间空了，删除房间
                if (room.players.size === 0) {
                    rooms.delete(currentRoom);
                    console.log(`🗑️ 房间 ${currentRoom} 已删除`);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Pixel Hunter 服务器运行在端口 ${PORT}`);
});
