'use client';

import Header from "@/components/nagepro/Header";
import AttendanceEditor from "@/components/nagepro/AttendanceEditor";
import AuthGuard from "@/components/auth/AuthGuard";

function AttendancePageContent() {
  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6">
      <AttendanceEditor />
    </main>
  );
}


export default function AttendancePage() {
  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <Header />
      <AuthGuard>
        <AttendancePageContent />
      </AuthGuard>
    </div>
  );
}
