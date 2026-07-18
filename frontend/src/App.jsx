import React, { useEffect, useMemo, useState } from 'react';
import { SvgBarChart, SvgPieChart, ProjectedBubbleMap } from './components/Charts';
import MultiSelect from './components/MultiSelect';
import { BD_DIVISIONS, NAV_ITEMS } from './lib/constants';
import { authHeaders, loadSession, saveSession } from './lib/session';
import HospitalPortal from './pages/HospitalPortal';
import AdminPortal from './pages/AdminPortal';
import ResearcherPortal from './pages/ResearcherPortal';

function App() {
  const [view, setView] = useState('landing');
  const [menuOpen, setMenuOpen] = useState(false);

  const [hospitalSession, setHospitalSession] = useState(() => loadSession('phm_hospital_session'));
  const [researcherSession, setResearcherSession] = useState(() => loadSession('phm_researcher_session'));
  const [adminSession, setAdminSession] = useState(() => loadSession('phm_admin_session'));

  const persistHospital = (s) => { setHospitalSession(s); saveSession('phm_hospital_session', s); };
  const persistResearcher = (s) => { setResearcherSession(s); saveSession('phm_researcher_session', s); };
  const persistAdmin = (s) => { setAdminSession(s); saveSession('phm_admin_session', s); };

  const go = (id) => {
    setView(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => go('landing')} className="text-left min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold text-slate-950 tracking-tight">PublicHealthMap</div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Bangladesh · Ministry of Health &amp; Family Welfare</div>
          </button>

          <nav className="hidden md:flex items-center gap-1.5">
            {[
              { id: 'landing', label: 'Home' },
              { id: 'surveillance', label: 'Surveillance' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  view === item.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="relative">
            <button
              type="button"
              aria-label="Open site menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1"
            >
              <span className="w-1 h-1 rounded-full bg-slate-800" />
              <span className="w-1 h-1 rounded-full bg-slate-800" />
              <span className="w-1 h-1 rounded-full bg-slate-800" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                <nav className="py-1 max-h-[70vh] overflow-auto">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(item.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-brand-soft transition-colors ${view === item.id ? 'bg-brand-soft' : ''}`}
                    >
                      <div className={`text-sm font-semibold ${view === item.id ? 'text-brand' : 'text-slate-800'}`}>{item.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {view === 'landing' && <LandingPage go={go} />}
        {view === 'surveillance' && <SurveillancePage />}
        {view === 'login' && (
          <LoginPage
            go={go}
            persistHospital={persistHospital}
            persistResearcher={persistResearcher}
            persistAdmin={persistAdmin}
          />
        )}
        {view === 'hospital-register' && <HospitalRegisterPage go={go} />}
        {view === 'researcher-register' && <ResearcherRegisterPage go={go} />}
        {view === 'hospital' && (
          <HospitalPortal
            go={go}
            session={hospitalSession}
            persistSession={persistHospital}
          />
        )}
        {view === 'researcher' && (
          <ResearcherPortal
            go={go}
            session={researcherSession}
            persistSession={persistResearcher}
          />
        )}
        {view === 'admin' && (
          <AdminPortal
            go={go}
            session={adminSession}
            persistSession={persistAdmin}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-slate-400">
          <span>PublicHealthMap · Bangladesh critical disease registry</span>
          <span>© 2026 Ministry of Health and Family Welfare</span>
        </div>
      </footer>
    </div>
  );
}

function LandingPage({ go }) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(15,92,76,0.12),_transparent_55%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand mb-4">People&apos;s Republic of Bangladesh</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-950 max-w-3xl leading-tight">
            PublicHealthMap
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
            National disease surveillance for Bangladesh&apos;s eight divisions. Hospitals report cases,
            the public explores filtered disease intelligence by specialty, and approved researchers export anonymized datasets.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => go('surveillance')} className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
              Explore Surveillance
            </button>
            <button type="button" onClick={() => go('login')} className="bg-white border border-slate-300 hover:border-brand text-slate-800 text-sm font-semibold px-5 py-2.5 rounded-lg">
              Sign In
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { title: 'Hospital facilities', body: 'Register your medical center, await MoHFW approval, then log patient cases in batch.', cta: 'Hospital Registration', action: 'hospital-register' },
          { title: 'Public intelligence', body: 'Choose one or more diseases and divisions. Maps and charts update to your selection only.', cta: 'Open Surveillance', action: 'surveillance' },
          { title: 'Research access', body: 'Apply as a research organization. After approval, download PL/SQL-masked case extracts.', cta: 'Researcher Sign Up', action: 'researcher-register' }
        ].map((card) => (
          <article key={card.title} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
            <h2 className="font-display text-xl font-bold text-slate-950">{card.title}</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed flex-grow">{card.body}</p>
            <button type="button" onClick={() => go(card.action)} className="mt-6 text-sm font-semibold text-brand hover:text-brand-dark text-left">
              {card.cta} →
            </button>
          </article>
        ))}
      </section>
    </>
  );
}

function SurveillancePage() {
  const [allDiseases, setAllDiseases] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [selectedDiseases, setSelectedDiseases] = useState([]);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [statsData, setStatsData] = useState([]);
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/public/catalog')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAllDiseases(d.diseases || []);
      })
      .catch(() => {});
  }, []);

  const categoryOptions = useMemo(
    () => [...new Set(allDiseases.map((d) => d.category).filter(Boolean))].sort(),
    [allDiseases]
  );

  const subcategoryOptions = useMemo(() => {
    const pool = selectedCategories.length
      ? allDiseases.filter((d) => selectedCategories.includes(d.category))
      : allDiseases;
    return [...new Set(pool.map((d) => d.subcategory).filter(Boolean))].sort();
  }, [allDiseases, selectedCategories]);

  const diseaseOptions = useMemo(() => {
    return allDiseases.filter((d) => {
      if (selectedCategories.length && !selectedCategories.includes(d.category)) return false;
      if (selectedSubcategories.length && !selectedSubcategories.includes(d.subcategory)) return false;
      return true;
    });
  }, [allDiseases, selectedCategories, selectedSubcategories]);

  useEffect(() => {
    const allowed = new Set(diseaseOptions.map((d) => d.code));
    setSelectedDiseases((prev) => {
      const next = prev.filter((c) => allowed.has(c));
      return next.length === prev.length ? prev : next;
    });
    setSelectedSubcategories((prev) => {
      const next = prev.filter((s) => subcategoryOptions.includes(s));
      return next.length === prev.length ? prev : next;
    });
  }, [diseaseOptions, subcategoryOptions]);

  const load = () => {
    setLoading(true);
    setError('');
    const q = new URLSearchParams();
    if (selectedDiseases.length) {
      q.set('diseases', selectedDiseases.join(','));
        } else {
      if (selectedCategories.length) q.set('categories', selectedCategories.join(','));
      if (selectedSubcategories.length) q.set('subcategories', selectedSubcategories.join(','));
    }
    if (selectedDivisions.length) q.set('divisions', selectedDivisions.join(','));
    const qs = q.toString() ? `?${q.toString()}` : '';

    Promise.all([
      fetch(`/api/public/stats${qs}`).then((r) => r.json()),
      fetch(`/api/public/map-data${qs}`).then((r) => r.json())
    ])
      .then(([statsRes, mapRes]) => {
        if (statsRes.success && mapRes.success) {
          setStatsData(statsRes.stats);
          setMapData(mapRes.mapData);
        } else {
          setError(statsRes.error || mapRes.error || 'Failed to load surveillance data.');
        }
      })
      .catch(() => setError('Could not reach surveillance APIs.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedDiseases, selectedCategories, selectedSubcategories, selectedDivisions]);

  const totals = useMemo(() => {
    const totalCases = statsData.reduce((s, r) => s + r.totalCases, 0);
    const activeCases = statsData.reduce((s, r) => s + r.activeCases, 0);
    const deaths = statsData.reduce((s, r) => s + r.totalDeaths, 0);
    return { totalCases, activeCases, deaths };
  }, [statsData]);

  const recentIndex = useMemo(() => {
    const withCases = statsData.filter((r) => (r.totalCases || 0) > 0 || (r.activeCases || 0) > 0);
    const pool = withCases.length ? withCases : statsData;
    return [...pool]
      .sort((a, b) => (b.totalCases || 0) - (a.totalCases || 0) || (b.activeCases || 0) - (a.activeCases || 0))
      .slice(0, 10);
  }, [statsData]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-950">Public Surveillance</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
          Filter by specialty (e.g. Neurology), a more specific group (e.g. Brain Cancer), then individual diseases and divisions.
                </p>
              </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <MultiSelect
          label="Category / Specialty"
          options={categoryOptions}
          selected={selectedCategories}
          onChange={setSelectedCategories}
        />
        <MultiSelect
          label="Subcategory (e.g. Brain Cancer)"
          options={subcategoryOptions}
          selected={selectedSubcategories}
          onChange={setSelectedSubcategories}
        />
        <MultiSelect
          label="Specific disease(s)"
          options={diseaseOptions}
          selected={selectedDiseases}
          onChange={setSelectedDiseases}
          getValue={(o) => o.code}
          getLabel={(o) => `${o.name} · ${o.category}${o.subcategory ? ` / ${o.subcategory}` : ''}`}
        />
        <MultiSelect
          label="Division / Region(s)"
          options={BD_DIVISIONS}
          selected={selectedDivisions}
          onChange={setSelectedDivisions}
        />
                </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total cases', value: totals.totalCases },
          { label: 'Active cases', value: totals.activeCases },
          { label: 'Deaths', value: totals.deaths }
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{kpi.label}</div>
            <div className="mt-2 text-3xl font-display font-bold text-slate-950">{loading ? '—' : kpi.value}</div>
                  </div>
        ))}
                </div>

      {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{error}</div>}

      {/* Stacked layout: map → pie → case volume (not side-by-side) */}
      <div className="space-y-8 mb-8">
        <section>
                      <ProjectedBubbleMap data={mapData} />
        </section>
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Disease share</h3>
          <SvgPieChart data={statsData} />
        </section>
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Case volume by disease</h3>
                      <SvgBarChart data={statsData} />
        </section>
                    </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Filtered outbreak index</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Top 10 rows by case volume</p>
                  </div>
          <button type="button" onClick={load} className="text-xs font-semibold text-brand">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
                      <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                <th className="px-5 py-3">Division</th>
                <th className="px-5 py-3">Disease</th>
                <th className="px-5 py-3 text-right">Active</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Deaths</th>
                        </tr>
                      </thead>
            <tbody className="divide-y divide-slate-50 font-mono">
              {!loading && recentIndex.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No rows for the current filter selection.</td></tr>
              )}
              {recentIndex.map((row, idx) => (
                <tr key={`${row.division}-${row.diseaseCode}-${idx}`} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3 font-sans font-semibold text-slate-800">{row.division}</td>
                  <td className="px-5 py-3">{row.diseaseCode}</td>
                  <td className="px-5 py-3 text-right text-red-600">{row.activeCases}</td>
                  <td className="px-5 py-3 text-right">{row.totalCases}</td>
                  <td className="px-5 py-3 text-right">{row.totalDeaths}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                </div>
  );
}

function LoginPage({ go, persistHospital, persistResearcher, persistAdmin }) {
  const [role, setRole] = useState('hospital');
  const [email, setEmail] = useState('hosp-1001-dhk@health.gov.bd');
  const [password, setPassword] = useState('hospital123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role === 'admin') {
      setEmail('admin@health.gov.bd');
      setPassword('admin123');
    } else if (role === 'hospital') {
      setEmail('hosp-1001-dhk@health.gov.bd');
      setPassword('hospital123');
    } else {
      setEmail('iedcr@research.org.bd');
      setPassword('research123');
    }
    setError('');
  }, [role]);

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const path = role === 'admin'
      ? '/api/auth/admin/login'
      : role === 'hospital'
        ? '/api/auth/hospital/login'
        : '/api/auth/researcher/login';

    fetch(path, {
      method: 'POST',
      headers: authHeaders(null),
      body: JSON.stringify({ email, password })
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.error || 'Sign in failed.');
          return;
        }
        if (role === 'admin') {
          persistAdmin({ token: data.token, admin: data.admin });
          go('admin');
        } else if (role === 'hospital') {
          persistHospital({ token: data.token, hospital: data.hospital });
          go('hospital');
        } else {
          persistResearcher({ token: data.token, organization: data.organization });
          go('researcher');
        }
      })
      .catch(() => setError('Network error during sign in.'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-slate-950">Sign In</h1>
      <p className="mt-2 text-sm text-slate-500">Choose your role, then authenticate with your credentials.</p>

      <div className="mt-6 grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
        {[
          { id: 'admin', label: 'Admin' },
          { id: 'hospital', label: 'Hospital' },
          { id: 'researcher', label: 'Researcher' }
        ].map((tab) => (
              <button
            key={tab.id}
            type="button"
            onClick={() => setRole(tab.id)}
            className={`text-xs font-bold py-2.5 rounded-lg transition-colors ${
              role === tab.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
              </button>
        ))}
            </div>

      <form onSubmit={submit} className="mt-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{error}</div>}
                      <div>
          <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
                      </div>
                      <div>
          <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
                      </div>
        <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg">
          {loading ? 'Signing in…' : `Sign in as ${role}`}
        </button>
        {role === 'hospital' && (
          <button type="button" onClick={() => go('hospital-register')} className="w-full text-xs font-semibold text-brand">
            New facility? Register hospital →
          </button>
        )}
        {role === 'researcher' && (
          <button type="button" onClick={() => go('researcher-register')} className="w-full text-xs font-semibold text-brand">
            New organization? Apply for access →
          </button>
        )}
      </form>
                    </div>
  );
}

function HospitalRegisterPage({ go }) {
  const [form, setForm] = useState({
    licenseNumber: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    streetAddress: '',
    city: '',
    division: 'Dhaka',
    latitude: '23.8103',
    longitude: '90.4125'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    fetch('/api/auth/hospital/register', {
      method: 'POST',
      headers: authHeaders(null),
      body: JSON.stringify(form)
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSuccess(data.message);
        } else {
          setError(data.error || 'Registration failed.');
        }
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-slate-950">Hospital Registration</h1>
      <p className="mt-2 text-sm text-slate-500">Submit your facility for MoHFW admin approval. You cannot sign in until Approved.</p>
      <form onSubmit={submit} className="mt-6 bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {error && <div className="sm:col-span-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{error}</div>}
        {success && <div className="sm:col-span-2 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-mono">{success}</div>}
        {[
          ['licenseNumber', 'License number'],
          ['name', 'Hospital name'],
          ['email', 'Official email'],
          ['password', 'Password', 'password'],
          ['phone', 'Phone'],
          ['streetAddress', 'Street address'],
          ['city', 'City'],
          ['latitude', 'Latitude'],
          ['longitude', 'Longitude']
        ].map(([name, label, type = 'text']) => (
          <div key={name}>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">{label}</label>
            <input name={name} type={type} value={form[name]} onChange={onChange} required={name !== 'streetAddress'} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                        </div>
        ))}
                        <div>
          <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Division</label>
          <select name="division" value={form.division} onChange={onChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {BD_DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
        <div className="sm:col-span-2 flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
            {loading ? 'Submitting…' : 'Submit registration'}
                        </button>
          <button type="button" onClick={() => go('login')} className="text-sm font-semibold text-slate-500">Already registered? Sign in</button>
                      </div>
                    </form>
    </div>
  );
}

function ResearcherRegisterPage({ go }) {
  const [form, setForm] = useState({
    registrationNumber: '',
    name: '',
    email: '',
    password: '',
    purposeStatement: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    fetch('/api/auth/researcher/register', {
      method: 'POST',
      headers: authHeaders(null),
      body: JSON.stringify(form)
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSuccess(data.message);
        else setError(data.error || 'Registration failed.');
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-slate-950">Researcher Registration</h1>
      <p className="mt-2 text-sm text-slate-500">Organizations start as Pending until an administrator approves export access.</p>
      <form onSubmit={submit} className="mt-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-mono">{success}</div>}
        {['registrationNumber', 'name', 'email', 'password'].map((name) => (
          <div key={name}>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">{name}</label>
                      <input
              type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
              value={form[name]}
              onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                        required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
        ))}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Purpose statement</label>
          <textarea value={form.purposeStatement} onChange={(e) => setForm({ ...form, purposeStatement: e.target.value })} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[100px]" />
                      </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
            {loading ? 'Submitting…' : 'Submit application'}
                            </button>
          <button type="button" onClick={() => go('login')} className="text-sm font-semibold text-slate-500">Sign in</button>
                  </div>
                </form>
    </div>
  );
}

export default App;
