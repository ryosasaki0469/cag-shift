import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Users, Home, AlertCircle, Plus, Trash2, 
  CheckCircle2, ChevronLeft, ChevronRight, Download, Upload, Cloud, RefreshCw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, deleteDoc } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'golf-shift-app';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [shifts, setShifts] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  
  // State for the currently displayed month
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [newStoreName, setNewStoreName] = useState('');
  const [newCoachName, setNewCoachName] = useState('');

  // --- 1. Authentication Setup ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Authentication error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Data Subscription (Firestore) ---
  useEffect(() => {
    if (!user) return;

    // Subscribe to Stores
    const storesRef = collection(db, 'artifacts', appId, 'public', 'data', 'stores');
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Default stores if none exist in cloud
      setStores(data.length > 0 ? data : [
        { id: 'st_1', name: '亀有' },
        { id: 'st_2', name: '神田' },
        { id: 'st_3', name: '木場' },
        { id: 'st_4', name: '大岡山' },
        { id: 'st_5', name: '戸越公園' },
        { id: 'st_6', name: '高円寺' },
        { id: 'st_7', name: '三軒屋' },
        { id: 'st_8', name: '本八幡' },
        { id: 'st_9', name: '市川' },
        { id: 'st_10', name: '立川' }
      ]);
    }, (err) => console.error("Stores fetch error:", err));

    // Subscribe to Coaches
    const coachesRef = collection(db, 'artifacts', appId, 'public', 'data', 'coaches');
    const unsubCoaches = onSnapshot(coachesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Updated Default Coaches list
      setCoaches(data.length > 0 ? data : [
        { id: 'c1', name: '清水' },
        { id: 'c2', name: '荒谷' },
        { id: 'c3', name: '金松' },
        { id: 'c4', name: '岡田' },
        { id: 'c5', name: '豊福' },
        { id: 'c6', name: '向坂' }
      ]);
    }, (err) => console.error("Coaches fetch error:", err));

    // Subscribe to Shift Data
    const shiftsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'shifts', 'main');
    const unsubShifts = onSnapshot(shiftsDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setShifts(snapshot.data());
      }
    }, (err) => console.error("Shifts fetch error:", err));

    return () => {
      unsubStores();
      unsubCoaches();
      unsubShifts();
    };
  }, [user]);

  // --- Helpers ---
  const formatDate = (date) => date.toISOString().split('T')[0];
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysCount; i++) days.push(new Date(year, month, i));
    return days;
  };
  const days = useMemo(() => getDaysInMonth(viewDate), [viewDate]);

  // Conflict Detection (Multiple stores for one coach on the same day)
  const conflicts = useMemo(() => {
    const conflictMap = {};
    Object.entries(shifts).forEach(([key, coachId]) => {
      if (!coachId) return;
      const date = key.split('_')[0];
      const conflictKey = `${date}_${coachId}`;
      conflictMap[conflictKey] = (conflictMap[conflictKey] || 0) + 1;
    });
    return conflictMap;
  }, [shifts]);

  // --- Firestore Operations ---
  const saveShifts = async (newShifts) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'shifts', 'main'), newShifts);
    } catch (err) {
      console.error("Save shifts error:", err);
    }
  };

  const handleShiftChange = (date, storeId, coachId) => {
    const key = `${formatDate(date)}_${storeId}`;
    const newShifts = { ...shifts, [key]: coachId };
    setShifts(newShifts);
    saveShifts(newShifts);
  };

  const addStore = async () => {
    if (!newStoreName.trim() || !user) return;
    const id = `s${Date.now()}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stores', id), { name: newStoreName });
    setNewStoreName('');
  };

  const removeStore = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stores', id));
    } catch (err) {
      console.error("Delete store error:", err);
    }
  };

  const addCoach = async () => {
    if (!newCoachName.trim() || !user) return;
    const id = `c${Date.now()}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'coaches', id), { name: newCoachName });
    setNewCoachName('');
  };

  const removeCoach = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'coaches', id));
    } catch (err) {
      console.error("Delete coach error:", err);
    }
  };

  const changeMonth = (offset) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  // --- Import/Export ---
  const handleImport = async () => {
    const rows = importText.trim().split('\n').map(row => row.split('\t'));
    if (rows.length < 2) return;

    const newShifts = { ...shifts };
    const headerDates = rows[0].slice(1).map(d => d.trim());

    rows.slice(1).forEach(row => {
      const storeName = row[0].trim();
      const store = stores.find(s => s.name === storeName);
      if (!store) return;
      row.slice(1).forEach((coachName, index) => {
        const dateStr = headerDates[index];
        if (!dateStr) return;
        const coach = coaches.find(c => c.name === coachName.trim());
        newShifts[`${dateStr}_${store.id}`] = coach ? coach.id : '';
      });
    });

    setShifts(newShifts);
    await saveShifts(newShifts);
    setShowImportModal(false);
    setImportText('');
  };

  const exportToCSV = () => {
    let csvContent = "\uFEFF店舗/日付," + days.map(d => formatDate(d)).join(",") + "\n";
    stores.forEach(store => {
      const row = [store.name];
      days.forEach(day => {
        const coachId = shifts[`${formatDate(day)}_${store.id}`];
        const coach = coaches.find(c => c.id === coachId);
        row.push(coach ? coach.name : "");
      });
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `golf_shift_${viewDate.getFullYear()}-${viewDate.getMonth() + 1}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-[100%] mx-auto">
        
        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-emerald-800 flex items-center gap-2">
              <Calendar className="w-8 h-8" />
              ゴルフスクール・シフト管理
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 font-medium">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
              <div className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                <Cloud className="w-3 h-3" /> クラウド同期有効
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
              <span className="font-bold px-4 min-w-[120px] text-center">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"><ChevronRight className="w-5 h-5" /></button>
            </div>
            
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 text-sm font-medium transition-colors">
              <Upload className="w-4 h-4" /> インポート
            </button>

            <button onClick={exportToCSV} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700 text-sm font-medium transition-colors">
              <Download className="w-4 h-4" /> CSV保存
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          
          {/* Sidebar - Management Panels */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700 border-b pb-2">
                <Users className="w-5 h-5 text-emerald-600" /> 設定パネル
              </h2>
              
              <div className="space-y-6">
                {/* Store Management */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wider">店舗リスト</label>
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto pr-1">
                    {stores.map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100 group">
                        <span className="font-medium">{s.name}</span>
                        <button onClick={() => removeStore(s.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="flex-1 text-xs border p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="店舗名を追加"/>
                    <button onClick={addStore} className="bg-emerald-600 text-white px-2 rounded hover:bg-emerald-700 transition-colors"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>

                {/* Coach Management */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wider">コーチリスト</label>
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto pr-1">
                    {coaches.map(c => (
                      <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100 group">
                        <span className="font-medium">{c.name}</span>
                        <button onClick={() => removeCoach(c.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={newCoachName} onChange={e => setNewCoachName(e.target.value)} className="flex-1 text-xs border p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="コーチ名を追加"/>
                    <button onClick={addCoach} className="bg-emerald-600 text-white px-2 rounded hover:bg-emerald-700 transition-colors"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-[10px] text-slate-400 leading-tight italic">
                  変更は即座にクラウドへ保存されます。共有URLを使用すれば複数の管理者が同時に操作可能です。
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-[11px] text-amber-800 leading-normal">
                <p className="font-bold mb-1 underline">コーチ重複チェック</p>
                同じ日に一人のコーチが複数の店舗に割り当てられると、該当箇所が赤色で強調表示されます。
              </div>
            </div>
          </div>

          {/* Main Shift Grid */}
          <div className="xl:col-span-4 overflow-hidden flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto relative">
              <table className="w-full border-collapse text-xs table-fixed min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-3 border-b border-r border-slate-200 text-left font-bold w-32 sticky left-0 z-20 bg-slate-100 shadow-[1px_0_0_rgba(0,0,0,0.1)]">店舗 / 日付</th>
                    {days.map((day, i) => (
                      <th key={i} className={`p-2 border-b border-slate-200 text-center w-12 ${day.getDay() === 0 ? 'bg-red-50 text-red-500' : day.getDay() === 6 ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`}>
                        <div className="text-[9px] uppercase font-bold tracking-tighter">{['日', '月', '火', '水', '木', '金', '土'][day.getDay()]}</div>
                        <div className="text-sm font-black">{day.getDate()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stores.length === 0 ? (
                    <tr>
                      <td colSpan={days.length + 1} className="p-10 text-center text-slate-400 italic font-medium">店舗を登録してください</td>
                    </tr>
                  ) : (
                    stores.map(store => (
                      <tr key={store.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-3 border-b border-r border-slate-200 font-bold bg-white sticky left-0 z-10 group-hover:bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.02)] whitespace-nowrap overflow-hidden text-ellipsis">
                          {store.name}
                        </td>
                        {days.map((day, i) => {
                          const dateStr = formatDate(day);
                          const coachId = shifts[`${dateStr}_${store.id}`] || '';
                          const isConflict = coachId && conflicts[`${dateStr}_${coachId}`] > 1;
                          return (
                            <td key={i} className={`p-1 border-b border-slate-100 text-center ${day.getDay() === 0 ? 'bg-red-50/20' : day.getDay() === 6 ? 'bg-blue-50/20' : ''}`}>
                              <select
                                value={coachId}
                                onChange={e => handleShiftChange(day, store.id, e.target.value)}
                                className={`w-full h-8 rounded border appearance-none text-[10px] text-center cursor-pointer transition-all focus:outline-none
                                  ${!coachId ? 'border-dashed border-slate-200 bg-transparent text-slate-300 hover:border-emerald-300' : 
                                    isConflict ? 'bg-red-100 border-red-500 text-red-700 font-bold ring-1 ring-red-200 shadow-sm' : 
                                    'bg-emerald-50 border-emerald-100 text-emerald-800 font-medium'}`}
                              >
                                <option value="">-</option>
                                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-slate-400 italic text-right">※ 表を左右にドラッグまたはスクロールして全日程を確認できます</p>
          </div>
        </div>

        {/* Modal: Bulk Import */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 animate-in zoom-in duration-200 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-emerald-100 p-2 rounded-lg"><Upload className="text-emerald-600 w-6 h-6" /></div>
                <h2 className="text-xl font-bold text-slate-800">スプレッドシートから一括読込</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                スプレッドシートの範囲をコピーして貼り付けてください。<br />
                <span className="font-bold text-emerald-700">形式：</span> 1行目に日付（YYYY-MM-DD）、1列目に店舗名（正確な名称）。
              </p>
              <textarea 
                className="w-full h-64 border rounded-xl p-4 font-mono text-[10px] bg-slate-50 mb-4 border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none shadow-inner"
                placeholder={"店舗名\t2026-02-01\t2026-02-02...\n亀有\t清水\t荒谷\n神田\t岡田\t(空欄)\n..."}
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => {setShowImportModal(false); setImportText('');}} className="px-5 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors font-medium">キャンセル</button>
                <button onClick={handleImport} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">反映してクラウド保存</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
