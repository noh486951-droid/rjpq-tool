// Returns a persistent userId stored in localStorage.
// This survives page refreshes and reconnects, so the server can recognize the same user.
export const getOrCreateUserId = () => {
  let id = localStorage.getItem('rjpq_userId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('rjpq_userId', id)
  }
  return id
}

export const saveRoomSession = (roomId, password) => {
  localStorage.setItem('rjpq_roomId', roomId)
  localStorage.setItem('rjpq_roomPwd', password)
}

export const loadRoomSession = () => ({
  roomId: localStorage.getItem('rjpq_roomId'),
  password: localStorage.getItem('rjpq_roomPwd'),
})

export const clearRoomSession = () => {
  localStorage.removeItem('rjpq_roomId')
  localStorage.removeItem('rjpq_roomPwd')
}
