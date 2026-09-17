import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Code,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  Globe,
  Sparkles
} from 'lucide-react';

const GoogleFormModal = ({ isOpen, onClose }) => {
  const [formUrl, setFormUrl] = useState(() => {
    return localStorage.getItem('fueltracks_google_form_url') || '';
  });
  const [isEditingUrl, setIsEditingUrl] = useState(() => {
    const saved = localStorage.getItem('fueltracks_google_form_url');
    return !saved || saved.includes('EXAMPLE_FORM_ID');
  });
  const [tempUrl, setTempUrl] = useState(formUrl);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [activeTab, setActiveTab] = useState('share'); // 'share' | 'script'
  const [urlError, setUrlError] = useState('');

  if (!isOpen) return null;

  const backendUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
  const webhookUrl = `${backendUrl}/api/mining-registrations/google-form-webhook`;

  const handleSaveUrl = () => {
    const cleanUrl = tempUrl.trim();
    if (!cleanUrl) {
      setUrlError('Please enter your Google Form URL.');
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setUrlError('URL must start with https:// (e.g. https://forms.gle/...)');
      return;
    }
    setUrlError('');
    setFormUrl(cleanUrl);
    localStorage.setItem('fueltracks_google_form_url', cleanUrl);
    setIsEditingUrl(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const googleAppsScriptCode = `/**
 * FuelTracks Google Form Auto-Sync Script
 * Automatically feeds submitted form data directly into FuelTracks Admin Panel
 */
function onFormSubmit(e) {
  var webhookUrl = "${webhookUrl}";
  
  var formResponse = e.response;
  var itemResponses = formResponse.getItemResponses();
  
  var payload = {
    submitted_by_email: formResponse.getRespondentEmail() || "",
    timestamp: formResponse.getTimestamp()
  };
  
  for (var i = 0; i < itemResponses.length; i++) {
    var itemResponse = itemResponses[i];
    var title = itemResponse.getItem().getTitle();
    var response = itemResponse.getResponse();
    
    // Check if response is file upload array (Google Drive file IDs)
    if (Array.isArray(response)) {
      payload[title] = response.map(function(id) {
        return "https://drive.google.com/open?id=" + id;
      }).join(", ");
    } else {
      payload[title] = response;
    }
  }
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(webhookUrl, options);
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 p-6 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Automated Sync
              </span>
              <span className="flex items-center gap-1 text-[11px] text-orange-100 font-semibold">
                <Sparkles size={13} /> Live Admin Panel Feed
              </span>
            </div>
            <h2 className="text-xl font-black mt-2 text-white flex items-center gap-2">
              <Globe size={22} /> Google Form Integration
            </h2>
            <p className="text-xs text-orange-100 mt-0.5">
              Send this link to field technicians and dealers. Form submissions sync automatically into your Admin Panel.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-3 gap-3">
          <button
            onClick={() => setActiveTab('share')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'share'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 size={14} /> Share Form Link
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code size={14} /> Webhook & Apps Script Setup
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'share' ? (
            <div className="space-y-6">
              {/* Form URL Box */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                    Technician & Dealer Google Form Link
                  </span>
                  <button
                    onClick={() => {
                      setTempUrl(formUrl);
                      setIsEditingUrl(!isEditingUrl);
                    }}
                    className="text-xs text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Settings size={12} />
                    {isEditingUrl ? 'Cancel Edit' : 'Edit URL'}
                  </button>
                </div>

                {isEditingUrl || !formUrl ? (
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-orange-200">
                    <p className="text-xs text-slate-600">
                      Paste the link to your Google Form below (e.g. <span className="font-mono text-orange-600 font-bold">https://forms.gle/...</span> or <span className="font-mono text-orange-600 font-bold">https://docs.google.com/forms/d/e/.../viewform</span>):
                    </p>
                    <input
                      type="url"
                      value={tempUrl}
                      onChange={(e) => {
                        setTempUrl(e.target.value);
                        setUrlError('');
                      }}
                      placeholder="https://forms.gle/..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none font-mono ${
                        urlError ? 'border-rose-400 bg-rose-50/40' : 'border-orange-300 bg-orange-50/20 focus:ring-2 focus:ring-orange-200'
                      }`}
                    />
                    {urlError && (
                      <p className="text-xs text-rose-600 font-medium">{urlError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveUrl}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Save Form Link
                      </button>
                      {formUrl && (
                        <button
                          onClick={() => setIsEditingUrl(false)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="w-full flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-700 truncate select-all">
                      {formUrl}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                        {copiedLink ? 'Copied!' : 'Copy Link'}
                      </button>
                      <a
                        href={formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors shrink-0"
                        title="Open in new tab"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl space-y-1">
                  <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="font-bold text-slate-800 pt-1">Copy & Share</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Send this link via WhatsApp, SMS, or Email to technicians or dealers.
                  </p>
                </div>

                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl space-y-1">
                  <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="font-bold text-slate-800 pt-1">Technician Fills Form</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    They fill in vehicle details, upload RC, Aadhar, and photo copies on Google Forms.
                  </p>
                </div>

                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl space-y-1">
                  <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="font-bold text-slate-800 pt-1">Appears in Admin</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Details immediately populate in your FuelTracks Registrations dashboard for 1-click review.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Webhook URL */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                  FuelTracks Ingestion Webhook URL
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-700"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="px-3.5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedWebhook ? <Check size={13} /> : <Copy size={13} />}
                    {copiedWebhook ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Step by Step instructions */}
              <div className="space-y-3 text-xs text-slate-700">
                <h4 className="font-extrabold text-slate-900 text-sm">
                  How to Connect Google Form in 2 Minutes:
                </h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                  <li>Open your Google Form in your browser.</li>
                  <li>Click the three dots <span className="font-bold text-slate-800">(⋮)</span> menu on the top right and select <span className="font-bold text-slate-800">Script editor</span> (or <span className="font-bold text-slate-800">Extensions &gt; Apps Script</span> in the linked Google Sheet).</li>
                  <li>Delete any placeholder code and paste the code snippet below.</li>
                  <li>Click <span className="font-bold text-slate-800">Save (💾)</span>.</li>
                  <li>Click on <span className="font-bold text-slate-800">Triggers (⏰ Clock icon)</span> on the left bar &gt; click <span className="font-bold text-slate-800">Add Trigger</span>.</li>
                  <li>Choose <span className="font-bold text-slate-800">onFormSubmit</span> as the function, and set <span className="font-bold text-slate-800">Event type</span> to <span className="font-bold text-slate-800">On form submit</span>, then click Save.</li>
                </ol>
              </div>

              {/* Code Snippet Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Google Apps Script Code</span>
                  <button
                    onClick={handleCopyScript}
                    className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedScript ? <Check size={13} /> : <Copy size={13} />}
                    {copiedScript ? 'Code Copied!' : 'Copy Script Code'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed border border-slate-800">
                  {googleAppsScriptCode}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            FuelTracks Compliance & Onboarding
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleFormModal;
