import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Paperclip, Upload, FileText, Download, User2, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { teleconsultationApi } from '../services/api';
import { useT } from '../i18n';

type Mode = { mode: 'staff'; rdvId: number } | { mode: 'patient'; token: string };

function humanSize(n: number): string {
  if (!n) return '0 o';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

export const DocumentsPanel: React.FC<Mode> = (props) => {
  const { t } = useT();
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = props.mode === 'staff'
        ? await teleconsultationApi.listDocuments(props.rdvId)
        : await teleconsultationApi.listDocumentsPatient(props.token);
      setDocs(res.data.documents || []);
    } catch { /* silencieux */ }
  }, [props]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      if (props.mode === 'staff') await teleconsultationApi.uploadDocument(props.rdvId, file);
      else await teleconsultationApi.uploadDocumentPatient(props.token, file);
      toast.success(t('tc.doc_uploaded'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('ts.error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const open = async (d: any) => {
    try {
      const res = props.mode === 'staff'
        ? await teleconsultationApi.downloadDocument(props.rdvId, d.id)
        : await teleconsultationApi.downloadDocumentPatient(props.token, d.id);
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast.error(t('ts.error')); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2"><Paperclip size={15} /> {t('tc.documents')}</h3>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
          <Upload size={13} /> {uploading ? t('c.saving') : t('tc.doc_add')}
        </button>
        <input ref={fileRef} type="file" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {docs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">{t('tc.doc_none')}</p>
        ) : docs.map(d => (
          <button key={d.id} onClick={() => open(d)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 text-left">
            <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-primary-500" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{d.nom_fichier}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                {d.source === 'patient' ? <User2 size={10} /> : <Stethoscope size={10} />}
                {d.source === 'patient' ? t('tc.from_patient') : (d.depose_par || t('tc.from_staff'))}
                <span>· {humanSize(d.taille)}</span>
              </p>
            </div>
            <Download size={15} className="text-slate-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
