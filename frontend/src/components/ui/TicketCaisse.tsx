import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TicketProps {
  data: any;
  onClose: () => void;
}

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'EN ATTENTE DE PAIEMENT',
  partiellement_payee: 'PARTIELLEMENT PAYÉE',
  payee: 'PAYÉE - ACQUITTÉE',
  annulee: 'ANNULÉE',
};

const TYPE_ACTE_LABEL: Record<string, string> = {
  Consultation: 'Consultation',
  Pharmacie: 'Pharmacie',
  Laboratoire: 'Laboratoire',
  Hospitalisation: 'Hospitalisation',
  Vaccination: 'Vaccination',
  CPN: 'CPN',
  'Petite Chirurgie': 'Petite Chirurgie',
  Autre: 'Autre',
};

export const TicketCaisse: React.FC<TicketProps> = ({ data, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Ticket ${data.facture.numero}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; margin: 0 auto; padding: 8px; }
          .center { text-align: center; }
          .right  { text-align: right; }
          .bold   { font-weight: bold; }
          .big    { font-size: 14px; }
          .sep    { border-top: 1px dashed #000; margin: 6px 0; }
          .row    { display: flex; justify-content: space-between; margin: 2px 0; }
          .row-3  { display: grid; grid-template-columns: 1fr auto auto; gap: 4px; margin: 2px 0; }
          .badge-payee { border: 2px solid #000; text-align: center; padding: 4px; font-weight: bold; font-size: 13px; margin: 6px 0; }
          @media print { body { width: 80mm; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function(){ window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const { facture, patient, consultation, lignes, paiements } = data;
  const dateFacture = facture.created_at ? format(new Date(facture.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—';

  // Regrouper lignes par type
  const groupes: Record<string, any[]> = {};
  for (const l of lignes) {
    const g = l.type_acte || 'Autre';
    if (!groupes[g]) groupes[g] = [];
    groupes[g].push(l);
  }

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">Aperçu du ticket</h3>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2 text-sm py-1.5">
            <Printer size={15} /> Imprimer
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Aperçu ticket */}
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-2 bg-white overflow-auto max-h-[65vh]">
        <div ref={printRef} style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', width: '100%', maxWidth: '300px', margin: '0 auto', padding: '8px' }}>

          {/* En-tête clinique */}
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>Centre de Santé</div>
            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Assurance Divine</div>
            <div style={{ fontSize: '10px', marginTop: '2px' }}>Yaoundé — Cameroun</div>
            <div style={{ fontSize: '10px' }}>Tél: (+237) — MINSANTÉ</div>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Infos facture */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>REÇU N°:</span>
            <span style={{ fontWeight: 'bold' }}>{facture.numero}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Date:</span><span>{dateFacture}</span>
          </div>
          {facture.emis_par && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Émis par:</span><span>{facture.emis_par}</span>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Patient */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
              {patient ? `${patient.nom} ${patient.prenom}` : '—'}
            </div>
            {patient?.numero_dossier && <div>Dossier: {patient.numero_dossier}</div>}
            {patient?.telephone && <div>Tél: {patient.telephone}</div>}
          </div>

          {/* Consultation */}
          {consultation && (
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>
              Réf: {consultation.numero} — {consultation.service}
              {consultation.motif && <div>Motif: {consultation.motif}</div>}
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Lignes par groupe */}
          {Object.entries(groupes).map(([groupe, items]) => (
            <div key={groupe} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '3px' }}>
                {TYPE_ACTE_LABEL[groupe] || groupe}
              </div>
              {items.map((l, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ flex: 1, paddingRight: '4px' }}>{l.description}</span>
                    <span style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>{(l.montant || 0).toLocaleString('fr-FR')} F</span>
                  </div>
                  {l.quantite !== 1 && (
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      {l.quantite} × {(l.prix_unitaire || 0).toLocaleString('fr-FR')} F
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Totaux */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Total brut</span>
            <span>{(facture.montant_total || 0).toLocaleString('fr-FR')} F</span>
          </div>
          {facture.montant_remise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#555' }}>
              <span>Remise</span>
              <span>-{(facture.montant_remise || 0).toLocaleString('fr-FR')} F</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
            <span>TOTAL NET</span>
            <span>{(facture.montant_net || 0).toLocaleString('fr-FR')} FCFA</span>
          </div>

          {/* Paiements */}
          {paiements?.length > 0 && (
            <>
              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
              {paiements.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Reçu ({p.mode_paiement})</span>
                  <span>{(p.montant || 0).toLocaleString('fr-FR')} F</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Rendu monnaie</span>
                <span>{Math.max(0, (facture.montant_paye || 0) - (facture.montant_net || 0)).toLocaleString('fr-FR')} F</span>
              </div>
            </>
          )}

          {facture.montant_restant > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#c00' }}>
              <span>RESTANT DÛ</span>
              <span>{(facture.montant_restant || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

          {/* Statut */}
          <div style={{ border: '2px solid #000', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '12px', margin: '6px 0' }}>
            {STATUT_LABEL[facture.statut] || facture.statut?.toUpperCase()}
          </div>

          {/* Pied de page */}
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>
            <div>Merci de votre confiance</div>
            <div>Ce reçu fait foi de paiement</div>
            <div style={{ marginTop: '4px' }}>— Centre de Santé Assurance Divine —</div>
          </div>
        </div>
      </div>
    </div>
  );
};
