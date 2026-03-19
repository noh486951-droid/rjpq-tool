import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : undefined;
const socket = io(SOCKET_URL);

const Home = () => {
    const [joinRoomId, setJoinRoomId] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        setCreatePassword(Math.floor(1000 + Math.random() * 9000).toString());
    }, []);

    const handleJoin = () => {
        if (!joinRoomId) return alert('請輸入房號');
        // Actually for simplicity, we pass state and connect inside Room component
        // But checking if room exists is better. We'll verify inside Room component or here.
        // Let's just navigate to Room component and pass password via state.
        navigate(`/room/${joinRoomId}`, { state: { password: joinPassword } });
    };

    const handleCreate = () => {
        // Will create room in Room component upon entry, or fetch here via HTTP/Socket?
        // Since we didn't export socket here, it's easier to redirect to `/room/CREATE` and let Room.jsx handle it
        navigate(`/room/new`, { state: { createPassword } });
    };

    return (
        <div className="home-wrapper">
            <div className="glass-container">
                <h2 className="title">
                    羅茱組隊小工具 <span className="version">v3.1</span>
                </h2>
                
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    <input 
                        type="text" 
                        className="input-field" 
                        placeholder="輸入房號" 
                        value={joinRoomId}
                        onChange={e => setJoinRoomId(e.target.value)}
                        style={{marginBottom: 0}}
                    />
                    <input 
                        type="text" 
                        className="input-field" 
                        placeholder="密碼" 
                        value={joinPassword}
                        onChange={e => setJoinPassword(e.target.value)}
                        style={{marginBottom: 0, width: '40%'}}
                    />
                </div>
                <button className="btn-primary" style={{width: '100%'}} onClick={handleJoin}>進入</button>
                
                <div className="divider">或者</div>
                
                <div className="input-row">
                    <input 
                        type="text" 
                        className="input-field" 
                        value={createPassword} 
                        readOnly
                        style={{marginBottom: 0, backgroundColor: '#eee', color: '#333'}}
                    />
                    <button className="btn-primary" onClick={handleCreate}>建立</button>
                </div>

                <div className="footer-links">
                    <span>贊助作者</span>
                    <span>中 ⇆ 英</span>
                    <span>更新內容</span>
                </div>
            </div>
            <div className="copyright">Copyright © wuca.cc All Rights Reserved.</div>
        </div>
    );
};

export default Home;
