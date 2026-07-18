import React, { useEffect, useMemo, useState } from 'react';
import MultiSelect from '../components/MultiSelect';
import { BD_DIVISIONS } from '../lib/constants';
import { authHeaders } from '../lib/session';

export default function ResearcherPortal({ go, session, persistSession }) {
  const [allDiseases, setAllDiseases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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

  const diseaseOptions = useMemo(() => {
    if (!categories.length) return allDiseases;
    return allDiseases.filter((d) => categories.includes(d.category));
  }, [allDiseases, categories]);

  useEffect(() => {
    const allowed = new Set(diseaseOptions.map((d) => d.code));
    setDiseases((prev) => {
      const next = prev.filter((c) => allowed.has(c));
      return next.length === prev.length ? prev : next;
    });
  }, [diseaseOptions]);

  if (!session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Research Portal</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with an approved research organization.</p>
        <button type="button" onClick={() => go('login')} className="mt-6 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-lg">Go to Sign In</button>
      </div>
    );
  }

  const download = () => {
    setLoading(true);
    setError('');
    setSuccess('');
    const q = new URLSearchParams();
    if (diseases.length) q.set('diseases', diseases.join(','));
    if (divisions.length) q.set('divisions', divisions.join(','));
    const qs = q.toString() ? `?${q.toString()}` : '';
    fetch(`/api/research/export${qs}`, { headers: authHeaders(session.token, false) })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Export failed');
        }
        const cd = res.headers.get('Content-Disposition') || '';
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] || 'anonymized_outbreak_data.json';
        const blob = await res.blob();
        return { blob, filename, isZip: filename.endsWith('.zip') || res.headers.get('Content-Type')?.includes('zip') };
      })
      .then(({ blob, filename, isZip }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        const scope = [
          diseases.length ? `${diseases.length} disease(s)` : 'all diseases',
          divisions.length ? `${divisions.length} division(s)` : 'all divisions'
        ].join(' · ');
        setSuccess(
          isZip
            ? `Download complete (${scope}). ZIP includes anonymized JSON plus any uploaded body-part photos.`
            : `Download complete (${scope}). No case photos in this export — JSON only.`
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Research Portal</h1>
          <p className="text-xs text-slate-500 mt-1">{session.organization.name} · Approved</p>
        </div>
        <button type="button" onClick={() => persistSession(null)} className="text-xs font-semibold border border-slate-200 px-3 py-2 rounded-lg">Log out</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-mono">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-mono">{success}</div>}
        <p className="text-xs text-slate-500">
          Select one or more diseases and divisions. Leave a filter empty to include all values for that field.
          If any cases include an uploaded body-part photo, the download is a ZIP with JSON plus an <span className="font-mono">images/</span> folder.
        </p>
        <MultiSelect
          label="Category filter (narrows disease list)"
          options={categoryOptions}
          selected={categories}
          onChange={(v) => {
            setCategories(v);
            setDiseases([]);
          }}
        />
        <MultiSelect
          label="Disease(s) for export"
          options={diseaseOptions}
          selected={diseases}
          onChange={setDiseases}
          getValue={(o) => o.code}
          getLabel={(o) => `${o.name} (${o.category})`}
        />
        <MultiSelect
          label="Division(s) for export"
          options={BD_DIVISIONS}
          selected={divisions}
          onChange={setDivisions}
        />
        <button type="button" onClick={download} disabled={loading} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
          {loading ? 'Preparing…' : 'Download anonymized data'}
        </button>
      </div>
    </div>
  );
}
