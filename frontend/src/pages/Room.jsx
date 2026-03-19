import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Copy, LogOut, PaintRoller, Glasses, Check } from 'lucide-react';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : undefined;
const socket = io(SOCKET_URL);

const colors = ['orange', 'green', 'blue', 'pink'];

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [roomData, setRoomData] = useState(null);
    const [selectedColor, setSelectedColor] = useState('orange');
    const [error, setError] = useState('');

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const pwdFromUrl = searchParams.get('pwd');

        if (roomId === 'new') {
            const password = location.state?.createPassword || '5299';
            socket.emit('create_room', { password }, (res) => {
                if (res.success) {
                    setRoomData(res.room);
                    // Update URL silently if possible, but for simplicity we rely on state
                    // It's better to replace the URL to the new room ID
                    navigate(`/room/${res.roomId}`, { replace: true, state: { password: res.room.password, isJoined: true } });
                }
            });
        } else if (!location.state?.isJoined) {
            const password = location.state?.password || pwdFromUrl || '';
            socket.emit('join_room', { roomId, password }, (res) => {
                if (res.success) {
                    setRoomData(res.room);
                } else {
                    setError(res.message);
                    alert(res.message);
                    navigate('/');
                }
            });
        } else {
             // Re-join logic if already redirected from create
             const password = location.state?.password || pwdFromUrl || '';
             socket.emit('join_room', { roomId, password }, (res) => {
                 if (res.success) setRoomData(res.room);
             });
        }

        socket.on('grid_update', (newGrid) => {
            setRoomData(prev => prev ? { ...prev, grid: newGrid } : null);
        });

        return () => {
            socket.off('grid_update');
            socket.emit('leave_room', { roomId: roomData?.id || roomId });
        };
    }, [roomId, location.state, navigate]);

    if (error) return <div className="room-wrapper"><h3 style={{color:'white'}}>Error joining room</h3></div>;
    if (!roomData) return <div className="room-wrapper"><h3 style={{color:'white'}}>載入中...</h3></div>;

    const handleCellClick = (row, col) => {
        socket.emit('update_cell', { roomId: roomData.id, row, col, color: selectedColor });
    };

    const handleClearColor = () => {
        socket.emit('clear_color', { roomId: roomData.id, color: selectedColor });
    };

    const copyRoomInfo = () => {
        const url = `${window.location.origin}/room/${roomData.id}?pwd=${roomData.password}`;
        const text = `邀請您加入羅茱組隊小工具！\n網址: ${url}\n房號: ${roomData.id}\n密碼: ${roomData.password}`;
        navigator.clipboard.writeText(text);
        alert('已複製網址、房號與密碼！');
    };

    return (
        <div className="room-wrapper">
            <div className="room-container">
                
                {/* Header */}
                <div className="room-header">
                    <div className="room-info">
                        <div className="room-details">
                            <span>房號: <strong>{roomData.id}</strong></span>
                            <span>密碼: <strong>{roomData.password}</strong></span>
                        </div>
                    </div>
                    <button className="copy-btn" onClick={copyRoomInfo} title="複製房號密碼">
                        <Copy size={30} />
                    </button>
                    
                    <div className="color-palette">
                        {colors.map(c => (
                            <button 
                                key={c}
                                className={`color-btn ${selectedColor === c ? 'selected' : ''}`}
                                style={{ backgroundColor: `var(--color-${c})` }}
                                onClick={() => setSelectedColor(c)}
                            >
                                {selectedColor === c && <Check color="white" size={36} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="action-row">
                    <button className="btn-leave" onClick={() => navigate('/')} title="退出房間">
                        <LogOut size={30} />
                    </button>
                    <button className="btn-clear" onClick={handleClearColor} title={`清除所有 ${selectedColor} 標記`}>
                        <PaintRoller size={30} />
                    </button>
                    <button className="btn-view" title="檢視切換">
                        <Glasses size={30} />
                    </button>
                </div>

                {/* Grid */}
                <div className="grid-section">
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(row => (
                        <div key={row} className="grid-row">
                            <span className="row-label">{row}</span>
                            {roomData.grid[row].map((cellColor, col) => (
                                <button 
                                    key={col}
                                    className="grid-cell"
                                    style={{ backgroundColor: cellColor ? `var(--color-${cellColor})` : undefined, color: cellColor ? 'transparent' : 'white' }}
                                    onClick={() => handleCellClick(row, col)}
                                >
                                    {col + 1}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

            </div>
            <div className="copyright">Copyright © wuca.cc All Rights Reserved.</div>
        </div>
    );
};

export default Room;
