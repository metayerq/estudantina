export function createShift(shifts, newShift) {
  return [...shifts, newShift];
}

export function updateShift(shifts, id, updates) {
  return shifts.map(s => s.id === id ? { ...s, ...updates } : s);
}

export function deleteShift(shifts, id) {
  return shifts.filter(s => s.id !== id);
}

export function getShiftById(shifts, id) {
  return shifts.find(s => s.id === id) || null;
}
