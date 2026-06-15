import React, { useState, useEffect } from 'react';

function App() {
  // Navigation and Greeting states
  const [currentView, setCurrentView] = useState('home'); // 'home' or 'hospital'
  const [helloMessage, setHelloMessage] = useState('Loading...');
  const [dbStatus, setDbStatus] = useState({ success: false, message: 'Database Untested', checked: false });
  const [checking, setChecking] = useState(false);

  // Batch Case Logging states
  const [hospitalSubView, setHospitalSubView] = useState('search'); // 'search' or 'batch'
  const [batchHospitalId, setBatchHospitalId] = useState('1001');
  const [batchCases, setBatchCases] = useState([
    {
      patientId: '',
      diseaseId: '101',
      diagnosisDate: new Date().toISOString().split('T')[0],
      symptomsList: '',
      severityAtAdmission: 'Mild',
      diagnosisMethod: 'Clinical',
      isolationStatus: 'Home Isolation',
      infectionSource: 'Local Transmission',
      notes: ''
    }
  ]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState('');

  // Patient Lookup states
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null); // { found: boolean, patient?: object }
  const [searchError, setSearchError] = useState('');

  // Registration Form states
  const [showRegForm, setShowRegForm] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const [formData, setFormData] = useState({
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
    division: '',
    photoUrl: ''
  });

  // Load backend hello on mount
  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => setHelloMessage(data.message))
      .catch((err) => {
        console.error(err);
        setHelloMessage('Server offline');
      });
  }, []);

  // Handle local DB check (from homepage)
  const handleCheckDb = () => {
    setChecking(true);
    setDbStatus({ checked: true, success: false, message: 'Checking Database...' });
    
    fetch('/api/db-check')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDbStatus({ success: true, message: 'Database Connected', checked: true });
        } else {
          setDbStatus({ success: false, message: 'Connection Failed', checked: true });
        }
      })
      .catch((err) => {
        console.error(err);
        setDbStatus({ success: false, message: 'Connection Error', checked: true });
      })
      .finally(() => {
        setChecking(false);
      });
  };

  // Handle Patient Search
  const handleSearchPatient = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    setShowRegForm(false);
    setRegSuccess('');

    fetch(`/api/patients/search?identity=${encodeURIComponent(searchQuery.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSearchResult(data);
          if (!data.found) {
            // Pre-fill the search value into NID or BCN field based on length (NID is usually 10/13/17 digits)
            const query = searchQuery.trim();
            const isNid = query.length >= 10 && !isNaN(query);
            setFormData({
              ...formData,
              nationalId: isNid ? query : '',
              birthCertNo: !isNid ? query : '',
              fullName: '',
              dob: '',
              gender: 'Male',
              bloodGroup: 'A+',
              contactNumber: '',
              occupation: '',
              streetAddress: '',
              city: '',
              division: '',
              photoUrl: ''
            });
            setShowRegForm(true);
          }
        } else {
          setSearchError(data.error || 'Failed to complete search.');
        }
      })
      .catch((err) => {
        console.error(err);
        setSearchError('Error communicating with lookup service.');
      })
      .finally(() => {
        setSearching(false);
      });
  };

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle Patient Registration
  const handleRegisterPatient = (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError('');
    setRegSuccess('');

    // Quick client-side validations
    if (!formData.fullName.trim()) {
      setRegError('Full Name is required.');
      setRegLoading(false);
      return;
    }
    if (!formData.dob) {
      setRegError('Date of Birth is required.');
      setRegLoading(false);
      return;
    }
    if (!formData.nationalId.trim() && !formData.birthCertNo.trim()) {
      setRegError('Either National ID or Birth Certificate Number must be provided.');
      setRegLoading(false);
      return;
    }

    fetch('/api/patients/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRegSuccess(`Patient registered successfully! Generated Patient ID: ${data.patientId}`);
          
          // Re-search automatically using the newly registered patient's NID/BCN
          setSearchQuery(formData.nationalId || formData.birthCertNo);
          setSearchResult({
            success: true,
            found: true,
            patient: {
              patientId: data.patientId,
              fullName: formData.fullName,
              dateOfBirth: formData.dob,
              gender: formData.gender,
              bloodGroup: formData.bloodGroup,
              contactNumber: formData.contactNumber,
              occupation: formData.occupation,
              streetAddress: formData.streetAddress,
              city: formData.city,
              division: formData.division,
              photoUrl: formData.photoUrl
            }
          });
          setShowRegForm(false);
        } else {
          setRegError(data.error || 'Registration failed.');
        }
      })
      .catch((err) => {
        console.error(err);
        setRegError('Network error registering patient.');
      })
      .finally(() => {
        setRegLoading(false);
      });
  };

  // Add a new row to the batch
  const handleAddBatchRow = () => {
    setBatchCases([
      ...batchCases,
      {
        patientId: '',
        diseaseId: '101',
        diagnosisDate: new Date().toISOString().split('T')[0],
        symptomsList: '',
        severityAtAdmission: 'Mild',
        diagnosisMethod: 'Clinical',
        isolationStatus: 'Home Isolation',
        infectionSource: 'Local Transmission',
        notes: ''
      }
    ]);
  };

  // Remove a row from the batch
  const handleRemoveBatchRow = (index) => {
    if (batchCases.length <= 1) return; // Keep at least one row
    const newCases = [...batchCases];
    newCases.splice(index, 1);
    setBatchCases(newCases);
  };

  // Change input in a specific batch row
  const handleBatchInputChange = (index, field, value) => {
    const newCases = [...batchCases];
    newCases[index] = { ...newCases[index], [field]: value };
    setBatchCases(newCases);
  };

  // Submit the batch of cases
  const handleBatchSubmit = (e) => {
    e.preventDefault();
    setBatchSubmitting(true);
    setBatchError('');
    setBatchResult(null);

    // Quick client-side validation
    const invalidRow = batchCases.findIndex(c => !c.patientId.trim() || isNaN(Number(c.patientId)));
    if (invalidRow !== -1) {
      setBatchError(`Row ${invalidRow + 1}: Patient ID is required and must be a number.`);
      setBatchSubmitting(false);
      return;
    }

    if (!batchHospitalId.trim() || isNaN(Number(batchHospitalId))) {
      setBatchError('Operating Hospital ID is required and must be a number.');
      setBatchSubmitting(false);
      return;
    }

    const payload = {
      cases: batchCases.map(c => ({
        ...c,
        hospitalId: Number(batchHospitalId)
      }))
    };

    fetch('/api/cases/batch-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBatchResult(data);
        } else {
          setBatchError(data.error || 'Failed to submit batch cases.');
        }
      })
      .catch((err) => {
        console.error(err);
        setBatchError('Network error submitting batch cases.');
      })
      .finally(() => {
        setBatchSubmitting(false);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => setCurrentView('home')}>
            <h1 className="text-xl font-bold tracking-tight text-gray-950">PublicHealthMap</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 font-mono">Ministry of Health & Welfare</p>
          </div>
          
          <nav className="flex items-center gap-6">
            <button 
              onClick={() => setCurrentView('home')}
              className={`text-xs font-semibold ${currentView === 'home' ? 'text-slate-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Public Dashboard
            </button>
            <button 
              onClick={() => setCurrentView('hospital')}
              className={`text-xs font-semibold ${currentView === 'hospital' ? 'text-slate-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Hospital Portal
            </button>
            <span className="text-xs text-gray-300 font-semibold cursor-not-allowed">Research Area</span>
            
            {/* Database status widget */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono font-medium ${
              !dbStatus.checked
                ? 'bg-gray-100 border-gray-200 text-gray-500'
                : dbStatus.success
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                !dbStatus.checked
                  ? 'bg-gray-400'
                  : dbStatus.success
                    ? 'bg-green-600 animate-pulse'
                    : 'bg-red-600'
              }`}></span>
              {dbStatus.message}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-grow">
        
        {/* VIEW 1: HOMEPAGE */}
        {currentView === 'home' && (
          <>
            {/* Hero Banner */}
            <section className="bg-white border-b border-gray-200 py-16 px-8">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
                  National Epidemic Surveillance & Mapping Portal
                </h2>
                <p className="mt-4 text-base text-gray-500 max-w-2xl mx-auto">
                  A secure, local Oracle database-driven framework designed to monitor critical disease spread, aggregate division-level outbreak statistics, and provide clinical analytical profiles.
                </p>
              </div>
            </section>

            {/* Modules Grid */}
            <main className="max-w-6xl mx-auto py-12 px-8 w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Hospital Intake Card */}
                <div className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 font-mono">Hospital Intake</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Patient Registry & Intake</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Authorized medical centers can search for patient profiles using National IDs or Birth Certificates, and record detailed clinical cases, symptoms, and outcomes.
                    </p>
                  </div>
                  <button 
                    onClick={() => setCurrentView('hospital')}
                    className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-2 px-4 rounded transition-colors text-center"
                  >
                    Open Intake Portal
                  </button>
                </div>

                {/* Dashboard Card */}
                <div className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 font-mono">Public Analytics</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Geographic Distribution</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Aggregated statistics and infection counts are available to the public. Outbreak maps and trend charts indicate disease vectors sorted by division, city, and date.
                    </p>
                  </div>
                  <button className="mt-6 w-full bg-slate-950 text-white font-medium text-xs py-2 px-4 rounded cursor-not-allowed opacity-40">
                    Analytical Dashboard
                  </button>
                </div>

                {/* Researcher Area Card */}
                <div className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 font-mono">Research Access</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Anonymized Export</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Approved medical and research organizations can request datasets. Data is masked at the database level using PL/SQL hash routines for HIPAA compliance.
                    </p>
                  </div>
                  <button className="mt-6 w-full bg-slate-950 text-white font-medium text-xs py-2 px-4 rounded cursor-not-allowed opacity-40">
                    Secure Data Request
                  </button>
                </div>

              </div>

              {/* Database Proof Panel */}
              <section className="mt-12 bg-white border border-gray-200 rounded p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-4 mb-6 gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Local Database Integration Status
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Verification of local Oracle connectivity pool</p>
                  </div>
                  <button
                    onClick={handleCheckDb}
                    disabled={checking}
                    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium text-xs py-2.5 px-4 rounded transition-colors duration-150"
                  >
                    {checking ? 'Testing...' : 'Test DB Connection'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm font-mono mb-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Database Type</div>
                    <div className="text-gray-900 font-semibold">Oracle Database (11g/XE/Local)</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Driver Mode</div>
                    <div className="text-gray-900 font-semibold">node-oracledb (Thick Client)</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Verification Query</div>
                    <div className="text-blue-700 font-semibold">SELECT 1 FROM DUAL</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Server Check</div>
                    <div className="text-green-700 font-semibold">{helloMessage}</div>
                  </div>
                </div>

                {dbStatus.checked && (
                  <div className={`text-xs p-3 border rounded font-mono ${
                    dbStatus.success
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <strong>Status:</strong> {dbStatus.success ? 'Success! Local Oracle DB is connected successfully. Query returned 1.' : 'Error! Connection pool lookup failed.'}
                  </div>
                )}
              </section>
            </main>
          </>
        )}

        {/* VIEW 2: HOSPITAL PORTAL (PATIENT INTAKE) */}
        {currentView === 'hospital' && (
          <main className="max-w-4xl mx-auto py-12 px-8 w-full">
            
            {/* Navigation Header */}
            <div className="flex items-center gap-4 mb-6 border-b border-gray-200 pb-4">
              <button 
                onClick={() => {
                  setCurrentView('home');
                  setSearchResult(null);
                  setSearchQuery('');
                  setShowRegForm(false);
                }} 
                className="text-xs text-gray-500 hover:text-slate-800 font-semibold border border-gray-300 px-3 py-1.5 rounded bg-white hover:bg-gray-50"
              >
                ← Back to Home
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hospital Portal</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">Step 5/6: Patient Lookup and Registration Package Interface</p>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => {
                  setHospitalSubView('search');
                  setBatchResult(null);
                  setBatchError('');
                }}
                className={`text-xs font-bold px-4 py-2 border rounded transition-all ${
                  hospitalSubView === 'search'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Search & Intake Portal
              </button>
              <button
                onClick={() => {
                  setHospitalSubView('batch');
                  setSearchResult(null);
                  setSearchQuery('');
                  setShowRegForm(false);
                }}
                className={`text-xs font-bold px-4 py-2 border rounded transition-all ${
                  hospitalSubView === 'batch'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Batch Case Logging
              </button>
            </div>

            {/* SUB-VIEW 1: SINGLE PATIENT SEARCH & REGISTRATION */}
            {hospitalSubView === 'search' && (
              <>
                {/* Patient Search Form */}
                <section className="bg-white border border-gray-200 rounded p-6 mb-8">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Lookup Patient</h3>
                  <p className="text-xs text-gray-400 mb-4">Search by National ID (NID) or Birth Certificate Number (BCN) before creating a clinical case record.</p>
                  
                  <form onSubmit={handleSearchPatient} className="flex gap-4">
                    <input
                      type="text"
                      placeholder="Enter NID or Birth Certificate Number"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-slate-800"
                      required
                    />
                    <button
                      type="submit"
                      disabled={searching || !searchQuery.trim()}
                      className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2 px-6 rounded transition-colors"
                    >
                      {searching ? 'Searching...' : 'Search Patient'}
                    </button>
                  </form>

                  {searchError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs font-mono">
                      {searchError}
                    </div>
                  )}
                  {regSuccess && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded text-xs font-mono">
                      {regSuccess}
                    </div>
                  )}
                </section>

                {/* SEARCH RESULTS DISPLAY */}
                {searchResult && searchResult.found && (
                  <section className="bg-white border border-gray-200 rounded p-6 mb-8">
                    <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Patient Record Found</h3>
                        <p className="text-xs text-gray-400 mt-1">Identified from the central database registry</p>
                      </div>
                      <span className="bg-green-100 border border-green-200 text-green-800 text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded">
                        Active File
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                      <div>
                        <div className="text-xs text-gray-400">Full Name</div>
                        <div className="text-gray-900 font-semibold">{searchResult.patient.fullName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Patient Database ID</div>
                        <div className="text-gray-900 font-semibold font-mono">{searchResult.patient.patientId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Date of Birth</div>
                        <div className="text-gray-900 font-semibold">{searchResult.patient.dateOfBirth}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Gender</div>
                        <div className="text-gray-900 font-semibold">{searchResult.patient.gender}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Blood Group</div>
                        <div className="text-gray-900 font-semibold font-mono">{searchResult.patient.bloodGroup}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Contact Number</div>
                        <div className="text-gray-900 font-semibold font-mono">{searchResult.patient.contactNumber}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Occupation</div>
                        <div className="text-gray-900 font-semibold">{searchResult.patient.occupation || 'N/A'}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-xs text-gray-400">Address</div>
                        <div className="text-gray-900 font-semibold">
                          {searchResult.patient.streetAddress ? `${searchResult.patient.streetAddress}, ` : ''}
                          {searchResult.patient.city}, {searchResult.patient.division}
                        </div>
                      </div>
                    </div>

                    {/* Integration notice */}
                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                      <strong>Database verification</strong>: Connection handles are open. Stored procedure package <code>patient_reg_pkg.find_patient</code> executed successfully.
                    </div>
                  </section>
                )}

                {/* PATIENT REGISTRATION FORM (Triggered if not found) */}
                {showRegForm && (
                  <section className="bg-white border border-gray-200 rounded p-6">
                    <div className="border-b border-gray-200 pb-3 mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Register New Patient</h3>
                      <p className="text-xs text-red-500 mt-1">NJS-Lookup result: Patient identity not registered. You must create a new profile in the database.</p>
                    </div>

                    {regError && (
                      <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs font-mono">
                        {regError}
                      </div>
                    )}

                    <form onSubmit={handleRegisterPatient} className="flex flex-col gap-6 text-sm">
                      
                      {/* Identity Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">National ID</label>
                          <input
                            type="text"
                            name="nationalId"
                            value={formData.nationalId}
                            onChange={handleInputChange}
                            placeholder="NID Number (if available)"
                            className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Birth Certificate Number</label>
                          <input
                            type="text"
                            name="birthCertNo"
                            value={formData.birthCertNo}
                            onChange={handleInputChange}
                            placeholder="BCN (if available)"
                            className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-slate-800"
                          />
                        </div>
                      </div>

                      {/* Core Profile Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Full Name *</label>
                          <input
                            type="text"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleInputChange}
                            placeholder="Patient Full Name"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-800"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Date of Birth *</label>
                          <input
                            type="date"
                            name="dob"
                            value={formData.dob}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Gender *</label>
                          <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      {/* Demographics Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Blood Group *</label>
                          <select
                            name="bloodGroup"
                            value={formData.bloodGroup}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
                          >
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Contact Number *</label>
                          <input
                            type="text"
                            name="contactNumber"
                            value={formData.contactNumber}
                            onChange={handleInputChange}
                            placeholder="Mobile or Landline"
                            className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-slate-800"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Occupation</label>
                          <input
                            type="text"
                            name="occupation"
                            value={formData.occupation}
                            onChange={handleInputChange}
                            placeholder="Patient Profession"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-800"
                          />
                        </div>
                      </div>

                      {/* Location Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Street Address</label>
                          <input
                            type="text"
                            name="streetAddress"
                            value={formData.streetAddress}
                            onChange={handleInputChange}
                            placeholder="House / Road Number"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">City *</label>
                          <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleInputChange}
                            placeholder="Town / City"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-800"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Division *</label>
                          <input
                            type="text"
                            name="division"
                            value={formData.division}
                            onChange={handleInputChange}
                            placeholder="State / Division (e.g. Dhaka)"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      {/* Submit buttons */}
                      <div className="flex gap-4 border-t border-gray-100 pt-4 mt-2">
                        <button
                          type="submit"
                          disabled={regLoading}
                          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2.5 px-8 rounded transition-colors"
                        >
                          {regLoading ? 'Registering...' : 'Register Patient'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRegForm(false)}
                          className="border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 px-6 rounded bg-white hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>

                    </form>
                  </section>
                )}
              </>
            )}

            {/* SUB-VIEW 2: BATCH CASE LOGGING */}
            {hospitalSubView === 'batch' && (
              <div className="flex flex-col gap-6">
                
                {/* Batch Header & Config */}
                <section className="bg-white border border-gray-200 rounded p-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Batch Outbreak Logger</h3>
                  <p className="text-xs text-gray-400 mb-6 font-sans">Record multiple case files simultaneously inside a single transaction context utilizing PL/SQL Savepoint boundaries.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Operating Hospital ID *</label>
                      <input
                        type="text"
                        value={batchHospitalId}
                        onChange={(e) => setBatchHospitalId(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-slate-800"
                        required
                      />
                    </div>
                  </div>
                </section>

                {/* Batch Form Table */}
                <form onSubmit={handleBatchSubmit} className="bg-white border border-gray-200 rounded p-6 overflow-x-auto">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4 min-w-[700px]">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Case Registry Records</h3>
                    <button
                      type="button"
                      onClick={handleAddBatchRow}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded"
                    >
                      + Add Row
                    </button>
                  </div>

                  {batchError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs font-mono">
                      {batchError}
                    </div>
                  )}

                  {batchResult && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded text-xs font-sans">
                      <div className="font-bold text-gray-800 mb-2">Batch Log Summary (Transaction Complete):</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono mb-4 text-[11px]">
                        <div>Successfully Written: <span className="text-green-700 font-bold">{batchResult.successCount}</span></div>
                        <div>Savepoint Rolled Back: <span className="text-red-700 font-bold">{batchResult.failCount}</span></div>
                      </div>
                      <div className="border-t border-gray-200 pt-3">
                        <div className="font-semibold text-gray-700 mb-1">Details per Row:</div>
                        <ul className="list-disc pl-5 font-mono text-[11px] text-gray-600 flex flex-col gap-1">
                          {batchResult.results.map((res, i) => (
                            <li key={i}>
                              Row {i + 1}: <span className={res.startsWith('SUCCESS') ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>{res}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <table className="w-full text-left border-collapse min-w-[900px] text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2 pr-2">Patient ID *</th>
                        <th className="py-2 px-2">Disease *</th>
                        <th className="py-2 px-2">Diag Date *</th>
                        <th className="py-2 px-2">Symptoms List *</th>
                        <th className="py-2 px-2">Severity</th>
                        <th className="py-2 px-2">Method</th>
                        <th className="py-2 px-2">Isolation</th>
                        <th className="py-2 px-2">Source</th>
                        <th className="py-2 px-2">Notes</th>
                        <th className="py-2 pl-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {batchCases.map((c, idx) => (
                        <tr key={idx}>
                          <td className="py-3 pr-2">
                            <input
                              type="text"
                              placeholder="Patient ID"
                              value={c.patientId}
                              onChange={(e) => handleBatchInputChange(idx, 'patientId', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-1.5 py-1 text-xs font-mono focus:outline-none"
                              required
                            />
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={c.diseaseId}
                              onChange={(e) => handleBatchInputChange(idx, 'diseaseId', e.target.value)}
                              className="border border-gray-300 rounded px-1 py-1 focus:outline-none"
                            >
                              <option value="101">COVID-19</option>
                              <option value="102">Cholera</option>
                              <option value="103">Dengue</option>
                              <option value="104">Tuberculosis</option>
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="date"
                              value={c.diagnosisDate}
                              onChange={(e) => handleBatchInputChange(idx, 'diagnosisDate', e.target.value)}
                              className="w-28 border border-gray-300 rounded px-1 py-1 font-mono focus:outline-none"
                              required
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              placeholder="Symptoms list"
                              value={c.symptomsList}
                              onChange={(e) => handleBatchInputChange(idx, 'symptomsList', e.target.value)}
                              className="w-32 border border-gray-300 rounded px-2 py-1 focus:outline-none"
                              required
                            />
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={c.severityAtAdmission}
                              onChange={(e) => handleBatchInputChange(idx, 'severityAtAdmission', e.target.value)}
                              className="border border-gray-300 rounded px-1 py-1 focus:outline-none"
                            >
                              <option value="Mild">Mild</option>
                              <option value="Moderate">Moderate</option>
                              <option value="Severe">Severe</option>
                              <option value="Critical">Critical</option>
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={c.diagnosisMethod}
                              onChange={(e) => handleBatchInputChange(idx, 'diagnosisMethod', e.target.value)}
                              className="border border-gray-300 rounded px-1 py-1 focus:outline-none"
                            >
                              <option value="PCR">PCR</option>
                              <option value="Antigen">Antigen</option>
                              <option value="Clinical">Clinical</option>
                              <option value="Culture">Culture</option>
                              <option value="Imaging">Imaging</option>
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={c.isolationStatus}
                              onChange={(e) => handleBatchInputChange(idx, 'isolationStatus', e.target.value)}
                              className="border border-gray-300 rounded px-1 py-1 focus:outline-none"
                            >
                              <option value="Home Isolation">Home Isolation</option>
                              <option value="General Ward">General Ward</option>
                              <option value="ICU">ICU</option>
                              <option value="CCU">CCU</option>
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={c.infectionSource}
                              onChange={(e) => handleBatchInputChange(idx, 'infectionSource', e.target.value)}
                              className="border border-gray-300 rounded px-1 py-1 focus:outline-none"
                            >
                              <option value="Local Transmission">Local Transmission</option>
                              <option value="Imported">Imported</option>
                              <option value="Unknown">Unknown</option>
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              placeholder="Notes"
                              value={c.notes}
                              onChange={(e) => handleBatchInputChange(idx, 'notes', e.target.value)}
                              className="w-24 border border-gray-300 rounded px-1.5 py-1 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchRow(idx)}
                              disabled={batchCases.length <= 1}
                              className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex gap-4 border-t border-gray-100 pt-4 mt-6">
                    <button
                      type="submit"
                      disabled={batchSubmitting}
                      className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2.5 px-8 rounded transition-colors"
                    >
                      {batchSubmitting ? 'Logging Batch...' : 'Submit Batch Case Log'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchCases([
                          {
                            patientId: '',
                            diseaseId: '101',
                            diagnosisDate: new Date().toISOString().split('T')[0],
                            symptomsList: '',
                            severityAtAdmission: 'Mild',
                            diagnosisMethod: 'Clinical',
                            isolationStatus: 'Home Isolation',
                            infectionSource: 'Local Transmission',
                            notes: ''
                          }
                        ]);
                        setBatchResult(null);
                        setBatchError('');
                      }}
                      className="border border-gray-300 text-gray-600 text-xs font-semibold py-2.5 px-6 rounded bg-white hover:bg-gray-50"
                    >
                      Reset Form
                    </button>
                  </div>
                </form>
              </div>
            )}

          </main>
        )}

      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 px-8 text-center text-xs text-gray-400 mt-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span>PublicHealthMap Project - Database Lab Core Scaffold</span>
          <span>© 2026 Ministry of Health & Welfare</span>
        </div>
      </footer>

    </div>
  );
}

export default App;
