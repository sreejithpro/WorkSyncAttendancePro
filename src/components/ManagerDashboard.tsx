import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { AttendanceLog, AttendanceSummary } from '../types';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, startOfYear, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { ResponsiveContainer } from 'recharts';
import { Users, RefreshCw, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function ManagerDashboard() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AttendanceSummary>({ WFO: 0, WFH: 0, LEAVE: 0, total: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(1000));
      const querySnapshot = await getDocs(q);
      const fetchedLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog));
      setLogs(fetchedLogs);
      
      const start = startOfYear(new Date());
      const end = new Date();

      const ytdLogs = fetchedLogs.filter(log => {
        const logDate = new Date(log.date);
        return isWithinInterval(logDate, { start, end });
      });

      const newSummary = ytdLogs.reduce((acc, log) => {
        acc[log.type]++;
        acc.total++;
        return acc;
      }, { WFO: 0, WFH: 0, LEAVE: 0, total: 0 });

      setSummary(newSummary);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const withLeavesRate = summary.total > 0 ? Math.round(((summary.WFO + summary.LEAVE) / summary.total) * 100) : 0;
  const netOfficeRate = summary.total > 0 ? Math.round((summary.WFO / summary.total) * 100) : 0;

  const isAdmin = profile?.role === 'manager' || profile?.email === 'sreejithpro@gmail.com';

  if (!isAdmin) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <Users className="w-16 h-16 text-slate-200 mx-auto mb-6" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Access Limited</h3>
        <p className="text-slate-500 leading-relaxed">Only workspace managers have permission to view team attendance analytics and compliance reports.</p>
      </div>
    );
  }

  // Calendar Helper
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div id="manager-dashboard" className="space-y-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Stats Card - YTD */}
        <div className="lg:col-span-12">
          <div className="card p-8 border-slate-100 shadow-xl relative overflow-hidden bg-white">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-wrap gap-8">
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">With PH & Leaves</h3>
                    <div className="flex items-end gap-2 mb-2">
                      <span className={cn(
                        "text-6xl font-light tracking-tighter",
                        withLeavesRate <= 50 ? "text-red-600" : withLeavesRate < 60 ? "text-orange-500" : "text-emerald-600"
                      )}>{withLeavesRate}</span>
                      <span className="text-2xl text-slate-400 mb-2">%</span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">(WFO + Leave) / Total</p>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Net Office Presence</h3>
                    <div className="flex items-end gap-2 mb-2">
                      <span className={cn(
                        "text-6xl font-light tracking-tighter",
                        netOfficeRate <= 50 ? "text-red-600" : netOfficeRate < 60 ? "text-orange-500" : "text-emerald-600"
                      )}>{netOfficeRate}</span>
                      <span className="text-2xl text-slate-400 mb-2">%</span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">(WFO) / Total</p>
                  </div>
                </div>
                <button 
                  onClick={fetchData}
                  className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 active:scale-95"
                  title="Sync Data"
                >
                  <RefreshCw className={cn("w-5 h-5 text-indigo-600", loading && "animate-spin")} />
                </button>
              </div>
              
              <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${withLeavesRate}%` }}
                  className={cn(
                    "h-full rounded-full shadow-sm",
                    withLeavesRate <= 50 ? "bg-red-500" : withLeavesRate < 60 ? "bg-orange-500" : "bg-emerald-500"
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Office (WFO)</p>
                  <p className="text-xl font-semibold text-slate-900">{summary.WFO} <span className="text-xs font-normal text-slate-400">days</span></p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Remote (WFH)</p>
                  <p className="text-xl font-semibold text-slate-900">{summary.WFH} <span className="text-xs font-normal text-slate-400">days</span></p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Leave</p>
                  <p className="text-xl font-semibold text-slate-900">{summary.LEAVE} <span className="text-xs font-normal text-slate-400">days</span></p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100/50 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
          </div>
        </div>

        {/* Attendance Calendar Grid */}
        <div className="lg:col-span-12 card p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Attendance Calendar</h3>
                <p className="text-lg font-bold text-slate-800">{format(currentMonth, 'MMMM yyyy')}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={prevMonth}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-900 border border-slate-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-900 border border-slate-200"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Office</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Remote</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Leave</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-slate-50 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                {day}
              </div>
            ))}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white min-h-[80px]"></div>
            ))}
            {daysInMonth.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const log = logs.find(l => l.date === dayStr);
              return (
                <div 
                  key={dayStr} 
                  className={cn(
                    "bg-white min-h-[80px] p-2 flex flex-col gap-1 transition-all hover:bg-slate-50 group border-slate-100",
                    log?.type === 'WFO' && "bg-indigo-50/30",
                    log?.type === 'WFH' && "bg-emerald-50/30",
                    log?.type === 'LEAVE' && "bg-amber-50/30"
                  )}
                >
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all mb-1",
                    log ? "text-slate-900" : "text-slate-400"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {log && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider text-center",
                        log.type === 'WFO' ? "bg-indigo-600 text-white shadow-sm" :
                        log.type === 'WFH' ? "bg-emerald-500 text-white shadow-sm" :
                        "bg-amber-500 text-white shadow-sm"
                      )}
                    >
                      {log.type}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Table */}
        <div className="lg:col-span-12 card overflow-hidden border-0 shadow-sm">
          <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Detailed Record Stream</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{logs.length} Total Logs</span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Mode</th>
                  <th className="px-8 py-4 text-right">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-8 py-4 text-sm font-medium text-slate-600">
                      {format(new Date(log.date), 'MMMM dd, yyyy')}
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "text-[10px] font-extrabold px-3 py-1 rounded-lg uppercase tracking-widest",
                        log.type === 'WFO' ? "bg-indigo-50 text-indigo-700" :
                        log.type === 'WFH' ? "bg-emerald-50 text-emerald-700" :
                        "bg-amber-50 text-amber-700"
                      )}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right text-xs font-bold text-slate-400">
                      {log.timestamp ? format(log.timestamp.toDate(), 'hh:mm aa') : '--:--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
