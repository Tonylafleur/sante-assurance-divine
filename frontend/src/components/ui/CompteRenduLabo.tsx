import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseResultat } from '../../utils/labResult';

interface Props {
  patient: any;
  consultation?: any;
  examens: any[];
  onClose: () => void;
}

const STATUT_LABEL: Record<string, string> = {
  prescrit: 'Prescrit', en_cours: 'En cours',
  resultat_disponible: 'Résultat disponible', valide: 'Validé',
};

export const CompteRenduLabo: React.FC<Props> = ({ patient, consultation, examens, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const dateEdition = format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Compte-rendu d'analyses${patient ? ' — ' + patient.nom + ' ' + patient.prenom : ''}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; font-size:13px; padding:24px; }
        .entete { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #00897B; padding-bottom:12px; }
        .clinique { font-size:18px; font-weight:800; color:#00897B; text-transform:uppercase; }
        .sub { font-size:11px; color:#64748b; }
        .titre { text-align:center; font-size:16px; font-weight:700; margin:18px 0 4px; letter-spacing:1px; }
        .ref { text-align:center; font-size:11px; color:#64748b; margin-bottom:16px; }
        .infos { display:grid; grid-template-columns:1fr 1fr; gap:6px 24px; background:#f1f5f9; padding:12px 16px; border-radius:8px; margin-bottom:18px; font-size:12px; }
        .infos b { color:#475569; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        th { background:#00897B; color:#fff; text-align:left; padding:8px 10px; font-weight:600; }
        td { padding:8px 10px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
        tr:nth-child(even) td { background:#f8fafc; }
        .res { font-weight:700; }
        .grp { background:#e0f2f1; font-weight:700; color:#00695c; padding:6px 10px; font-size:11px; text-transform:uppercase; }
        .signature { margin-top:40px; display:flex; justify-content:flex-end; }
        .sigbox { text-align:center; font-size:11px; color:#64748b; border-top:1px solid #94a3b8; padding-top:6px; width:220px; }
        .pied { margin-top:30px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
        @media print { body { padding:0; } @page { margin:1.5cm; } }
      </style></head><body>${content.innerHTML}
      <script>window.onload=function(){window.print();setTimeout(function(){window.close();},300);}<\/script>
      </body></html>`);
    win.document.close();
  };

  // Regrouper par type d'examen
  const groupes: Record<string, any[]> = {};
  for (const e of examens) {
    const g = e.type_examen || 'Autre';
    (groupes[g] = groupes[g] || []).push(e);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">Aperçu du compte-rendu</h3>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2 text-sm py-1.5">
            <Printer size={15} /> Imprimer
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl p-2 bg-white overflow-auto max-h-[70vh]">
        <div ref={printRef} style={{ padding: '16px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#1e293b', fontSize: '13px' }}>
          {/* En-tête */}
          <div className="entete" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #00897B', paddingBottom: '12px' }}>
            <div>
              <div className="clinique" style={{ fontSize: '18px', fontWeight: 800, color: '#00897B', textTransform: 'uppercase' }}>Centre de Santé Assurance Divine</div>
              <div className="sub" style={{ fontSize: '11px', color: '#64748b' }}>Laboratoire d'Analyses Médicales — Yaoundé, Cameroun</div>
              <div className="sub" style={{ fontSize: '11px', color: '#64748b' }}>Tél: (+237) — Conforme MINSANTÉ</div>
            </div>
          </div>

          <div className="titre" style={{ textAlign: 'center', fontSize: '16px', fontWeight: 700, margin: '18px 0 4px', letterSpacing: '1px' }}>COMPTE-RENDU D'ANALYSES</div>
          <div className="ref" style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>Édité le {dateEdition}</div>

          {/* Infos patient */}
          <div className="infos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '12px' }}>
            <div><b>Patient :</b> {patient ? `${patient.nom} ${patient.prenom}` : '—'}</div>
            <div><b>Dossier :</b> {patient?.numero_dossier || '—'}</div>
            {patient?.sexe && <div><b>Sexe :</b> {patient.sexe === 'M' ? 'Masculin' : 'Féminin'}</div>}
            {consultation && <div><b>Consultation :</b> {consultation.numero}</div>}
          </div>

          {/* Tableau résultats */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ background: '#00897B', color: '#fff', textAlign: 'left', padding: '8px 10px' }}>Examen</th>
                <th style={{ background: '#00897B', color: '#fff', textAlign: 'left', padding: '8px 10px' }}>Résultat</th>
                <th style={{ background: '#00897B', color: '#fff', textAlign: 'left', padding: '8px 10px' }}>Valeurs de référence</th>
                <th style={{ background: '#00897B', color: '#fff', textAlign: 'left', padding: '8px 10px' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupes).map(([groupe, items]) => (
                <React.Fragment key={groupe}>
                  <tr><td className="grp" colSpan={4} style={{ background: '#e0f2f1', fontWeight: 700, color: '#00695c', padding: '6px 10px', fontSize: '11px', textTransform: 'uppercase' }}>{groupe}</td></tr>
                  {items.map((e, i) => {
                    const params = parseResultat(e.resultat);
                    if (params) {
                      return (
                        <React.Fragment key={i}>
                          <tr>
                            <td colSpan={4} style={{ padding: '8px 10px 4px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                              {e.libelle} <span style={{ fontWeight: 400, fontSize: '11px', color: '#64748b' }}>— {STATUT_LABEL[e.statut] || e.statut}</span>
                            </td>
                          </tr>
                          {params.map((p, j) => (
                            <tr key={`${i}-${j}`}>
                              <td style={{ padding: '6px 10px 6px 24px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{p.nom}</td>
                              <td className="res" style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                                {p.valeur ? `${p.valeur}${p.unite ? ' ' + p.unite : ''}` : '—'}
                              </td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }} colSpan={2}>{p.valeur_normale || '—'}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    }
                    return (
                      <tr key={i}>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>{e.libelle}</td>
                        <td className="res" style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                          {e.resultat ? `${e.resultat}${e.unite ? ' ' + e.unite : ''}` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{e.valeur_normale || '—'}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>{STATUT_LABEL[e.statut] || e.statut}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Signature */}
          <div className="signature" style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
            <div className="sigbox" style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #94a3b8', paddingTop: '6px', width: '220px' }}>
              Cachet et signature du laborantin
            </div>
          </div>

          <div className="pied" style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            Ce document est confidentiel et destiné exclusivement au patient et à son médecin traitant.
          </div>
        </div>
      </div>
    </div>
  );
};
