import React, { useState, useEffect } from 'react';

function App() {
  const [helloMessage, setHelloMessage] = useState('Loading...');
  const [dbStatus, setDbStatus] = useState({ success: false, message: 'Database Untested', checked: false });
  const [checking, setChecking] = useState(false);

  // Load backend greeting on mount
  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => setHelloMessage(data.message))
      .catch((err) => {
        console.error(err);
        setHelloMessage('Server offline');
      });
  }, []);

  // Handle local DB connection check
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-950">PublicHealthMap</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Disease Surveillance System</p>
          </div>
          
          <nav className="flex items-center gap-6">
            <span className="text-xs text-gray-400 hover:text-gray-600 cursor-not-allowed">Public Dashboard</span>
            <span className="text-xs text-gray-400 hover:text-gray-600 cursor-not-allowed">Hospital Portal</span>
            <span className="text-xs text-gray-400 hover:text-gray-600 cursor-not-allowed">Research Area</span>
            
            {/* Live Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono font-medium transition-colors ${
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

      {/* Hero Banner Section */}
      <section className="bg-white border-b border-gray-200 py-16 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            National Epidemic Surveillance & Mapping Portal
          </h2>
          <p className="mt-4 text-base text-gray-500 max-w-2xl mx-auto">
            A secure, database-driven framework designed to monitor critical disease spread, aggregate regional outbreak statistics, and provide clinical analytical profiles.
          </p>
        </div>
      </section>

      {/* Core Project Modules Grid */}
      <main className="max-w-6xl mx-auto py-12 px-8 flex-grow w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Hospital Intake */}
          <div className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Hospital Intake</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Case Registration</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Authorized medical centers can search for patient demographics using National IDs (NID) or Birth Certificates, and record detailed clinical cases, symptoms, and outcomes.
              </p>
            </div>
            <button className="mt-6 w-full bg-slate-900 text-white font-medium text-xs py-2 px-4 rounded cursor-not-allowed opacity-60">
              Registration Portal
            </button>
          </div>

          {/* Card 2: Interactive Statistics */}
          <div className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Public Analytics</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Geographic Distribution</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Aggregated statistics and infection counts are available to the public. Outbreak maps and trend charts indicate disease vectors sorted by division, city, and date.
              </p>
            </div>
            <button className="mt-6 w-full bg-slate-900 text-white font-medium text-xs py-2 px-4 rounded cursor-not-allowed opacity-60">
              Interactive Dashboard
            </button>
          </div>

          {/* Card 3: Researcher Portal */}
          <div className="bg-white border border-gray-200 rounded p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Research Access</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Anonymized Export</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Approved medical and research organizations can request datasets. Data is masked at the database level using PL/SQL hash routines for HIPAA compliance.
              </p>
            </div>
            <button className="mt-6 w-full bg-slate-900 text-white font-medium text-xs py-2 px-4 rounded cursor-not-allowed opacity-60">
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
              <p className="text-xs text-gray-400 mt-1">Verification of Oracle connectivity pool</p>
            </div>
            <button
              onClick={handleCheckDb}
              disabled={checking}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium text-xs py-2 px-4 rounded transition-colors duration-150"
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

          {/* Live Status Message Box */}
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
