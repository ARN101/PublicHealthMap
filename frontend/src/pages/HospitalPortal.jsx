import React, { useEffect, useMemo, useState } from 'react';
import { BD_DIVISIONS } from '../lib/constants';
import { authHeaders } from '../lib/session';
import {
  IDENTITY_TYPES,
  cleanDigits,
  identityPlaceholder,
  validateIdentityValue,
  validateNewPatient
} from '../lib/patientValidation';

const emptyPatient = {
  identityType: 'national_id',
  nationalId: '',
  birthCertNo: '',
  fullName: '',
  dob: '',
  gender: 'Male',
  bloodGroup: 'A+',
  contactNumber: '',
  occupation: '',
  streetAddress: '',
  city: '',
  division: 'Dhaka',
  photoUrl: ''
};

function RequiredMark() {
  return (
    <span className="text-red-600 ml-0.5" aria-hidden="true" title="Required">*</span>
  );
}

function FieldLabel({ children, required = false, optional = false }) {
  return (
    <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
      {children}
      {required ? <RequiredMark /> : null}
      {optional ? <span className="normal-case tracking-normal font-medium text-slate-400 ml-1">(optional)</span> : null}
    </label>
  );
}

function DynamicCaseFields({ fields, values, onChange, token }) {
  const [uploadingKey, setUploadingKey] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [previews, setPreviews] = useState({});

  if (!fields.length) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
        No clinical fields are enabled for this disease yet. Ask an administrator to configure the form.
      </div>
    );
  }

  const uploadImage = (fieldKey, file) => {
    if (!file) return;
    setUploadError('');
    setUploadingKey(fieldKey);
    const localPreview = URL.createObjectURL(file);
    const body = new FormData();
    body.append('image', file);
    fetch('/api/uploads/case-image', {
      method: 'POST',
      headers: authHeaders(token, false),
      body
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          URL.revokeObjectURL(localPreview);
          setUploadError(d.error || 'Image upload failed');
          return;
        }
        setPreviews((prev) => {
          if (prev[fieldKey]) URL.revokeObjectURL(prev[fieldKey]);
          return { ...prev, [fieldKey]: localPreview };
        });
        // Stored in Oracle as BLOB via pending upload id
        onChange(fieldKey, d.ref || `pending:${d.uploadId}`);
      })
      .catch(() => {
        URL.revokeObjectURL(localPreview);
        setUploadError('Network error uploading image');
      })
      .finally(() => setUploadingKey(null));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map((f) => (
        <div
          key={f.fieldKey}
          className={f.fieldType === 'textarea' || f.fieldType === 'image' ? 'sm:col-span-2' : ''}
        >
          <FieldLabel
            required={f.fieldType !== 'image' && f.isRequired}
            optional={f.fieldType === 'image'}
          >
            {f.fieldLabel}
          </FieldLabel>
          {f.fieldType === 'select' ? (
            <select
              value={values[f.fieldKey] || ''}
              onChange={(e) => onChange(f.fieldKey, e.target.value)}
              required={f.isRequired}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Select…</option>
              {f.fieldOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : f.fieldType === 'textarea' ? (
            <textarea
              value={values[f.fieldKey] || ''}
              onChange={(e) => onChange(f.fieldKey, e.target.value)}
              required={f.isRequired}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[90px]"
            />
          ) : f.fieldType === 'image' ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => uploadImage(f.fieldKey, e.target.files?.[0])}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
              />
              {uploadingKey === f.fieldKey && (
                <p className="text-[11px] font-mono text-slate-400">Uploading…</p>
              )}
              {(previews[f.fieldKey] || values[f.fieldKey]) && (
                <div className="flex items-start gap-3">
                  {previews[f.fieldKey] ? (
                    <img
                      src={previews[f.fieldKey]}
                      alt="Affected body part"
                      className="h-28 w-28 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <p className="text-[11px] font-mono text-slate-500">Photo staged in database (BLOB).</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (previews[f.fieldKey]) URL.revokeObjectURL(previews[f.fieldKey]);
                      setPreviews((prev) => {
                        const next = { ...prev };
                        delete next[f.fieldKey];
                        return next;
                      });
                      onChange(f.fieldKey, '');
                    }}
                    className="text-[11px] font-bold text-red-600"
                  >
                    Remove photo
                  </button>
                </div>
              )}
              {uploadError && f.fieldKey === 'affected_part_image' && (
                <p className="text-[11px] text-red-600 font-mono">{uploadError}</p>
              )}
            </div>
          ) : (
            <input
              type={f.fieldType === 'date' ? 'date' : f.fieldType === 'number' ? 'number' : 'text'}
              value={values[f.fieldKey] || ''}
              onChange={(e) => onChange(f.fieldKey, e.target.value)}
              required={f.isRequired}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function HospitalPortal({ go, session, persistSession }) {
  const [diseases, setDiseases] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [identityType, setIdentityType] = useState('national_id');
  const [identity, setIdentity] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [patientFound, setPatientFound] = useState(null); // object | false | null
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [diseaseId, setDiseaseId] = useState('');
  const [formFields, setFormFields] = useState([]);
  const [caseValues, setCaseValues] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/diseases')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setDiseases(d.diseases);
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(
    () => [...new Set(diseases.map((d) => d.category).filter(Boolean))].sort(),
    [diseases]
  );
  const subcategories = useMemo(() => {
    const pool = categoryFilter
      ? diseases.filter((d) => d.category === categoryFilter)
      : diseases;
    return [...new Set(pool.map((d) => d.subcategory).filter(Boolean))].sort();
  }, [diseases, categoryFilter]);
  const filteredDiseases = useMemo(() => {
    return diseases.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (subcategoryFilter && d.subcategory !== subcategoryFilter) return false;
      return true;
    });
  }, [diseases, categoryFilter, subcategoryFilter]);

  useEffect(() => {
    if (!diseaseId) {
      setFormFields([]);
      setCaseValues({});
      return;
    }
    fetch(`/api/diseases/${diseaseId}/form`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setFormFields(d.fields);
        const defaults = {};
        d.fields.forEach((f) => {
          if (f.fieldKey === 'diagnosis_date') defaults[f.fieldKey] = new Date().toISOString().split('T')[0];
          else if (f.fieldKey === 'patient_status') defaults[f.fieldKey] = 'Active';
          else defaults[f.fieldKey] = '';
        });
        setCaseValues(defaults);
      })
      .catch(() => setFormFields([]));
  }, [diseaseId]);

  const selectedDisease = useMemo(
    () => diseases.find((d) => String(d.diseaseId) === String(diseaseId)),
    [diseases, diseaseId]
  );

  if (!session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Hospital Portal</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with an approved hospital account to continue.</p>
        <button type="button" onClick={() => go('login')} className="mt-6 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-lg">Go to Sign In</button>
      </div>
    );
  }

  const lookupPatient = (e) => {
    e.preventDefault();
    setLookupError('');
    setSubmitError('');
    setSubmitSuccess('');
    setPatientFound(null);

    const idCheck = validateIdentityValue(identityType, identity);
    if (!idCheck.ok) {
      setLookupError(idCheck.error);
      return;
    }

    setLookupLoading(true);
    const qs = new URLSearchParams({
      identity: idCheck.value,
      identityType
    });

    fetch(`/api/patients/search?${qs.toString()}`, {
      headers: authHeaders(session.token, false)
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setLookupError(data.error || 'Lookup failed');
          if (String(data.error || '').toLowerCase().includes('authentication')) persistSession(null);
          return;
        }
        if (data.found) {
          setPatientFound(data.patient);
          setPatientForm(emptyPatient);
        } else {
          setPatientFound(false);
          setFieldErrors({});
          setPatientForm({
            ...emptyPatient,
            identityType,
            nationalId: identityType === 'national_id' ? idCheck.value : '',
            birthCertNo: identityType === 'birth_cert' ? idCheck.value : ''
          });
        }
      })
      .catch(() => setLookupError('Network error during patient lookup.'))
      .finally(() => setLookupLoading(false));
  };

  const setCaseField = (key, value) => setCaseValues((prev) => ({ ...prev, [key]: value }));

  const submitCase = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    setFieldErrors({});

    const payload = {
      diseaseId: Number(diseaseId),
      caseFields: caseValues
    };

    if (patientFound && patientFound.patientId) {
      payload.patientId = patientFound.patientId;
    } else {
      const check = validateNewPatient(patientForm);
      if (!check.ok) {
        setSubmitError(check.error);
        setFieldErrors({ form: check.error });
        setSubmitting(false);
        return;
      }
      payload.newPatient = check.value;
    }

    fetch('/api/cases/submit', {
      method: 'POST',
      headers: authHeaders(session.token),
      body: JSON.stringify(payload)
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setSubmitError(data.error || 'Case submission failed.');
          return;
        }
        const diseaseName = selectedDisease?.commonName || 'selected disease';
        setSubmitSuccess(
          `Done. Case #${data.caseId} saved for patient #${data.patientId} (${diseaseName}).`
        );
        setDiseaseId('');
        setFormFields([]);
        setCaseValues({});
        setCategoryFilter('');
        setSubcategoryFilter('');
        if (!patientFound) {
          // Refresh as registered patient
          setPatientFound({
            patientId: data.patientId,
            fullName: patientForm.fullName,
            dateOfBirth: patientForm.dob,
            gender: patientForm.gender,
            bloodGroup: patientForm.bloodGroup,
            contactNumber: patientForm.contactNumber,
            city: patientForm.city,
            division: patientForm.division
          });
        }
      })
      .catch(() => setSubmitError('Network error submitting case.'))
      .finally(() => setSubmitting(false));
  };

  const resetLookup = () => {
    setIdentityType('national_id');
    setIdentity('');
    setPatientFound(null);
    setPatientForm(emptyPatient);
    setDiseaseId('');
    setFormFields([]);
    setCaseValues({});
    setSubmitError('');
    setSubmitSuccess('');
    setLookupError('');
    setFieldErrors({});
  };

  const onIdentityInput = (raw) => {
    // Digits only while typing
    setIdentity(raw.replace(/\D/g, ''));
  };

  const updatePatientField = (name, value) => {
    let next = value;
    if (name === 'nationalId' || name === 'birthCertNo' || name === 'contactNumber') {
      next = cleanDigits(value).replace(/\D/g, '');
    }
    setPatientForm((prev) => ({ ...prev, [name]: next }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950">Clinical Case Intake</h1>
          <p className="text-xs font-mono text-slate-500 mt-1">
            {session.hospital.name} · ID {session.hospital.hospitalId}
          </p>
        </div>
        <button type="button" onClick={() => persistSession(null)} className="text-xs font-semibold border border-slate-200 px-3 py-2 rounded-lg">
          Log out
        </button>
      </div>

      {/* Step 1: Patient identity */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-brand mb-2">Step 1 · Identify patient</div>
        <p className="text-sm text-slate-500 mb-4">
          Select which ID you are using, then enter it. Format is checked before search. Existing patients skip demographics.
        </p>
        <form onSubmit={lookupPatient} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {IDENTITY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setIdentityType(t.value);
                  setIdentity('');
                  setLookupError('');
                  setPatientFound(null);
                }}
                className={`text-xs font-bold px-4 py-2 rounded-lg border ${
                  identityType === t.value
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            {IDENTITY_TYPES.find((t) => t.value === identityType)?.hint}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={identity}
              onChange={(e) => onIdentityInput(e.target.value)}
              placeholder={identityPlaceholder(identityType)}
              inputMode="numeric"
              pattern="\d*"
              maxLength={17}
              className="flex-grow border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono"
              required
            />
            <button type="submit" disabled={lookupLoading} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
              {lookupLoading ? 'Checking…' : 'Check patient'}
            </button>
            {patientFound !== null && (
              <button type="button" onClick={resetLookup} className="text-sm font-semibold text-slate-500 px-3">
                Reset
              </button>
            )}
          </div>
          {identity && (
            <div className="text-[11px] font-mono text-slate-400">
              Length: {identity.length}
              {identityType === 'national_id' ? ' (need 11)' : ' (need 17)'}
            </div>
          )}
        </form>
        {lookupError && <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{lookupError}</div>}
      </section>

      {/* Patient result */}
      {patientFound && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-green-700">Registered patient</div>
            <span className="text-[10px] font-mono bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">ID {patientFound.patientId}</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Patient information is already on file — no need to re-enter demographics.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><div className="text-[10px] uppercase text-slate-400">Name</div><div className="font-semibold">{patientFound.fullName}</div></div>
            <div><div className="text-[10px] uppercase text-slate-400">DOB</div><div>{patientFound.dateOfBirth}</div></div>
            <div><div className="text-[10px] uppercase text-slate-400">Gender</div><div>{patientFound.gender}</div></div>
            <div><div className="text-[10px] uppercase text-slate-400">Blood</div><div className="font-mono">{patientFound.bloodGroup}</div></div>
            <div><div className="text-[10px] uppercase text-slate-400">City</div><div>{patientFound.city}</div></div>
            <div><div className="text-[10px] uppercase text-slate-400">Division</div><div>{patientFound.division}</div></div>
          </div>
        </section>
      )}

      {patientFound === false && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">New patient · registration required</div>
          <p className="text-xs text-slate-500 mb-4">
            No match found. The selected ID is locked below — complete the remaining demographics. All fields are validated before save.
          </p>

          <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
            <span className="font-bold text-slate-600">Identity type: </span>
            {patientForm.identityType === 'national_id' ? 'National ID' : 'Birth Certificate Number'}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-mono font-semibold text-slate-800">
              {patientForm.identityType === 'national_id' ? patientForm.nationalId : patientForm.birthCertNo}
            </span>
          </div>

          {fieldErrors.form && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{fieldErrors.form}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Full name</FieldLabel>
              <input
                value={patientForm.fullName}
                onChange={(e) => updatePatientField('fullName', e.target.value)}
                required
                maxLength={150}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Letters only"
              />
            </div>
            <div>
              <FieldLabel required>Date of birth</FieldLabel>
              <input
                type="date"
                value={patientForm.dob}
                onChange={(e) => updatePatientField('dob', e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel required>Contact number (01XXXXXXXXX)</FieldLabel>
              <input
                value={patientForm.contactNumber}
                onChange={(e) => updatePatientField('contactNumber', e.target.value)}
                required
                inputMode="numeric"
                maxLength={11}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="017XXXXXXXX"
              />
            </div>
            <div>
              <FieldLabel optional>Occupation</FieldLabel>
              <input
                value={patientForm.occupation}
                onChange={(e) => updatePatientField('occupation', e.target.value)}
                maxLength={100}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel optional>Street address</FieldLabel>
              <input
                value={patientForm.streetAddress}
                onChange={(e) => updatePatientField('streetAddress', e.target.value)}
                maxLength={255}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel required>City</FieldLabel>
              <input
                value={patientForm.city}
                onChange={(e) => updatePatientField('city', e.target.value)}
                required
                maxLength={100}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <FieldLabel required>Gender</FieldLabel>
              <select value={patientForm.gender} onChange={(e) => updatePatientField('gender', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div>
              <FieldLabel required>Blood group</FieldLabel>
              <select value={patientForm.bloodGroup} onChange={(e) => updatePatientField('bloodGroup', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel required>Division</FieldLabel>
              <select value={patientForm.division} onChange={(e) => updatePatientField('division', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {BD_DIVISIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Step 2: Disease + dynamic form */}
      {patientFound !== null && (
        <form onSubmit={submitCase} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {submitSuccess && (
            <div
              role="status"
              className="p-4 bg-green-50 border border-green-300 text-green-900 rounded-lg"
            >
              <p className="text-sm font-bold">Done</p>
              <p className="text-xs mt-1 font-mono">{submitSuccess}</p>
              <p className="text-xs text-green-700 mt-2">You can select another disease below to log another case for this patient.</p>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-brand mb-2">Step 2 · Disease & clinical form</div>
            <p className="text-xs text-slate-500 mb-4">
              Fields marked with a red <span className="text-red-600 font-bold">*</span> are required. Photo fields are optional.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setSubcategoryFilter('');
                    setDiseaseId('');
                    setSubmitSuccess('');
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">All specialties</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Subcategory</FieldLabel>
                <select
                  value={subcategoryFilter}
                  onChange={(e) => {
                    setSubcategoryFilter(e.target.value);
                    setDiseaseId('');
                    setSubmitSuccess('');
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">All in category</option>
                  {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Disease</FieldLabel>
                <select
                  value={diseaseId}
                  onChange={(e) => {
                    setDiseaseId(e.target.value);
                    setSubmitSuccess('');
                  }}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">Select disease…</option>
                  {filteredDiseases.map((d) => (
                    <option key={d.diseaseId} value={d.diseaseId}>
                      {d.commonName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedDisease && (
              <p className="mt-2 text-[11px] font-mono text-slate-400">
                {selectedDisease.category}
                {selectedDisease.subcategory ? ` · ${selectedDisease.subcategory}` : ''}
                {' · '}{selectedDisease.diseaseCode}
              </p>
            )}
            {selectedDisease?.sampleImageUrl && (
              <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <img
                  src={selectedDisease.sampleImageUrl}
                  alt={selectedDisease.sampleImageCaption || 'Sample affected body part'}
                  className="h-20 w-20 rounded-md object-cover border border-slate-200"
                />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Registry sample</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {selectedDisease.sampleImageCaption || 'Reference photo of a typical affected body part for this disease.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {diseaseId && (
            <>
              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">
                  {selectedDisease ? `${selectedDisease.commonName} case form` : 'Case form'}
                </h3>
                <DynamicCaseFields
                  fields={formFields}
                  values={caseValues}
                  onChange={setCaseField}
                  token={session.token}
                />
              </div>

              {submitError && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{submitError}</div>}

              <button
                type="submit"
                disabled={submitting || !formFields.length}
                className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg"
              >
                {submitting ? 'Saving…' : patientFound ? 'Submit clinical case' : 'Register patient & submit case'}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
