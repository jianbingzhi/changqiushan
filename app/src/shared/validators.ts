const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CHARS = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

export function isValidIdCard(id: string): boolean {
  if (!/^\d{17}[\dX]$/i.test(id)) return false;
  const upper = id.toUpperCase();
  const sum = ID_WEIGHTS.reduce((acc, w, i) => acc + w * parseInt(upper[i], 10), 0);
  return ID_CHECK_CHARS[sum % 11] === upper[17];
}

// 普通车牌: 省字母 + 字母 + 5位(字母/数字)，如 川A12345
// 新能源车牌: 省字母 + 字母 + D/F开头 + 6位(字母/数字)，如 川AD12345
const PLATE_RE = /^[一-龥][A-Z]([A-Z0-9]{5}|[DF][A-Z0-9]{5})$/;

export function isValidPlate(plate: string): boolean {
  return PLATE_RE.test(plate.toUpperCase().replace(/\s/g, ""));
}
