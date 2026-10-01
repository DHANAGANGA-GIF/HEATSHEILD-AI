'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, getCommunityReports } from '@/lib/store';
import { Download, Printer, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ReportsPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());
  const [exported, setExported] = useState(false);

  const handleExportCSV = () => {
    const reports = getCommunityReports();
    let csvContent = 'data:text/csv;charset=utf-8,ID,Category,Description,Status,Votes,Location,Timestamp\n';
    reports.forEach((r) => {
      csvContent += `"${r.id}","${r.category}","${r.description.replace(/"/g, '""')}","${r.status}",${r.votes_count},"${r.location.name}","${r.timestamp}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HeatShield_Audit_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Heat Safety Audit Reports</h1>
                <p className="text-xs text-slate-400 font-mono">
                  Export compliance CSV data &amp; print standardized heat risk assessment summaries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Summary</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {exported && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center gap-2 text-emerald-300 font-mono text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>CSV Audit Log exported successfully to your downloads folder.</span>
            </div>
          )}

          {/* Non-clinical disclaimer */}
          <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl flex items-start gap-2 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Decision Support Only:</strong> This report is generated for operational awareness purposes. It does not constitute medical diagnosis or a legal guarantee of safety.
            </span>
          </div>

          {/* Printable Report Card */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl space-y-6 print:bg-white print:text-black print:border-none print:shadow-none">
            <div className="border-b border-slate-800 print:border-slate-300 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold text-white print:text-black font-sans">HEATSHIELD AI — AUDIT REPORT SUMMARY</h2>
                <p className="text-xs text-slate-400 print:text-slate-600 font-mono mt-0.5">
                  Generated: {new Date().toLocaleDateString()} &nbsp;|&nbsp; Location: {profile.location?.name || 'Chennai, India'}
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-800 print:bg-slate-100 text-slate-300 print:text-slate-700 rounded border border-slate-700 print:border-slate-300">
                OFFICIAL REPORT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 print:text-slate-500">Target User / Organization:</span>
                <div className="font-bold text-white print:text-black mt-0.5">{profile.name || 'Demo User'} ({profile.role?.toUpperCase() || 'USER'})</div>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-500">Engine &amp; Data Stream:</span>
                <div className="font-bold text-white print:text-black mt-0.5">Rule-Based Heat Risk Engine v1.2 / Open-Meteo Live API</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">SUMMARY AUDIT METRICS</h4>
              <table className="w-full text-xs text-left font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-800/60 print:bg-slate-100 border-b border-slate-700 print:border-slate-300 text-slate-400 print:text-slate-600">
                    <th className="p-2.5 font-semibold">Metric</th>
                    <th className="p-2.5 font-semibold">Observed Value</th>
                    <th className="p-2.5 font-semibold">Compliance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  <tr>
                    <td className="p-2.5 text-slate-300 print:text-slate-800">Current Apparent Temperature</td>
                    <td className="p-2.5 text-white print:text-black font-bold">38.5°C (Sample)</td>
                    <td className="p-2.5 text-emerald-400 print:text-emerald-700 font-bold">MONITORED</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-300 print:text-slate-800">Evaluated Risk Score</td>
                    <td className="p-2.5 text-white print:text-black font-bold">76 / 100 (HIGH) — Sample</td>
                    <td className="p-2.5 text-amber-400 print:text-amber-700 font-bold">PRECAUTION REQUIRED</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-300 print:text-slate-800">Work-Rest Protocol Ratio</td>
                    <td className="p-2.5 text-white print:text-black font-bold">30 min Work / 30 min Rest</td>
                    <td className="p-2.5 text-emerald-400 print:text-emerald-700 font-bold">NIOSH COMPLIANT</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-800 print:border-slate-300 text-[11px] font-mono text-slate-500 print:text-slate-600">
              Disclaimer: HeatShield AI audit reports are for operational software decision support only. They do not constitute medical diagnosis or legal guarantee.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
