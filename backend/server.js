const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, '../frontend/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

const generateRoomId = () => {
    let id;
    do { id = Math.floor(100000 + Math.random() * 900000).toString(); } while (rooms[id]);
    return id;
};

const createEmptyGrid = () => {
    const grid = {};
    for (let i = 1; i <= 10; i++) {
        // [1, 2, 3, 4] columns
        grid[i] = [null, null, null, null];
    }
    return grid;
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ password }, callback) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            password: password || Math.floor(1000 + Math.random() * 9000).toString(),
            grid: createEmptyGrid()
        };
        socket.join(roomId);
        callback({ success: true, roomId, room: rooms[roomId] });
    });

    socket.on('join_room', ({ roomId, password }, callback) => {
        const room = rooms[roomId];
        if (!room) {
            return callback({ success: false, message: '找不到該房間' });
        }
        if (room.password !== password) {
            return callback({ success: false, message: '房號或密碼錯誤' });
        }
        socket.join(roomId);
        callback({ success: true, room });
    });

    socket.on('leave_room', ({ roomId }) => {
        socket.leave(roomId);
    });

    socket.on('update_cell', ({ roomId, row, col, color }) => {
        if (rooms[roomId]) {
            // Toggle logic or overwrite logic? 
            // In typical RJPQ tools, clicking a marked cell removes it if it's the same color.
            if (rooms[roomId].grid[row][col] === color) {
                rooms[roomId].grid[row][col] = null;
            } else {
                rooms[roomId].grid[row][col] = color;
            }
            io.to(roomId).emit('grid_update', rooms[roomId].grid);
        }
    });

    socket.on('clear_color', ({ roomId, color }) => {
        if (rooms[roomId]) {
            const grid = rooms[roomId].grid;
            let updated = false;
            for (let r = 1; r <= 10; r++) {
                for (let c = 0; c < 4; c++) {
                    if (grid[r][c] === color) {
                        grid[r][c] = null;
                        updated = true;
                    }
                }
            }
            if (updated) {
                io.to(roomId).emit('grid_update', grid);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.IO Server running on port ${PORT}`);
});
