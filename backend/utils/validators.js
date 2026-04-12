const normalizePhone = (phone) => {
  return phone.replace(/\D/g, '');
};

const validatePhone = (phone) => {
  const normalized = normalizePhone(phone);

  if (normalized.length < 10 || normalized.length > 15) {
    throw new Error('Invalid phone number');
  }

  return normalized;
};

const validateRole = (role) => {
  if (!['vendor', 'staff'].includes(role)) {
    throw new Error('Invalid role');
  }
};

module.exports = {
  validatePhone,
  validateRole,
};