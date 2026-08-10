const validIslands = [
  'Agatti', 'Amini', 'Andrott', 'Bitra', 'Chetlat',
  'Kadmat', 'Kalpeni', 'Kavaratti', 'Kiltan', 'Minicoy', 'Other'
];

const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];

const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Validates member registration input data
 */
function validateRegistration(req, res, next) {
  const { full_name, gender, island, contact_number, email, blood_group, designation } = req.body;
  const errors = {};

  // 1. Full Name
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    errors.full_name = 'Full name is required and must be at least 2 characters.';
  }

  // 2. Gender
  if (!gender || !validGenders.includes(gender)) {
    errors.gender = 'Please select a valid gender option.';
  }

  // 3. Island
  if (!island || !validIslands.includes(island)) {
    errors.island = 'Please select a valid Lakshadweep island.';
  }

  // 4. Contact Number
  const cleanPhone = (contact_number || '').replace(/[\s\-\+]/g, '').replace(/^91/, '');
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!contact_number || !phoneRegex.test(cleanPhone)) {
    errors.contact_number = 'Please enter a valid 10-digit Indian mobile number.';
  }

  // 5. Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim().toLowerCase())) {
    errors.email = 'Please enter a valid email address.';
  }

  // 6. Blood Group
  if (!blood_group || !validBloodGroups.includes(blood_group)) {
    errors.blood_group = 'Please select a valid blood group.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors
    });
  }

  // Attach sanitized data to request
  req.sanitizedBody = {
    full_name: full_name.trim(),
    gender,
    island,
    contact_number: cleanPhone,
    email: email.trim().toLowerCase(),
    blood_group,
    designation: (designation || 'Member').trim() || 'Member'
  };

  next();
}

module.exports = {
  validateRegistration,
  validIslands,
  validGenders,
  validBloodGroups
};
