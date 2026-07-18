import React, { useEffect, useMemo, useState } from 'react';
import { authHeaders } from '../lib/session';

function matchesName(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return String(row.name || '').toLowerCase().includes(q)
    || String(row.email || '').toLowerCase().includes(q)
    || String(row.licenseNumber || row.registrationNumber || '').toLowerCase().includes(q)
    || String(row.city || '').toLowerCase().includes(q);
}

export default function AdminPortal({ go, session, persistSession }) {
  const [tab, setTab] = useState('hospitals');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [hospitals, setHospitals] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [downloadLogs, setDownloadLogs] = useState([]);
  const [directorySearch, setDirectorySearch] = useState('');

  const formatLogTime = (value) => {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  };

  const [selectedDiseaseId, setSelectedDiseaseId] = useState('');
  const [formFields, setFormFields] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [transmissionModes, setTransmissionModes] = useState([]);
  const [registryFilter, setRegistryFilter] = useState('');
  const [diseaseForm, setDiseaseForm] = useState({
    diseaseCode: '',
    commonName: '',
    scientificName: '',
    severityLevel: 'Moderate',
    transmissionMode: 'Non-communicable',
    category: 'Oncology',
    subcategory: '',
    description: ''
  });

  const loadApprovals = () => {
    if (!session?.token) return;
    Promise.all([
      fetch('/api/admin/hospitals', { headers: authHeaders(session.token, false) }).then((r) => r.json()),
      fetch('/api/admin/researchers', { headers: authHeaders(session.token, false) }).then((r) => r.json()),
      fetch('/api/admin/download-logs?limit=3', { headers: authHeaders(session.token, false) }).then((r) => r.json())
    ]).then(([h, o, logs]) => {
      if (h.success) setHospitals(h.hospitals);
      if (o.success) setOrgs(o.organizations);
      if (logs.success) setDownloadLogs(logs.logs || []);
      if (!h.success || !o.success) setError(h.error || o.error || 'Failed to load approvals');
    }).catch(() => setError('Network error loading approvals'));
  };

  const loadDiseases = () => {
    fetch('/api/diseases?all=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setDiseases(d.diseases);
          if (d.categories) setCategoryList(d.categories);
          if (d.transmissionModes) setTransmissionModes(d.transmissionModes);
          if (!selectedDiseaseId && d.diseases.length) {
            setSelectedDiseaseId(String(d.diseases[0].diseaseId));
          }
        }
      })
      .catch(() => {});
  };

  const loadForm = (diseaseId) => {
    if (!session?.token || !diseaseId) return;
    fetch(`/api/admin/diseases/${diseaseId}/form`, { headers: authHeaders(session.token, false) })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          setError(d.error || 'Failed to load form config');
          return;
        }
        setCatalog(d.catalog || []);
        // Merge catalog with saved rows so admin sees every possible field
        const byKey = Object.fromEntries((d.fields || []).map((f) => [f.fieldKey, f]));
        const merged = (d.catalog || []).map((c, idx) => {
          const saved = byKey[c.key];
          return {
            fieldKey: c.key,
            fieldLabel: saved?.fieldLabel || c.label,
            fieldType: c.type,
            fieldOptions: c.options || [],
            isEnabled: saved ? saved.isEnabled : false,
            isRequired: saved ? saved.isRequired : false,
            displayOrder: saved?.displayOrder || idx + 1
          };
        });
        setFormFields(merged);
      })
      .catch(() => setError('Network error loading form config'));
  };

  useEffect(() => {
    if (!session) return;
    loadApprovals();
    loadDiseases();
  }, [session]);

  useEffect(() => {
    if (tab === 'forms' || tab === 'diseases') {
      if (selectedDiseaseId) loadForm(selectedDiseaseId);
    }
  }, [tab, selectedDiseaseId, session]);

  if (!session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Admin Desk</h1>
        <p className="mt-2 text-sm text-slate-500">MoHFW administrator sign-in required.</p>
        <button type="button" onClick={() => go('login')} className="mt-6 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-lg">Go to Sign In</button>
      </div>
    );
  }

  const setHospitalStatus = (id, status, label) => {
    setError('');
    setSuccess('');
    fetch(`/api/admin/hospitals/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(session.token),
      body: JSON.stringify({ status })
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error || 'Could not update hospital status');
        else {
          setSuccess(label || `Hospital marked ${status}.`);
          loadApprovals();
        }
      })
      .catch(() => setError('Network error updating hospital'));
  };

  const setOrgStatus = (id, status, label) => {
    setError('');
    setSuccess('');
    fetch(`/api/admin/researchers/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(session.token),
      body: JSON.stringify({ status })
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error || 'Could not update organization status');
        else {
          setSuccess(label || `Organization marked ${status}.`);
          loadApprovals();
        }
      })
      .catch(() => setError('Network error updating organization'));
  };

  const pendingHospitals = useMemo(
    () => hospitals.filter((h) => h.approvalStatus === 'Pending' && matchesName(h, directorySearch)),
    [hospitals, directorySearch]
  );
  const approvedHospitals = useMemo(
    () => hospitals.filter((h) => h.approvalStatus === 'Approved' && matchesName(h, directorySearch)),
    [hospitals, directorySearch]
  );
  const pendingOrgs = useMemo(
    () => orgs.filter((o) => o.approvalStatus === 'Pending' && matchesName(o, directorySearch)),
    [orgs, directorySearch]
  );
  const approvedOrgs = useMemo(
    () => orgs.filter((o) => o.approvalStatus === 'Approved' && matchesName(o, directorySearch)),
    [orgs, directorySearch]
  );

  const createDisease = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    fetch('/api/admin/diseases', {
      method: 'POST',
      headers: authHeaders(session.token),
      body: JSON.stringify(diseaseForm)
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          setError(d.error || 'Could not create disease');
          return;
        }
        setSuccess(`Disease created (ID ${d.diseaseId}). Configure its form under Form Builder.`);
        setDiseaseForm({
          diseaseCode: '',
          commonName: '',
          scientificName: '',
          severityLevel: 'Moderate',
          transmissionMode: 'Non-communicable',
          category: 'Oncology',
          subcategory: '',
          description: ''
        });
        loadDiseases();
        setSelectedDiseaseId(String(d.diseaseId));
        setTab('forms');
      })
      .catch(() => setError('Network error creating disease'));
  };

  const toggleDiseaseActive = (disease, active) => {
    fetch(`/api/admin/diseases/${disease.diseaseId}`, {
      method: 'PATCH',
      headers: authHeaders(session.token),
      body: JSON.stringify({ isActive: active })
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error || 'Update failed');
        else {
          setSuccess(active ? 'Disease activated.' : 'Disease removed from active list (soft-deleted).');
          loadDiseases();
        }
      });
  };

  const uploadDiseaseSample = (disease, file) => {
    if (!file) return;
    setError('');
    setSuccess('');
    const body = new FormData();
    body.append('image', file);
    body.append('caption', `Sample affected area — ${disease.commonName}`);
    fetch(`/api/admin/diseases/${disease.diseaseId}/sample-image`, {
      method: 'POST',
      headers: authHeaders(session.token, false),
      body
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error || 'Sample image upload failed');
        else {
          setSuccess(`Sample body-part image saved for ${disease.commonName}.`);
          loadDiseases();
        }
      })
      .catch(() => setError('Network error uploading sample image'));
  };

  const saveForm = () => {
    setError('');
    setSuccess('');
    fetch(`/api/admin/diseases/${selectedDiseaseId}/form`, {
      method: 'PUT',
      headers: authHeaders(session.token),
      body: JSON.stringify({ fields: formFields })
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error || 'Save failed');
        else setSuccess('Disease form saved. Hospitals will see only enabled fields.');
      })
      .catch(() => setError('Network error saving form'));
  };

  const updateField = (key, patch) => {
    setFormFields((prev) => prev.map((f) => (f.fieldKey === key ? { ...f, ...patch } : f)));
  };

  const tabs = [
    { id: 'hospitals', label: 'Hospitals' },
    { id: 'researchers', label: 'Researchers' },
    { id: 'diseases', label: 'Diseases' },
    { id: 'forms', label: 'Form builder' }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Admin Desk</h1>
          <p className="text-xs text-slate-500 mt-1">Approvals · disease registry · per-disease clinical forms</p>
        </div>
        <button type="button" onClick={() => persistSession(null)} className="text-xs font-semibold border border-slate-200 px-3 py-2 rounded-lg">Log out</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setError('');
              setSuccess('');
              if (t.id === 'hospitals' || t.id === 'researchers') setDirectorySearch('');
            }}
            className={`text-xs font-bold px-4 py-2 rounded-lg border ${tab === t.id ? 'bg-brand text-white border-brand' : 'bg-white border-slate-200'}`}
          >
            {t.label}
            {t.id === 'hospitals' && hospitals.some((h) => h.approvalStatus === 'Pending') && (
              <span className="ml-1.5 text-[10px] font-mono opacity-90">({hospitals.filter((h) => h.approvalStatus === 'Pending').length})</span>
            )}
            {t.id === 'researchers' && orgs.some((o) => o.approvalStatus === 'Pending') && (
              <span className="ml-1.5 text-[10px] font-mono opacity-90">({orgs.filter((o) => o.approvalStatus === 'Pending').length})</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-mono">{success}</div>}

      <section className="bg-white border border-slate-200 rounded-xl mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Recent research downloads</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Latest 3 rows from DOWNLOAD_LOGS</p>
          </div>
          <button
            type="button"
            onClick={loadApprovals}
            className="text-[11px] font-bold text-brand"
          >
            Refresh
          </button>
        </div>
        {downloadLogs.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400">No downloads recorded yet. Exports from approved researchers will appear here.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {downloadLogs.map((log) => (
              <li key={log.logId} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{log.orgName}</div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">{log.orgEmail}</div>
                  <div className="text-[11px] text-slate-500 mt-1 break-all">{log.filterCriteria || '—'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-700">{log.totalRecords} records</div>
                  <div className="text-[11px] font-mono text-slate-400">{formatLogTime(log.downloadedAt)}</div>
                  <div className="text-[10px] font-mono text-slate-300">log #{log.logId}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(tab === 'hospitals' || tab === 'researchers') && (() => {
        const isHospital = tab === 'hospitals';
        const pending = isHospital ? pendingHospitals : pendingOrgs;
        const approved = isHospital ? approvedHospitals : approvedOrgs;
        const entity = isHospital ? 'hospital' : 'research organization';
        const entityPlural = isHospital ? 'hospitals' : 'research organizations';

        return (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
                Search by name
              </label>
              <input
                type="search"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder={isHospital ? 'Hospital name, email, license, or city…' : 'Organization name, email, or registration…'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Pending approval requests</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Approve to add to the directory, or reject the application.</p>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  {pending.length}
                </span>
              </div>
              {pending.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">No pending {entity} requests{directorySearch ? ' matching this search' : ''}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">{isHospital ? 'City / Division' : 'Registration'}</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pending.map((row) => (
                        <tr key={isHospital ? row.hospitalId : row.orgId}>
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{row.email}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {isHospital
                              ? `${row.city || '—'} · ${row.division || '—'}`
                              : row.registrationNumber || '—'}
                          </td>
                          <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => (isHospital
                                ? setHospitalStatus(row.hospitalId, 'Approved', `${row.name} approved and added to the hospital list.`)
                                : setOrgStatus(row.orgId, 'Approved', `${row.name} approved and added to the researcher list.`))}
                              className="text-[11px] font-bold text-brand"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => (isHospital
                                ? setHospitalStatus(row.hospitalId, 'Rejected', `${row.name} rejected.`)
                                : setOrgStatus(row.orgId, 'Rejected', `${row.name} rejected.`))}
                              className="text-[11px] font-bold text-red-600"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Approved {entityPlural}</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Directory of approved accounts. Remove blocks sign-in (status set to Rejected).</p>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                  {approved.length}
                </span>
              </div>
              {approved.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">No approved {entityPlural}{directorySearch ? ' matching this search' : ''}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">{isHospital ? 'City / Division' : 'Registration'}</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {approved.map((row) => (
                        <tr key={isHospital ? row.hospitalId : row.orgId}>
                          <td className="px-4 py-3 font-semibold text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{row.email}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {isHospital
                              ? `${row.city || '—'} · ${row.division || '—'}`
                              : row.registrationNumber || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm(`Remove ${row.name} from the approved list? They will no longer be able to sign in.`)) return;
                                if (isHospital) {
                                  setHospitalStatus(row.hospitalId, 'Rejected', `${row.name} removed from the hospital list.`);
                                } else {
                                  setOrgStatus(row.orgId, 'Rejected', `${row.name} removed from the researcher list.`);
                                }
                              }}
                              className="text-[11px] font-bold text-red-600"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        );
      })()}

      {tab === 'diseases' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={createDisease} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Add disease</h2>
            <p className="text-xs text-slate-500">Assign a specialty category and optional subcategory so hospitals and surveillance can filter precisely.</p>
            {[
              ['diseaseCode', 'Code (e.g. BRAIN_CANCER)'],
              ['commonName', 'Common name'],
              ['scientificName', 'Scientific name'],
              ['subcategory', 'Subcategory (e.g. Brain Cancer)']
            ].map(([name, label]) => (
              <div key={name}>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{label}</label>
                <input
                  value={diseaseForm[name]}
                  onChange={(e) => setDiseaseForm({ ...diseaseForm, [name]: e.target.value })}
                  required={name !== 'scientificName' && name !== 'subcategory'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Category *</label>
                <select value={diseaseForm.category} onChange={(e) => setDiseaseForm({ ...diseaseForm, category: e.target.value })} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {(categoryList.length ? categoryList : ['Infectious', 'Oncology', 'Hematology', 'Cardiology', 'Neurology', 'Hepatology', 'Nephrology', 'Pulmonology', 'Endocrinology', 'Gastroenterology', 'Rheumatology']).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Severity</label>
                <select value={diseaseForm.severityLevel} onChange={(e) => setDiseaseForm({ ...diseaseForm, severityLevel: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option>Mild</option><option>Moderate</option><option>Severe</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Transmission / etiology</label>
                <select value={diseaseForm.transmissionMode} onChange={(e) => setDiseaseForm({ ...diseaseForm, transmissionMode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {(transmissionModes.length ? transmissionModes : ['Non-communicable', 'Genetic', 'Lifestyle', 'Idiopathic', 'Airborne', 'Waterborne', 'Vector', 'Contact', 'Zoonotic']).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description</label>
              <textarea value={diseaseForm.description} onChange={(e) => setDiseaseForm({ ...diseaseForm, description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px]" />
            </div>
            <button type="submit" className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-lg">Create disease</button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-800">Disease registry</div>
              <select
                value={registryFilter}
                onChange={(e) => setRegistryFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
              >
                <option value="">All categories</option>
                {categoryList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <ul className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
              {diseases.filter((d) => !registryFilter || d.category === registryFilter).map((d) => (
                <li key={d.diseaseId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {d.sampleImageUrl ? (
                      <img
                        src={d.sampleImageUrl}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md border border-dashed border-slate-200 bg-slate-50 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{d.commonName}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {d.category}{d.subcategory ? ` / ${d.subcategory}` : ''} · {d.diseaseCode} · {d.isActive ? 'Active' : 'Inactive'}
                      </div>
                      <label className="mt-1 inline-block text-[11px] font-bold text-slate-600 cursor-pointer hover:text-brand">
                        {d.sampleImageUrl ? 'Replace sample photo' : 'Add sample body-part photo'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            uploadDiseaseSample(d, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => { setSelectedDiseaseId(String(d.diseaseId)); setTab('forms'); }} className="text-[11px] font-bold text-brand">Edit form</button>
                    {d.isActive ? (
                      <button type="button" onClick={() => toggleDiseaseActive(d, false)} className="text-[11px] font-bold text-red-600">Remove</button>
                    ) : (
                      <button type="button" onClick={() => toggleDiseaseActive(d, true)} className="text-[11px] font-bold text-green-700">Restore</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'forms' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
            <div className="flex-grow">
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Disease form</label>
              <select
                value={selectedDiseaseId}
                onChange={(e) => setSelectedDiseaseId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              >
                {diseases.map((d) => (
                  <option key={d.diseaseId} value={d.diseaseId}>
                    [{d.category}] {d.commonName}{d.subcategory ? ` · ${d.subcategory}` : ''}{d.isActive ? '' : ' — inactive'}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={saveForm} className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
              Save form configuration
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Enable only the information hospitals must collect for this disease. Required fields are enforced when a hospital submits a case.
          </p>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                  <th className="px-4 py-3">Include</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Required</th>
                  <th className="px-4 py-3">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {formFields.map((f) => (
                  <tr key={f.fieldKey} className={f.isEnabled ? '' : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={f.isEnabled}
                        onChange={(e) => updateField(f.fieldKey, { isEnabled: e.target.checked })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{f.fieldLabel}</div>
                      <div className="font-mono text-[10px] text-slate-400">{f.fieldKey}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{f.fieldType}</td>
                    <td className="px-4 py-3">
                      {f.fieldType === 'image' || f.fieldKey === 'affected_part_image' ? (
                        <span className="text-[10px] font-mono text-slate-400">Always optional</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={f.isRequired}
                          disabled={!f.isEnabled}
                          onChange={(e) => updateField(f.fieldKey, { isRequired: e.target.checked })}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        value={f.displayOrder}
                        onChange={(e) => updateField(f.fieldKey, { displayOrder: Number(e.target.value) || 1 })}
                        className="w-16 border border-slate-200 rounded px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!catalog.length && !formFields.length && (
            <p className="mt-4 text-xs text-slate-400">Select a disease to load its form template.</p>
          )}
        </div>
      )}
    </div>
  );
}
