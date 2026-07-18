/**
 * Patient identity & demographics validation (Bangladesh-oriented rules).
 * Used before DB insert so bad data is rejected early.
 */

const BD_DIVISIONS = [
  'Dhaka', 'Chittagong', 'Rajshahi', 'Khulna',
  'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];

const RULES = {
  nationalId: {
    label: 'National ID',
    pattern: /^\d+$/,
    lengths: [11],
    message: 'National ID must be digits only and exactly 11 characters long.'
  },
  birthCert: {
    label: 'Birth Certificate Number',
    pattern: /^\d+$/,
    lengths: [17],
    message: 'Birth Certificate Number must be digits only and exactly 17 characters long.'
  },
  contactNumber: {
    pattern: /^01[3-9]\d{8}$/,
    message: 'Contact number must be a valid BD mobile (11 digits, starting with 013–019).'
  },
  fullName: {
    pattern: /^[A-Za-z][A-Za-z .'-]{1,149}$/,
    message: 'Full name must be 2–150 letters (spaces, apostrophe, hyphen, period allowed).'
  },
  city: {
    pattern: /^[A-Za-z][A-Za-z .'-]{1,99}$/,
    message: 'City must be 2–100 letters (spaces allowed).'
  }
};

function cleanDigits(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function validateIdentityValue(identityType, value) {
  const raw = cleanDigits(value);
  if (!identityType || !['national_id', 'birth_cert'].includes(identityType)) {
    return { ok: false, error: 'Select identity type: National ID or Birth Certificate.' };
  }
  if (!raw) {
    return {
      ok: false,
      error: identityType === 'national_id'
        ? 'National ID is required.'
        : 'Birth Certificate Number is required.'
    };
  }

  const rule = identityType === 'national_id' ? RULES.nationalId : RULES.birthCert;
  if (!rule.pattern.test(raw)) {
    return { ok: false, error: rule.message };
  }
  if (!rule.lengths.includes(raw.length)) {
    return { ok: false, error: rule.message };
  }
  return { ok: true, value: raw, identityType };
}

function validateDob(dob) {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return { ok: false, error: 'Date of birth must be a valid date (YYYY-MM-DD).' };
  }
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'Date of birth is not a valid calendar date.' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d > today) {
    return { ok: false, error: 'Date of birth cannot be in the future.' };
  }
  const ageYears = (today - d) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears > 120) {
    return { ok: false, error: 'Date of birth is unrealistically old (max age 120).' };
  }
  return { ok: true, value: dob };
}

/**
 * Validate full new-patient payload.
 * identityType: 'national_id' | 'birth_cert'
 */
function validateNewPatient(patient = {}) {
  const identityType = patient.identityType;
  const idCheck = validateIdentityValue(
    identityType,
    identityType === 'national_id' ? patient.nationalId : patient.birthCertNo
  );
  if (!idCheck.ok) return idCheck;

  const fullName = String(patient.fullName || '').trim();
  if (!RULES.fullName.pattern.test(fullName)) {
    return { ok: false, error: RULES.fullName.message };
  }

  const dobCheck = validateDob(patient.dob);
  if (!dobCheck.ok) return dobCheck;

  if (!GENDERS.includes(patient.gender)) {
    return { ok: false, error: 'Gender must be Male, Female, or Other.' };
  }
  if (!BLOOD_GROUPS.includes(patient.bloodGroup)) {
    return { ok: false, error: 'Invalid blood group.' };
  }

  const contact = cleanDigits(patient.contactNumber);
  if (!RULES.contactNumber.pattern.test(contact)) {
    return { ok: false, error: RULES.contactNumber.message };
  }

  const city = String(patient.city || '').trim();
  if (!RULES.city.pattern.test(city)) {
    return { ok: false, error: RULES.city.message };
  }

  if (!BD_DIVISIONS.includes(patient.division)) {
    return { ok: false, error: `Division must be one of: ${BD_DIVISIONS.join(', ')}.` };
  }

  const occupation = String(patient.occupation || '').trim();
  if (occupation && occupation.length > 100) {
    return { ok: false, error: 'Occupation must be at most 100 characters.' };
  }

  const streetAddress = String(patient.streetAddress || '').trim();
  if (streetAddress && streetAddress.length > 255) {
    return { ok: false, error: 'Street address must be at most 255 characters.' };
  }

  return {
    ok: true,
    value: {
      identityType,
      nationalId: identityType === 'national_id' ? idCheck.value : null,
      birthCertNo: identityType === 'birth_cert' ? idCheck.value : null,
      fullName,
      dob: dobCheck.value,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup,
      contactNumber: contact,
      occupation: occupation || null,
      streetAddress: streetAddress || null,
      city,
      division: patient.division,
      photoUrl: patient.photoUrl || null
    }
  };
}

module.exports = {
  RULES,
  BD_DIVISIONS,
  BLOOD_GROUPS,
  GENDERS,
  validateIdentityValue,
  validateNewPatient,
  cleanDigits
};
