/** Canonical clinical case fields admins can enable per disease. */
const FIELD_CATALOG = [
  {
    key: 'diagnosis_date',
    label: 'Diagnosis Date',
    type: 'date',
    options: null,
    mapsTo: 'diagnosis_date'
  },
  {
    key: 'symptoms_list',
    label: 'Symptoms List',
    type: 'textarea',
    options: null,
    mapsTo: 'symptoms_list'
  },
  {
    key: 'severity_at_admission',
    label: 'Severity at Admission',
    type: 'select',
    options: ['Mild', 'Moderate', 'Severe', 'Critical'],
    mapsTo: 'severity_at_admission'
  },
  {
    key: 'diagnosis_method',
    label: 'Diagnosis Method',
    type: 'select',
    options: ['PCR', 'Antigen', 'Clinical', 'Culture', 'Imaging'],
    mapsTo: 'diagnosis_method'
  },
  {
    key: 'patient_status',
    label: 'Patient Status',
    type: 'select',
    options: ['Active', 'Recovered', 'Deceased'],
    mapsTo: 'patient_status'
  },
  {
    key: 'isolation_status',
    label: 'Isolation Status',
    type: 'select',
    options: ['Home Isolation', 'General Ward', 'ICU', 'CCU'],
    mapsTo: 'isolation_status'
  },
  {
    key: 'infection_source',
    label: 'Infection Source',
    type: 'select',
    options: ['Local Transmission', 'Imported', 'Unknown'],
    mapsTo: 'infection_source'
  },
  {
    key: 'co_morbidities',
    label: 'Co-morbidities',
    type: 'textarea',
    options: null,
    mapsTo: 'co_morbidities'
  },
  {
    key: 'travel_history',
    label: 'Travel History',
    type: 'textarea',
    options: null,
    mapsTo: 'travel_history'
  },
  {
    key: 'notes',
    label: 'Clinical Notes',
    type: 'textarea',
    options: null,
    mapsTo: 'notes'
  },
  {
    key: 'affected_part_image',
    label: 'Affected body part (photo)',
    type: 'image',
    options: null,
    mapsTo: 'affected_part_image', // Oracle BLOB (+ mime)
    /** Photos are never mandatory — hospitals may skip when unavailable. */
    alwaysOptional: true
  }
];

module.exports = { FIELD_CATALOG };
