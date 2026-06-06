import React, { useState, useEffect } from 'react';

function App() {
  const [helloMessage, setHelloMessage] = useState('Loading backend hello...');
  const [dbStatus, setDbStatus] = useState({ checked: false, success: false, message: 'Not checked yet.' });
  const [checking, setChecking] = useState(false);

  // Fetch hello message from backend
  useEffect(() => {
    fetch('/api/hello')
      .then((res) => {
        if (!res.ok) throw new Error('Network response not ok');
        return res.json();
      })
      .then((data) => setHelloMessage(data.message))
      .catch((err) => {
        console.error(err);
        setHelloMessage('Error connecting to backend server.');
      });
  }, []);

  // Handle local DB connection check (Step 2)
  const handleCheckDb = () => {
    setChecking(true);
    setDbStatus({ checked: true, success: false, message: 'Checking local Oracle DB connection...' });
    
    fetch('/api/db-check')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDbStatus({ checked: true, success: true, message: data.message });
        } else {
          setDbStatus({ checked: true, success: false, message: data.error || 'Connection check failed.' });
        }
      })
      .catch((err) => {
        console.error(err);
        setDbStatus({ checked: true, success: false, message: 'Failed to communicate with DB check API.' });
      })
      .finally(() => {
        setChecking(false);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PublicHealthMap</h1>
          <p className="text-sm text-gray-500 mt-1">Disease Surveillance & Spatial Mapping</p>
        </div>

        {/* Server Check */}
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Client-Server Connectivity</h2>
          <p className="text-gray-900 text-sm font-mono bg-white p-2 border border-gray-200 rounded">
            {helloMessage}
          </p>
        </div>

        {/* Database Check */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Local Oracle Database Connectivity</h2>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleCheckDb}
              disabled={checking}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium text-sm py-2 px-4 rounded transition-colors duration-150 text-center"
            >
              {checking ? 'Testing Connection...' : 'Test DB Connection'}
            </button>
            <div className={`text-sm p-3 border rounded font-mono ${
              !dbStatus.checked 
                ? 'bg-white border-gray-200 text-gray-500' 
                : dbStatus.success 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {dbStatus.message}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-gray-400">
          PublicHealthMap
        </div>

      </div>
    </div>
  );
}

export default App;
