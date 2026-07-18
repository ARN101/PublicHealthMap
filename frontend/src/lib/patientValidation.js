/** Client-side mirror of backend patient identity rules (Bangladesh). */

export const IDENTITY_TYPES = [
  { value: 'national_id', label: 'National ID (NID)', hint: 'Digits only · exactly 11 characters' },
  { value: 'birth_cert', label: 'Birth Certificate Number', hint: 'Digits only · exactly 17 characters' }
];

export function cleanDigits(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

export function validateIdentityValue(identityType, value) {
  const raw = cleanDigits(value);
  if (!identityType) {
    return { ok: false, error: 'Select whether this is a National ID or Birth Certificate Number.' };
  }
  if (!raw) {
    return {
      ok: false,
      error: identityType === 'national_id'
        ? 'National ID is required.'
        : 'Birth Certificate Number is required.'
    };
  }
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      error: identityType === 'national_id'
        ? 'National ID must contain digits only (no letters or symbols).'
        : 'Birth Certificate Number must contain digits only (no letters or symbols).'
    };
  }
  if (identityType === 'national_id' && raw.length !== 11) {
    return { ok: false, error: `National ID must be exactly 11 digits (currently ${raw.length}).` };
  }
  if (identityType === 'birth_cert' && raw.length !== 17) {
    return { ok: false, error: `Birth Certificate Number must be exactly 17 digits (currently ${raw.length}).` };
  }
  return { ok: true, value: raw };
}

export function validateNewPatient(patient) {
  const idCheck = validateIdentityValue(
    patient.identityType,
    patient.identityType === 'national_id' ? patient.nationalId : patient.birthCertNo
  );
  if (!idCheck.ok) return idCheck;

  const fullName = String(patient.fullName || '').trim();
  if (!/^[A-Za-z][A-Za-z .'-]{1,149}$/.test(fullName)) {
    return { ok: false, error: 'Full name must be 2–150 letters (spaces, apostrophe, hyphen, period allowed).' };
  }

  if (!patient.dob || !/^\d{4}-\d{2}-\d{2}$/.test(patient.dob)) {
    return { ok: false, error: 'Date of birth is required (YYYY-MM-DD).' };
  }
  const d = new Date(`${patient.dob}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime()) || d > today) {
    return { ok: false, error: 'Date of birth must be a valid past date.' };
  }

  const contact = cleanDigits(patient.contactNumber);
  if (!/^01[3-9]\d{8}$/.test(contact)) {
    return { ok: false, error: 'Contact number must be a valid BD mobile (11 digits, 013–019…).' };
  }

  const city = String(patient.city || '').trim();
  if (!/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(city)) {
    return { ok: false, error: 'City must be 2–100 letters.' };
  }

  if (!patient.division) {
    return { ok: false, error: 'Division is required.' };
  }

  return {
    ok: true,
    value: {
      ...patient,
      nationalId: patient.identityType === 'national_id' ? idCheck.value : '',
      birthCertNo: patient.identityType === 'birth_cert' ? idCheck.value : '',
      fullName,
      contactNumber: contact,
      city
    }
  };
}

export function identityMaxLength(identityType) {
  return identityType === 'birth_cert' ? 17 : 11;
}

export function identityPlaceholder(identityType) {
  if (identityType === 'national_id') return 'e.g. 12345678901';
  if (identityType === 'birth_cert') return 'e.g. 19901234567890123';
  return 'Select ID type first';
}
