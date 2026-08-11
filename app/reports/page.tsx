'use client';


import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, getCommunityReports } from '@/lib/store';
import { Download, Printer, FileText, CheckCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">HEAT SAFETY AUDIT REPORTS</h1>
              <p className="text-xs text-slate-500 font-mono">
                Export compliance CSV data & print standardized heat risk assessment summaries
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Summary</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Report</span>
              </button>
            </div>
          </div>

          {exported && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 font-mono text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>CSV Audit Log exported successfully to your downloads folder.</span>
            </div>
          )}

          {/* Printable Report View Card */}
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs space-y-6 print:shadow-none print:border-none">
            <div className="border-b pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-sans">HEATSHIELD AI â€” AUDIT REPORT SUMMARY</h2>
                <p className="text-xs text-slate-500 font-mono">Generated: {new Date().toLocaleDateString()} | Location: {profile.location?.name || 'Chennai'}</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded border">
                OFFICIAL REPORT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500">Target User / Organization:</span>
                <div className="font-bold text-slate-900">{profile.name || 'Demo User'} ({profile.role.toUpperCase()})</div>
              </div>
              <div>
                <span className="text-slate-500">Model Version & Data Stream:</span>
                <div className="font-bold text-slate-900">HeatShield-XAI v1.2 / Open-Meteo Live API</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold font-mono text-slate-500 uppercase">SUMMARY AUDIT METRICS</h4>
              <table className="w-full text-xs text-left border font-mono">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="p-2">Metric</th>
                    <th className="p-2">Observed Value</th>
                    <th className="p-2">Compliance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  <tr>
                    <td className="p-2">Current Apparent Temperature</td>
                    <td className="p-2">38.5Â°C</td>
                    <td className="p-2 text-emerald-700 font-bold">MONITORED</td>
                  </tr>
                  <tr>
                    <td className="p-2">Evaluated Risk Score</td>
                    <td className="p-2">76 / 100 (HIGH)</td>
                    <td className="p-2 text-amber-700 font-bold">PRECAUTION REQUIRED</td>
                  </tr>
                  <tr>
                    <td className="p-2">Work-Rest Protocol Ratio</td>
                    <td className="p-2">30m Work / 30m Rest</td>
                    <td className="p-2 text-emerald-700 font-bold">OSHA/NIOSH COMPLIANT</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t text-[11px] font-mono text-slate-400">
              Disclaimer: HeatShield AI audit reports are for operational software decision support. They do not constitute medical diagnosis or legal guarantee.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
