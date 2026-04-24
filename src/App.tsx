import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AttendanceLogger } from './components/AttendanceLogger';
import { ManagerDashboard } from './components/ManagerDashboard';
import { User, LogOut, LayoutDashboard, ClipboardList, LogIn, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { format } from 'date-fns';

function AppContent() {
  const { user, profile, loading, signIn, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'log' | 'reports'>('log');

  const isAdmin = profile?.role === 'manager' || user?.email === 'sreejithpro@gmail.com';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing WorkSync...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100"
        >
          <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">WorkSync</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">Attendance tracking redefined for the modern workplace.</p>
          
          <button
            onClick={signIn}
            className="w-full btn-primary py-4 flex items-center justify-center gap-3 text-lg"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          
          <p className="mt-6 text-sm text-slate-400">
            Secure enterprise authentication. Your data is protected.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-72 border-r border-slate-200 bg-white p-8 flex flex-col justify-between hidden md:flex shrink-0">
        <div className="space-y-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-indigo-600 rounded-md"></div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">WorkSync</h1>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-[0.2em] font-bold">Attendance Pro</p>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('log')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all",
                activeTab === 'log' ? "bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <ClipboardList className="w-5 h-5" />
              Daily Log
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('reports')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all",
                  activeTab === 'reports' ? "bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <LayoutDashboard className="w-5 h-5" />
                Team Reports
              </button>
            )}
          </nav>
        </div>

        <div className="space-y-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account</p>
            <div className="flex items-center gap-3 mb-4">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-white shadow-sm" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{profile?.name}</p>
                <p className="text-[10px] text-slate-500 capitalize">{profile?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:shadow-sm hover:text-red-600 hover:border-red-100 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-12 relative">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <h2 className="text-4xl font-light text-slate-900 tracking-tight">
              Good morning, <span className="font-bold">{profile?.name?.split(' ')[0]}</span>.
            </h2>
            <p className="text-slate-400 font-medium mt-1">
              {format(new Date(), 'EEEE, MMMM do, yyyy')}
            </p>
          </div>
          
          {/* Mobile Profile Toggle or additional actions could go here */}
        </header>

        <div className="max-w-4xl">
          <AnimatePresence mode="wait">
            {activeTab === 'log' ? (
              <motion.div
                key="logger"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <AttendanceLogger />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ManagerDashboard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
