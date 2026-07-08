import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Stethoscope, AlertTriangle, Pill, User, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../services/api';
import { useT } from '../i18n';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { icon: AlertTriangle, labelKey: 'assist.qa_urgence', promptKey: 'assist.qp_urgence' },
  { icon: Stethoscope, labelKey: 'assist.qa_diag', promptKey: 'assist.qp_diag' },
  { icon: Pill, labelKey: 'assist.qa_ttt', promptKey: 'assist.qp_ttt' },
  { icon: User, labelKey: 'assist.qa_edu', promptKey: 'assist.qp_edu' },
];

export const AssistantIA: React.FC = () => {
  const { t } = useT();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('assist.welcome'),
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [triageMode, setTriageMode] = useState(false);
  const [triageInput, setTriageInput] = useState('');
  const [triageResult, setTriageResult] = useState<any>(null);
  const [aiInfo, setAiInfo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { aiApi.status().then(r => setAiInfo(r.data)).catch(() => {}); }, []);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    const userMsg: Message = { role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await aiApi.chat(allMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response, timestamp: new Date() }]);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'L\'assistant est temporairement indisponible.';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date() }]);
    }
    setLoading(false);
  };

  const handleTriage = async () => {
    if (!triageInput.trim()) { toast.error(t('ts.describe_sympt')); return; }
    setLoading(true);
    try {
      const res = await aiApi.triage(triageInput);
      setTriageResult(res.data);
    } catch {
      toast.error(t('ts.triage_error'));
    }
    setLoading(false);
  };

  const URGENCE_COLORS: Record<string, string> = {
    vert: 'bg-green-50 border-green-300 text-green-800',
    jaune: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    orange: 'bg-orange-50 border-orange-300 text-orange-800',
    rouge: 'bg-red-50 border-red-300 text-red-800',
  };

  const formatMessage = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const bullet = bold.startsWith('- ') ? `<li class="ml-4">• ${bold.slice(2)}</li>` : `<p>${bold}</p>`;
        return <div key={i} dangerouslySetInnerHTML={{ __html: bullet }} />;
      });
  };

  return (
    <div className="space-y-5 fade-in h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bot size={24} className="text-primary-500" /> {t('assist.title')}
          </h1>
          <p className="text-slate-500 text-sm">{t('assist.subtitle')}</p>
          {aiInfo && (
            <span className={`inline-flex items-center gap-1.5 mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
              !aiInfo.disponible ? 'bg-red-50 text-red-600'
                : aiInfo.provider === 'ollama' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${aiInfo.disponible ? 'bg-current animate-pulse' : 'bg-current'}`} />
              {aiInfo.label}{aiInfo.modele ? ` · ${aiInfo.modele}` : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setTriageMode(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!triageMode ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            💬 {t('assist.chat')}
          </button>
          <button
            onClick={() => { setTriageMode(true); setTriageResult(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${triageMode ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            🚦 {t('assist.triage')}
          </button>
        </div>
      </div>

      {!triageMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 h-[calc(100vh-200px)]">
          {/* Actions rapides */}
          <div className="lg:col-span-1 space-y-3">
            <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{t('assist.quick')}</p>
            {QUICK_ACTIONS.map(({ icon: Icon, labelKey, promptKey }) => (
              <button
                key={labelKey}
                onClick={() => setInput(t(promptKey))}
                className="w-full text-left p-3 card hover:border-primary-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className="text-primary-500" />
                  <span className="text-sm font-medium text-slate-700">{t(labelKey)}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{t(promptKey)}...</p>
              </button>
            ))}
            <div className="card bg-accent-50 border-accent-200">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-accent-600" />
                <span className="text-sm font-semibold text-accent-700">Note importante</span>
              </div>
              <p className="text-xs text-accent-600">{t('assist.note')}</p>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-3 flex flex-col card !p-0 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary-500' : 'bg-secondary-500'}`}>
                    {msg.role === 'assistant' ? <Bot size={16} className="text-white" /> : <User size={16} className="text-white" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'assistant' ? 'bg-slate-50 text-slate-800 rounded-tl-sm' : 'bg-primary-500 text-white rounded-tr-sm'}`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none space-y-1">{formatMessage(msg.content)}</div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                    <p className={`text-xs mt-2 ${msg.role === 'assistant' ? 'text-slate-400' : 'text-white/60'}`}>
                      {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center"><Bot size={16} className="text-white" /></div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-4">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={t('assist.ask_ph')}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  disabled={loading}
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="btn-primary px-4">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mode Triage */
        <div className="max-w-2xl space-y-5">
          <div className="card">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" /> {t('assist.tri_title')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">{t('assist.tri_sympt')}</label>
                <textarea
                  className="input h-28 resize-none"
                  value={triageInput}
                  onChange={e => setTriageInput(e.target.value)}
                />
              </div>
              <button onClick={handleTriage} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={16} />}
                {t('assist.tri_btn')}
              </button>
            </div>
          </div>

          {triageResult && (
            <div className={`card border-2 fade-in ${URGENCE_COLORS[triageResult.niveau] || 'bg-slate-50 border-slate-300'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-70">{t('assist.tri_level')}</p>
                  <p className="text-3xl font-bold uppercase">{t(`badge.${triageResult.niveau}`, triageResult.niveau)}</p>
                </div>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl ${
                  triageResult.niveau === 'rouge' ? 'bg-red-500 text-white' :
                  triageResult.niveau === 'orange' ? 'bg-orange-500 text-white' :
                  triageResult.niveau === 'jaune' ? 'bg-yellow-400 text-white' : 'bg-green-500 text-white'
                }`}>
                  {triageResult.score_urgence || '?'}/10
                </div>
              </div>
              <p className="text-sm font-medium mb-4">{triageResult.raison}</p>

              {triageResult.actions_immediates?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide mb-1">{t('assist.tri_actions')}</p>
                  <ul className="space-y-1">{triageResult.actions_immediates.map((a: string, i: number) => (
                    <li key={i} className="text-sm flex gap-2"><span>→</span>{a}</li>
                  ))}</ul>
                </div>
              )}
              {triageResult.diagnostics_possibles?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide mb-1">{t('assist.tri_diags')}</p>
                  <ul className="space-y-1">{triageResult.diagnostics_possibles.map((d: string, i: number) => (
                    <li key={i} className="text-sm flex gap-2"><span>•</span>{d}</li>
                  ))}</ul>
                </div>
              )}
              {triageResult.examens_recommandes?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1">{t('assist.tri_exams')}</p>
                  <ul className="space-y-1">{triageResult.examens_recommandes.map((e: string, i: number) => (
                    <li key={i} className="text-sm flex gap-2"><span>🔬</span>{e}</li>
                  ))}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
