import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { AttendanceLog, AttendanceType } from '../types';
import { format, startOfYear, isBefore, isAfter, startOfDay, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Home, LogOut, CheckCircle2, Clock, Calendar as CalendarIcon, History, AlertCircle, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

export function AttendanceLogger() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isPastMode, setIsPastMode] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkStart, setBulkStart] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [bulkEnd, setBulkEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  const minDate = format(startOfYear(new Date()), 'yyyy-MM-dd');
  const maxDate = format(new Date(), 'yyyy-MM-dd');

  const fetchRecentLogs = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(31)
      );
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog));
      setRecentLogs(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
  }, [user]);

  const logAttendance = async (type: AttendanceType) => {
    if (!user || !profile) return;
    
    setLoading(true);
    const dateToLog = isPastMode ? selectedDate : format(new Date(), 'yyyy-MM-dd');

    try {
      // Check if future or too old
      const parsedDate = parseISO(dateToLog);
      if (isAfter(parsedDate, startOfDay(new Date())) || isBefore(parsedDate, startOfYear(new Date()))) {
        throw new Error('Date is outside of allowable range (Jan 1st - Today).');
      }

      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid),
        where('date', '==', dateToLog)
      );
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        // If it exists, we update the existing record instead of warning (as per user's "update" request)
        const existingDoc = existing.docs[0];
        const existingData = existingDoc.data();
        const batch = writeBatch(db);
        batch.set(doc(db, 'attendance', existingDoc.id), {
          ...existingData,
          type,
          timestamp: serverTimestamp(),
          notes: isPastMode ? 'Updated record' : 'Updated today',
        }, { merge: true });
        await batch.commit();
        setSuccessMessage(`Updated log to ${type} for ${dateToLog}!`);
      } else {
        await addDoc(collection(db, 'attendance'), {
          userId: user.uid,
          userName: profile.name,
          userEmail: profile.email,
          date: dateToLog,
          type,
          timestamp: serverTimestamp(),
          notes: isPastMode ? 'Backdated entry' : '',
        });
        setSuccessMessage(`Logged as ${type} for ${dateToLog}!`);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
      fetchRecentLogs();
      if (isPastMode) setIsPastMode(false);
    } catch (error: any) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        handleFirestoreError(error, 'write', '/attendance');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkLog = async (type: AttendanceType) => {
    if (!user || !profile) return;
    
    setLoading(true);
    try {
      const start = parseISO(bulkStart);
      const end = parseISO(bulkEnd);

      if (isAfter(start, end)) {
        throw new Error('Start date cannot be after end date.');
      }

      const interval = eachDayOfInterval({ start, end });
      const datesToProcess = interval.filter(d => {
        if (isWeekend(d) && excludeWeekends) return false;
        if (isAfter(d, startOfDay(new Date()))) return false;
        if (isBefore(d, startOfYear(new Date()))) return false;
        return true;
      });

      if (datesToProcess.length === 0) {
        throw new Error('No valid dates in range to process.');
      }

      if (datesToProcess.length > 31) {
        throw new Error('Bulk update is limited to 31 days at a time.');
      }

      const batch = writeBatch(db);
      
      // Fetch all of the user's logs for the year to filter in memory - avoids composite index requirement
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(500) // Max logs for a year is plenty
      );
      const existingSnapshot = await getDocs(q);
      const existingRecords = new Map(existingSnapshot.docs.map(doc => [doc.data().date, { id: doc.id, data: doc.data() }]));

      datesToProcess.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existing = existingRecords.get(dateStr);

        if (existing) {
          batch.set(doc(db, 'attendance', existing.id), {
            ...existing.data,
            type,
            timestamp: serverTimestamp(),
            notes: 'Bulk updated record',
          }, { merge: true });
        } else {
          const newDocRef = doc(collection(db, 'attendance'));
          batch.set(newDocRef, {
            userId: user.uid,
            userName: profile.name,
            userEmail: profile.email,
            date: dateStr,
            type,
            timestamp: serverTimestamp(),
            notes: 'Bulk entry',
          });
        }
      });

      await batch.commit();
      setSuccessMessage(`Successfully updated ${datesToProcess.length} records to ${type}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchRecentLogs();
      setIsBulkMode(false);
    } catch (error: any) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        handleFirestoreError(error, 'write', '/attendance');
      }
    } finally {
      setLoading(false);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = recentLogs.find(log => log.date === todayStr);

  return (
    <div id="attendance-logger" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-12">
        <div className="card p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h3 className="text-2xl font-semibold text-slate-800">
              {isBulkMode ? 'Bulk Update Records' : isPastMode ? 'Log Past Attendance' : 'Where are you working today?'}
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setIsPastMode(false);
                }}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                  isBulkMode ? "text-indigo-800 underline" : "text-slate-400 hover:text-indigo-600"
                )}
              >
                <Layers className="w-4 h-4" />
                {isBulkMode ? 'Exit Bulk Mode' : 'Bulk Actions'}
              </button>
              <button
                onClick={() => {
                  setIsPastMode(!isPastMode);
                  setIsBulkMode(false);
                  setSelectedDate(todayStr);
                }}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                  isPastMode ? "text-indigo-800 underline" : "text-slate-400 hover:text-indigo-600"
                )}
              >
                {isPastMode ? <Clock className="w-4 h-4" /> : <History className="w-4 h-4" />}
                {isPastMode ? 'Exit History Mode' : 'Log Past Day'}
              </button>
            </div>
          </div>
          
          <AnimatePresence mode="wait">
            {isBulkMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-6 bg-slate-50 rounded-2xl border border-dotted border-indigo-300"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Start Date</label>
                    <input
                      type="date"
                      min={minDate}
                      max={maxDate}
                      value={bulkStart}
                      onChange={(e) => setBulkStart(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">End Date</label>
                    <input
                      type="date"
                      min={bulkStart}
                      max={maxDate}
                      value={bulkEnd}
                      onChange={(e) => setBulkEnd(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mb-8 p-4 bg-white rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="excludeWeekends"
                    checked={excludeWeekends}
                    onChange={(e) => setExcludeWeekends(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="excludeWeekends" className="text-sm text-slate-600 font-medium cursor-pointer">
                    Exclude weekends (Saturday & Sunday)
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    disabled={loading}
                    onClick={() => handleBulkLog('WFO')}
                    className="p-4 bg-indigo-600 text-white rounded-xl font-bold flex flex-col items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <MapPin className="w-5 h-5" />
                    <span>Apply WFO</span>
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleBulkLog('WFH')}
                    className="p-4 bg-emerald-500 text-white rounded-xl font-bold flex flex-col items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Home className="w-5 h-5" />
                    <span>Apply WFH</span>
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleBulkLog('LEAVE')}
                    className="p-4 bg-amber-500 text-white rounded-xl font-bold flex flex-col items-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Apply LEAVE</span>
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  <AlertCircle className="w-3 h-3" />
                  Existing records in this range will be updated.
                </div>
              </motion.div>
            )}

            {isPastMode && !isBulkMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200"
              >
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Date</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex-1 w-full p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                      You can log records back to <span className="font-bold">January 1st, {new Date().getFullYear()}</span>. Future dates are restricted.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {todayLog && !isPastMode ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-indigo-50 border-2 border-indigo-600/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-xl font-bold text-indigo-900 mb-1">Checked In Successfully</p>
              <p className="text-indigo-600 font-medium">Logged as <span className="font-extrabold">{todayLog.type}</span></p>
              <div className="mt-6 flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" />
                Logged at {todayLog.timestamp ? format(todayLog.timestamp.toDate(), 'hh:mm aa') : '08:42 AM'}
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <button
                onClick={() => logAttendance('WFO')}
                disabled={loading}
                className="group p-8 rounded-2xl border-2 border-transparent bg-slate-50 hover:bg-white hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all flex flex-col items-center justify-center gap-4 active:scale-95"
              >
                <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <MapPin className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-900 uppercase tracking-widest transition-colors">Office</span>
              </button>
              
              <button
                onClick={() => logAttendance('WFH')}
                disabled={loading}
                className="group p-8 rounded-2xl border-2 border-transparent bg-slate-50 hover:bg-white hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all flex flex-col items-center justify-center gap-4 active:scale-95"
              >
                <div className="p-4 bg-slate-200 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Home className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-900 uppercase tracking-widest transition-colors">Remote</span>
              </button>

              <button
                onClick={() => logAttendance('LEAVE')}
                disabled={loading}
                className="group p-8 rounded-2xl border-2 border-transparent bg-slate-50 hover:bg-white hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all flex flex-col items-center justify-center gap-4 active:scale-95"
              >
                <div className="p-4 bg-slate-200 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <LogOut className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-900 uppercase tracking-widest transition-colors">Leave</span>
              </button>
            </div>
          )}

          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 bg-emerald-500 text-white rounded-xl text-center font-bold text-sm shadow-lg shadow-emerald-100"
              >
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="lg:col-span-12">
        <div className="card p-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Recent History</h3>
          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <p className="text-slate-400 text-center py-8 italic">No attendance records found yet.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 rounded-xl transition-colors border border-slate-100 group">
                  <div className="flex gap-4 items-center">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full ring-4 ring-offset-2",
                      log.type === 'WFO' ? "bg-indigo-500 ring-indigo-50" :
                      log.type === 'WFH' ? "bg-emerald-400 ring-emerald-50" :
                      "bg-amber-400 ring-amber-50"
                    )}></div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">{format(new Date(log.date), 'EEEE, MMM dd, yyyy')}</span>
                      {log.notes && <span className="text-[10px] text-slate-400 italic">{log.notes}</span>}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-extrabold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors shadow-sm",
                    log.type === 'WFO' ? "bg-indigo-600 text-white" :
                    log.type === 'WFH' ? "bg-emerald-500 text-white" :
                    "bg-amber-500 text-white"
                  )}>
                    {log.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
