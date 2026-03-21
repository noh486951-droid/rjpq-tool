import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Copy, LogOut, PaintRoller, Check, ClipboardType, User, PictureInPicture } from 'lucide-react'
import { getOrCreateUserId, saveRoomSession, clearRoomSession } from '../utils/user'

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : undefined

// Singleton socket with persistent identity
const socket = io(SOCKET_URL, { autoConnect: true })
const MY_USER_ID = getOrCreateUserId()

const colors = ['orange', 'green', 'blue', 'pink']

const Room = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [roomData, setRoomData] = useState(null)
  const [selectedColor, setSelectedColor] = useState('orange')
  const [occupiedColors, setOccupiedColors] = useState({})
  const [error, setError] = useState('')
  const [pipSupported] = useState(() => 'documentPictureInPicture' in window)
  const [isPiP, setIsPiP] = useState(false)
  const pipWinRef = useRef(null)
  const gridRef = useRef(null)
  const roomDataRef = useRef(null) // keep ref for visibilitychange handler

  // Keep ref in sync
  useEffect(() => { roomDataRef.current = roomData }, [roomData])

  // Join / create room
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const pwdFromUrl = searchParams.get('pwd')

    const doJoin = (rId, pwd) => {
      socket.emit('join_room', { roomId: rId, password: pwd, userId: MY_USER_ID }, (res) => {
        if (res.success) {
          setRoomData(res.room)
          saveRoomSession(rId, pwd)
        } else {
          setError(res.message)
          alert(res.message)
          navigate('/')
        }
      })
    }

    if (roomId === 'new') {
      const password = location.state?.createPassword || '5299'
      socket.emit('create_room', { password, userId: MY_USER_ID }, (res) => {
        if (res.success) {
          setRoomData(res.room)
          setOccupiedColors(res.room.occupiedColors || {})
          if (!res.room.occupiedColors?.orange) {
            socket.emit('claim_color', { roomId: res.roomId, color: 'orange', userId: MY_USER_ID })
          }
          saveRoomSession(res.roomId, res.room.password)
          navigate(`/room/${res.roomId}`, { replace: true, state: { password: res.room.password, isJoined: true } })
        }
      })
    } else {
      const password = location.state?.password || pwdFromUrl || ''
      doJoin(roomId, password)
    }

    socket.on('grid_update', (newGrid) => {
      setRoomData(prev => prev ? { ...prev, grid: newGrid } : null)
    })
    socket.on('color_status_update', (occ) => {
      setOccupiedColors(occ)
    })

    return () => {
      socket.off('grid_update')
      socket.off('color_status_update')
      socket.emit('leave_room', { roomId: roomDataRef.current?.id || roomId, userId: MY_USER_ID })
      clearRoomSession()
    }
  }, [roomId, location.state, navigate])

  // Reconnect on visibility (works for mobile switching back to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect()
        const rd = roomDataRef.current
        if (rd) {
          const searchParams = new URLSearchParams(window.location.search)
          const pwd = location.state?.password || searchParams.get('pwd') || rd.password || ''
          socket.emit('join_room', { roomId: rd.id, password: pwd, userId: MY_USER_ID }, (res) => {
            if (res.success) {
              setRoomData(res.room)
              setOccupiedColors(res.room.occupiedColors || {})
              // Re-claim color
              socket.emit('claim_color', { roomId: rd.id, color: selectedColor, userId: MY_USER_ID })
            }
          })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [location.state, selectedColor])

  // Heartbeat to keep Render awake (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/ping').catch(() => {})
    }, 1000 * 60 * 5)
    return () => clearInterval(interval)
  }, [])

  if (error) return <div className="room-wrapper"><h3 style={{ color: 'white' }}>Error joining room</h3></div>
  if (!roomData) return <div className="room-wrapper"><h3 style={{ color: 'white' }}>載入中...</h3></div>

  const handleColorSelect = (color) => {
    if (occupiedColors[color] && occupiedColors[color] !== MY_USER_ID) {
      alert('這個顏色已經有人在那裡囉！')
      return
    }
    setSelectedColor(color)
    socket.emit('claim_color', { roomId: roomData.id, color, userId: MY_USER_ID })
  }

  const handleCellClick = (row, col) => {
    socket.emit('update_cell', { roomId: roomData.id, row, col, color: selectedColor })
  }

  const handleClearColor = () => {
    socket.emit('clear_color', { roomId: roomData.id, color: selectedColor })
  }

  const handleCopyUnfilled = () => {
    let result = ''
    for (let r = 1; r <= 10; r++) {
      const row = roomData.grid[r]
      const unfilled = []
      row.forEach((cell, idx) => { if (cell === null) unfilled.push(idx + 1) })
      result += unfilled.length > 0 ? unfilled[0] : 'X'
      if (r === 5) result += ' '
    }
    navigator.clipboard.writeText(result)
    alert(`已複製未選格子：${result}\n(這通常是給第四位不在線的人參考用的)`)
  }

  const copyRoomInfo = () => {
    const url = `${window.location.origin}/room/${roomData.id}?pwd=${roomData.password}`
    const text = `邀請您加入羅茱組隊小工具！\n網址: ${url}\n房號: ${roomData.id}\n密碼: ${roomData.password}`
    navigator.clipboard.writeText(text)
    alert('已複製網址、房號與密碼！')
  }

  // --- Document Picture-in-Picture ---
  const handlePiP = async () => {
    if (!pipSupported) return
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 540,
      })
      pipWinRef.current = pipWin

      // Copy all stylesheets into the PiP window
      ;[...document.styleSheets].forEach((sheet) => {
        try {
          const cssRules = [...sheet.cssRules].map((rule) => rule.cssText).join('')
          const style = pipWin.document.createElement('style')
          style.textContent = cssRules
          pipWin.document.head.appendChild(style)
        } catch {
          if (sheet.href) {
            const link = pipWin.document.createElement('link')
            link.rel = 'stylesheet'
            link.href = sheet.href
            pipWin.document.head.appendChild(link)
          }
        }
      })

      // Move the grid into the PiP window
      if (gridRef.current) {
        pipWin.document.body.appendChild(gridRef.current)
      }

      setIsPiP(true)

      pipWin.addEventListener('pagehide', () => {
        // Move grid back when PiP closes
        if (gridRef.current && document.querySelector('.room-container')) {
          document.querySelector('.room-container').appendChild(gridRef.current)
        }
        setIsPiP(false)
        pipWinRef.current = null
      })
    } catch (e) {
      console.error('PiP failed:', e)
    }
  }

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
                className={`color-btn ${selectedColor === c ? 'selected' : ''} ${occupiedColors[c] && occupiedColors[c] !== MY_USER_ID ? 'occupied' : ''}`}
                style={{ backgroundColor: `var(--color-${c})` }}
                onClick={() => handleColorSelect(c)}
              >
                {selectedColor === c && <Check color="white" size={36} />}
                {occupiedColors[c] && occupiedColors[c] !== MY_USER_ID && <User color="rgba(0,0,0,0.4)" size={32} />}
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
          <button className="btn-view" onClick={handleCopyUnfilled} style={{ backgroundColor: '#6c5ce7' }} title="複製未選取格子 (3人團適用)">
            <ClipboardType size={30} />
          </button>
          {pipSupported && (
            <button
              className="btn-view"
              onClick={handlePiP}
              style={{ backgroundColor: isPiP ? '#00b894' : '#0984e3' }}
              title={isPiP ? '已在子母畫面中' : '彈出子母畫面 (置頂)'}
            >
              <PictureInPicture size={30} />
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid-section" ref={gridRef}>
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(row => (
            <div key={row} className="grid-row">
              <span className="row-label">{row}</span>
              {roomData.grid[row].map((cellColor, col) => (
                <button
                  key={col}
                  className="grid-cell"
                  style={{ backgroundColor: cellColor ? `var(--color-${cellColor})` : undefined, color: 'white' }}
                  onClick={() => handleCellClick(row, col)}
                >
                  {col + 1}
                </button>
              ))}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

export default Room
