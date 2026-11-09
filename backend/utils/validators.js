// errorHandler sends err.status, so bad input is a 400, not a server error.
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const normalizePhone = (phone) => {
  return String(phone).replace(/\D/g, '');
};

const validatePhone = (phone) => {
  const normalized = normalizePhone(phone);

  if (normalized.length < 10 || normalized.length > 15) {
    throw badRequest('Invalid phone number');
  }

  return normalized;
};

const validateRole = (role) => {
  if (!['vendor', 'staff'].includes(role)) {
    throw badRequest('Invalid role');
  }
};

module.exports = {
  validatePhone,
  validateRole,
};
