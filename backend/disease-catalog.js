/**
 * Canonical disease registry for the central critical-disease database.
 * category  = specialty / broad filter (e.g. Neurology)
 * subcategory = more specific group (e.g. Brain Cancer)
 */

const TRANSMISSION_MODES = [
  'Airborne',
  'Waterborne',
  'Vector',
  'Contact',
  'Zoonotic',
  'Non-communicable',
  'Genetic',
  'Lifestyle',
  'Idiopathic'
];

const DISEASE_CATEGORIES = [
  'Infectious',
  'Oncology',
  'Hematology',
  'Cardiology',
  'Neurology',
  'Hepatology',
  'Nephrology',
  'Pulmonology',
  'Endocrinology',
  'Gastroenterology',
  'Rheumatology'
];

/** Fields typically enabled for infectious / epidemic diseases */
const INFECTIOUS_FORM_KEYS = [
  'diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method',
  'patient_status', 'isolation_status', 'infection_source', 'co_morbidities',
  'travel_history', 'notes'
];

/** Fields typically enabled for chronic / non-communicable diseases */
const CHRONIC_FORM_KEYS = [
  'diagnosis_date', 'symptoms_list', 'severity_at_admission', 'diagnosis_method',
  'patient_status', 'co_morbidities', 'notes'
];

/**
 * Diseases where an affected body-part photo is clinically useful
 * (visible lesion, joint, rash, edema, neck/oral mass, diabetic foot, etc.).
 */
const BODY_PART_IMAGE_DISEASE_CODES = [
  'ORAL_CANCER',
  'BREAST_CANCER',
  'THYROID_CA',
  'RA',
  'GOUT',
  'SLE',
  'NEPHROTIC',
  'DM_TYPE1',
  'DM_TYPE2',
  'DENGUE'
];

const ENRICHED_DISEASES = [
  // --- Infectious (existing + Bangladesh-relevant) ---
  { code: 'COVID19', name: 'COVID-19', sci: 'SARS-CoV-2', severity: 'Severe', transmission: 'Airborne',
    category: 'Infectious', subcategory: 'Respiratory Infection',
    desc: 'Viral respiratory disease with epidemic potential.' },
  { code: 'DENGUE', name: 'Dengue Fever', sci: 'Dengue virus', severity: 'Severe', transmission: 'Vector',
    category: 'Infectious', subcategory: 'Vector-borne',
    desc: 'Mosquito-borne viral disease common in Bangladesh.' },
  { code: 'CHOLERA', name: 'Cholera', sci: 'Vibrio cholerae', severity: 'Severe', transmission: 'Waterborne',
    category: 'Infectious', subcategory: 'Waterborne Infection',
    desc: 'Acute diarrheal disease causing rapid dehydration.' },
  { code: 'TB', name: 'Tuberculosis', sci: 'Mycobacterium tuberculosis', severity: 'Severe', transmission: 'Airborne',
    category: 'Infectious', subcategory: 'Respiratory Infection',
    desc: 'Chronic infectious lung disease.' },
  { code: 'MALARIA', name: 'Malaria', sci: 'Plasmodium spp.', severity: 'Severe', transmission: 'Vector',
    category: 'Infectious', subcategory: 'Vector-borne',
    desc: 'Parasitic infection transmitted by Anopheles mosquitoes.' },
  { code: 'HEPATITIS_B', name: 'Hepatitis B', sci: 'Hepatitis B virus', severity: 'Severe', transmission: 'Contact',
    category: 'Infectious', subcategory: 'Viral Hepatitis',
    desc: 'Blood-borne viral hepatitis with chronic liver risk.' },
  { code: 'HEPATITIS_C', name: 'Hepatitis C', sci: 'Hepatitis C virus', severity: 'Severe', transmission: 'Contact',
    category: 'Infectious', subcategory: 'Viral Hepatitis',
    desc: 'Blood-borne viral hepatitis; major cause of cirrhosis.' },
  { code: 'TYPHOID', name: 'Typhoid Fever', sci: 'Salmonella Typhi', severity: 'Moderate', transmission: 'Waterborne',
    category: 'Infectious', subcategory: 'Waterborne Infection',
    desc: 'Systemic bacterial infection from contaminated food or water.' },
  { code: 'HIV', name: 'HIV / AIDS', sci: 'Human immunodeficiency virus', severity: 'Severe', transmission: 'Contact',
    category: 'Infectious', subcategory: 'Blood-borne Infection',
    desc: 'Chronic viral infection affecting immune system.' },

  // --- Oncology ---
  { code: 'BRAIN_CANCER', name: 'Brain Cancer', sci: 'Primary CNS malignancy', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Brain Cancer',
    desc: 'Malignant tumor of the brain or central nervous system.' },
  { code: 'LUNG_CANCER', name: 'Lung Cancer', sci: 'Pulmonary carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Lung Cancer',
    desc: 'Malignant neoplasm of the lung; often tobacco-related.' },
  { code: 'BLOOD_CANCER', name: 'Blood Cancer (Leukemia)', sci: 'Leukemia', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Blood Cancer',
    desc: 'Malignancy of blood-forming tissues (leukemia spectrum).' },
  { code: 'LYMPHOMA', name: 'Lymphoma', sci: 'Lymphoid malignancy', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Blood Cancer',
    desc: 'Cancer of the lymphatic system.' },
  { code: 'BREAST_CANCER', name: 'Breast Cancer', sci: 'Breast carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Breast Cancer',
    desc: 'Malignant tumor of breast tissue.' },
  { code: 'CERVICAL_CANCER', name: 'Cervical Cancer', sci: 'Cervical carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Gynecologic Cancer',
    desc: 'Cancer of the cervix; often HPV-associated.' },
  { code: 'COLORECTAL_CA', name: 'Colorectal Cancer', sci: 'Colorectal carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'GI Cancer',
    desc: 'Malignancy of colon or rectum.' },
  { code: 'LIVER_CANCER', name: 'Liver Cancer', sci: 'Hepatocellular carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Liver Cancer',
    desc: 'Primary liver malignancy; linked to hepatitis and cirrhosis.' },
  { code: 'ORAL_CANCER', name: 'Oral / Mouth Cancer', sci: 'Oral squamous cell carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Head & Neck Cancer',
    desc: 'Common in betel-nut chewing regions of South Asia.' },
  { code: 'STOMACH_CANCER', name: 'Stomach Cancer', sci: 'Gastric carcinoma', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'GI Cancer',
    desc: 'Malignant tumor of the stomach.' },

  // --- Hematology ---
  { code: 'THALASSEMIA', name: 'Thalassemia', sci: 'Thalassemia syndrome', severity: 'Severe', transmission: 'Genetic',
    category: 'Hematology', subcategory: 'Thalassemia',
    desc: 'Inherited blood disorder with defective hemoglobin production.' },
  { code: 'SICKLE_CELL', name: 'Sickle Cell Disease', sci: 'Sickle cell anemia', severity: 'Severe', transmission: 'Genetic',
    category: 'Hematology', subcategory: 'Hemoglobinopathy',
    desc: 'Inherited disorder causing sickle-shaped red blood cells.' },
  { code: 'HEMOPHILIA', name: 'Hemophilia', sci: 'Factor VIII/IX deficiency', severity: 'Severe', transmission: 'Genetic',
    category: 'Hematology', subcategory: 'Bleeding Disorder',
    desc: 'Inherited clotting factor deficiency.' },
  { code: 'APLASTIC_ANEMIA', name: 'Aplastic Anemia', sci: 'Bone marrow failure', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Hematology', subcategory: 'Bone Marrow Failure',
    desc: 'Failure of bone marrow to produce blood cells.' },

  // --- Cardiology ---
  { code: 'CAD', name: 'Coronary Artery Disease', sci: 'Ischaemic heart disease', severity: 'Severe', transmission: 'Lifestyle',
    category: 'Cardiology', subcategory: 'Ischaemic Heart Disease',
    desc: 'Narrowing of coronary arteries causing angina or infarction.' },
  { code: 'HEART_FAILURE', name: 'Heart Failure', sci: 'Congestive heart failure', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Cardiology', subcategory: 'Heart Failure',
    desc: 'Inability of the heart to pump adequately.' },
  { code: 'MI', name: 'Myocardial Infarction', sci: 'Acute myocardial infarction', severity: 'Severe', transmission: 'Lifestyle',
    category: 'Cardiology', subcategory: 'Ischaemic Heart Disease',
    desc: 'Heart attack due to coronary occlusion.' },
  { code: 'RHD', name: 'Rheumatic Heart Disease', sci: 'Rheumatic valvular disease', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Cardiology', subcategory: 'Valvular Disease',
    desc: 'Valvular damage following rheumatic fever; still common in BD.' },
  { code: 'ARRHYTHMIA', name: 'Cardiac Arrhythmia', sci: 'Cardiac rhythm disorder', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Cardiology', subcategory: 'Arrhythmia',
    desc: 'Abnormal heart rhythm including AF and VT.' },
  { code: 'HTN_CRISIS', name: 'Hypertensive Crisis', sci: 'Malignant hypertension', severity: 'Severe', transmission: 'Lifestyle',
    category: 'Cardiology', subcategory: 'Hypertension',
    desc: 'Severe elevation of blood pressure with organ risk.' },

  // --- Neurology ---
  { code: 'STROKE', name: 'Stroke (CVA)', sci: 'Cerebrovascular accident', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Neurology', subcategory: 'Cerebrovascular',
    desc: 'Sudden neurological deficit from brain infarction or hemorrhage.' },
  { code: 'EPILEPSY', name: 'Epilepsy', sci: 'Epileptic seizure disorder', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Neurology', subcategory: 'Seizure Disorder',
    desc: 'Recurrent unprovoked seizures.' },
  { code: 'PARKINSON', name: "Parkinson's Disease", sci: 'Parkinson disease', severity: 'Moderate', transmission: 'Non-communicable',
    category: 'Neurology', subcategory: 'Movement Disorder',
    desc: 'Progressive neurodegenerative movement disorder.' },
  { code: 'MENINGITIS', name: 'Meningitis', sci: 'Meningeal infection/inflammation', severity: 'Severe', transmission: 'Contact',
    category: 'Neurology', subcategory: 'CNS Infection',
    desc: 'Inflammation of meninges; infectious or aseptic.' },
  { code: 'MS', name: 'Multiple Sclerosis', sci: 'Multiple sclerosis', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Neurology', subcategory: 'Demyelinating Disease',
    desc: 'Autoimmune demyelinating disease of the CNS.' },
  { code: 'ALZHEIMER', name: "Alzheimer's Disease", sci: 'Alzheimer disease', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Neurology', subcategory: 'Dementia',
    desc: 'Progressive neurodegenerative dementia.' },
  { code: 'BRAIN_TUMOR_BN', name: 'Benign Brain Tumor', sci: 'Benign intracranial neoplasm', severity: 'Moderate', transmission: 'Non-communicable',
    category: 'Neurology', subcategory: 'Brain Tumor',
    desc: 'Non-malignant intracranial mass requiring neurology care.' },

  // --- Hepatology ---
  { code: 'CIRRHOSIS', name: 'Liver Cirrhosis', sci: 'Hepatic cirrhosis', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Hepatology', subcategory: 'Chronic Liver Disease',
    desc: 'End-stage scarring of the liver.' },
  { code: 'NAFLD', name: 'Fatty Liver Disease (NAFLD)', sci: 'Non-alcoholic fatty liver disease', severity: 'Moderate', transmission: 'Lifestyle',
    category: 'Hepatology', subcategory: 'Fatty Liver',
    desc: 'Fat accumulation in liver unrelated to heavy alcohol use.' },
  { code: 'ACUTE_LIVER_FAIL', name: 'Acute Liver Failure', sci: 'Fulminant hepatic failure', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Hepatology', subcategory: 'Acute Liver Failure',
    desc: 'Rapid loss of liver function in a previously healthy person.' },
  { code: 'ALCOHOLIC_LIVER', name: 'Alcoholic Liver Disease', sci: 'Alcohol-related liver disease', severity: 'Severe', transmission: 'Lifestyle',
    category: 'Hepatology', subcategory: 'Chronic Liver Disease',
    desc: 'Liver injury from chronic alcohol use.' },

  // --- Nephrology ---
  { code: 'CKD', name: 'Chronic Kidney Disease', sci: 'Chronic kidney disease', severity: 'Severe', transmission: 'Non-communicable',
    category: 'Nephrology', subcategory: 'Chronic Kidney Disease',
    desc: 'Progressive loss of kidney function.' },
  { code: 'AKI', name: 'Acute Kidney Injury', sci: 'Acute kidney injury', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Nephrology', subcategory: 'Acute Kidney Injury',
    desc: 'Sudden decline in kidney function.' },
  { code: 'NEPHROTIC', name: 'Nephrotic Syndrome', sci: 'Nephrotic syndrome', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Nephrology', subcategory: 'Glomerular Disease',
    desc: 'Kidney disorder with heavy proteinuria and edema.' },

  // --- Pulmonology ---
  { code: 'COPD', name: 'COPD', sci: 'Chronic obstructive pulmonary disease', severity: 'Severe', transmission: 'Lifestyle',
    category: 'Pulmonology', subcategory: 'Obstructive Lung Disease',
    desc: 'Progressive airflow limitation, often smoking-related.' },
  { code: 'ASTHMA', name: 'Asthma', sci: 'Bronchial asthma', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Pulmonology', subcategory: 'Obstructive Lung Disease',
    desc: 'Reversible airway obstruction with hyper-responsiveness.' },
  { code: 'ILD', name: 'Interstitial Lung Disease', sci: 'Interstitial lung disease', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Pulmonology', subcategory: 'Interstitial Disease',
    desc: 'Group of disorders causing lung scarring.' },
  { code: 'PNEUMONIA', name: 'Pneumonia', sci: 'Community/hospital pneumonia', severity: 'Severe', transmission: 'Airborne',
    category: 'Pulmonology', subcategory: 'Lung Infection',
    desc: 'Infection of lung parenchyma.' },

  // --- Endocrinology ---
  { code: 'DM_TYPE1', name: 'Diabetes Mellitus Type 1', sci: 'Type 1 diabetes mellitus', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Endocrinology', subcategory: 'Diabetes',
    desc: 'Autoimmune insulin deficiency.' },
  { code: 'DM_TYPE2', name: 'Diabetes Mellitus Type 2', sci: 'Type 2 diabetes mellitus', severity: 'Severe', transmission: 'Lifestyle',
    category: 'Endocrinology', subcategory: 'Diabetes',
    desc: 'Insulin resistance with relative insulin deficiency.' },
  { code: 'THYROID_CA', name: 'Thyroid Cancer', sci: 'Thyroid carcinoma', severity: 'Moderate', transmission: 'Non-communicable',
    category: 'Oncology', subcategory: 'Thyroid Cancer',
    desc: 'Malignancy of the thyroid gland.' },
  { code: 'HYPERTHYROID', name: 'Hyperthyroidism', sci: 'Thyrotoxicosis', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Endocrinology', subcategory: 'Thyroid Disorder',
    desc: 'Excess thyroid hormone production.' },
  { code: 'HYPOTHYROID', name: 'Hypothyroidism', sci: 'Thyroid hormone deficiency', severity: 'Mild', transmission: 'Idiopathic',
    category: 'Endocrinology', subcategory: 'Thyroid Disorder',
    desc: 'Underactive thyroid gland.' },

  // --- Gastroenterology ---
  { code: 'PUD', name: 'Peptic Ulcer Disease', sci: 'Peptic ulcer', severity: 'Moderate', transmission: 'Non-communicable',
    category: 'Gastroenterology', subcategory: 'Acid-peptic Disease',
    desc: 'Ulceration of stomach or duodenum.' },
  { code: 'IBD', name: 'Inflammatory Bowel Disease', sci: 'IBD (UC/Crohn)', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Gastroenterology', subcategory: 'IBD',
    desc: 'Chronic inflammation of the intestinal tract.' },
  { code: 'PANCREATITIS', name: 'Acute Pancreatitis', sci: 'Acute pancreatitis', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Gastroenterology', subcategory: 'Pancreatic Disease',
    desc: 'Acute inflammation of the pancreas.' },

  // --- Rheumatology ---
  { code: 'RA', name: 'Rheumatoid Arthritis', sci: 'Rheumatoid arthritis', severity: 'Moderate', transmission: 'Idiopathic',
    category: 'Rheumatology', subcategory: 'Inflammatory Arthritis',
    desc: 'Autoimmune inflammatory joint disease.' },
  { code: 'SLE', name: 'Systemic Lupus Erythematosus', sci: 'SLE', severity: 'Severe', transmission: 'Idiopathic',
    category: 'Rheumatology', subcategory: 'Connective Tissue Disease',
    desc: 'Multisystem autoimmune disease.' },
  { code: 'GOUT', name: 'Gout', sci: 'Gouty arthritis', severity: 'Moderate', transmission: 'Lifestyle',
    category: 'Rheumatology', subcategory: 'Crystal Arthropathy',
    desc: 'Crystal-induced arthritis from uric acid.' }
];

function formKeysForCategory(category) {
  return category === 'Infectious' ? INFECTIOUS_FORM_KEYS : CHRONIC_FORM_KEYS;
}

function diseaseAllowsBodyPartImage(diseaseCode) {
  if (!diseaseCode) return false;
  return BODY_PART_IMAGE_DISEASE_CODES.includes(String(diseaseCode).trim().toUpperCase());
}

/** Category defaults plus optional body-part photo for selected diseases. */
function formKeysForDisease({ category, diseaseCode }) {
  const keys = [...formKeysForCategory(category)];
  if (diseaseAllowsBodyPartImage(diseaseCode) && !keys.includes('affected_part_image')) {
    keys.push('affected_part_image');
  }
  return keys;
}

module.exports = {
  TRANSMISSION_MODES,
  DISEASE_CATEGORIES,
  ENRICHED_DISEASES,
  INFECTIOUS_FORM_KEYS,
  CHRONIC_FORM_KEYS,
  BODY_PART_IMAGE_DISEASE_CODES,
  formKeysForCategory,
  diseaseAllowsBodyPartImage,
  formKeysForDisease
};
