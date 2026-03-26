/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  doc,
  deleteDoc,
  setDoc,
  getDocs,
  handleFirestoreError,
  OperationType
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  LogOut, 
  TrendingUp, 
  MapPin, 
  Cloud, 
  Sun, 
  CloudRain, 
  CloudLightning,
  Wind,
  Euro,
  Clock,
  Star,
  Trash2,
  ChevronRight,
  Search,
  Map as MapIcon,
  Settings,
  FileDown,
  RefreshCcw,
  Check,
  Camera,
  X,
  Filter,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  subDays, 
  subWeeks, 
  subYears,
  isSameDay,
  startOfYear,
  endOfYear
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---

interface MarketEntry {
  id?: string;
  uid: string;
  marketName: string;
  date: string;
  weather: string;
  kmTravelled: number;
  startTime: string;
  endTime: string;
  cashGains: number;
  cardGains: number;
  expenses: number;
  satisfaction: number;
  tags?: string[];
  photoUrl?: string;
  createdAt: string;
}

// --- Components ---

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current">
      {/* Abstract M.M Logo */}
      <motion.path
        d="M20 80 L35 20 L50 50 L65 20 L80 80"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
        className="text-orange-500"
      />
      <motion.path
        d="M20 85 L35 25 L50 55 L65 25 L80 85"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.3 }}
        transition={{ duration: 2, delay: 0.5, repeat: Infinity, repeatType: "reverse" }}
        className="text-white"
      />
    </svg>
  </div>
);

const WeatherIcon = ({ type, className }: { type: string, className?: string }) => {
  const iconProps = { size: 24, className: cn("transition-all duration-500", className) };
  switch (type.toLowerCase()) {
    case 'soleil': return <Sun {...iconProps} className={cn("text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]", className)} />;
    case 'nuageux': return <Cloud {...iconProps} className={cn("text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.5)]", className)} />;
    case 'pluie': return <CloudRain {...iconProps} className={cn("text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]", className)} />;
    case 'orage': return <CloudLightning {...iconProps} className={cn("text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]", className)} />;
    case 'vent': return <Wind {...iconProps} className={cn("text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]", className)} />;
    default: return <Sun {...iconProps} className={cn("text-yellow-400", className)} />;
  }
};

const SatisfactionStars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star 
          key={i} 
          size={12} 
          className={i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"} 
        />
      ))}
    </div>
  );
};

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Oups ! Quelque chose s'est mal passé.</h1>
          <p className="text-gray-400 mb-8">L'application a rencontré une erreur inattendue.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- App Wrapper ---
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<MarketEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'history' | 'week' | 'settings'>('dashboard');
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedWeekDay, setSelectedWeekDay] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // 0-6 (Mon-Sun)
  const [merchandiseExpenses, setMerchandiseExpenses] = useState<number>(0);
  const [stockPercentage, setStockPercentage] = useState<number>(100);
  const [isEditingExpenses, setIsEditingExpenses] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MarketEntry | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    marketName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    weather: 'Soleil',
    kmTravelled: 0,
    startTime: '08:00',
    endTime: '13:00',
    cashGains: 0,
    cardGains: 0,
    expenses: 0,
    satisfaction: 3,
    tags: [] as string[],
    photoUrl: ''
  });
  const [newTag, setNewTag] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    show: false,
    message: '',
    type: 'info'
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'markets'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketEntry));
      setEntries(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'markets');
    });

    // Fetch settings
    const settingsRef = doc(db, 'settings', user.uid);
    const unsubSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMerchandiseExpenses(data.merchandiseExpenses || 0);
        setStockPercentage(data.stockPercentage !== undefined ? data.stockPercentage : 100);
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, [user]);

  const updateMerchandiseExpenses = async (val: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', user.uid), { merchandiseExpenses: val }, { merge: true });
      setIsEditingExpenses(false);
    } catch (error) {
      console.error("Error updating expenses:", error);
    }
  };

  const updateStockPercentage = async (val: number) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'settings', user.uid), { stockPercentage: val }, { merge: true });
    } catch (error) {
      console.error("Error updating percentage:", error);
    }
  };

  const handleResetData = async () => {
    if (!user) return;
    
    setConfirmModal({
      show: true,
      title: "Réinitialisation totale",
      message: "ÊTES-VOUS SÛR ? Cette action supprimera TOUTES vos données d'historique définitivement.",
      onConfirm: () => {
        setConfirmModal({
          show: true,
          title: "Confirmation finale",
          message: "Confirmez une deuxième fois pour valider la réinitialisation totale.",
          onConfirm: async () => {
            try {
              const q = query(collection(db, 'markets'), where('uid', '==', user.uid));
              const snapshot = await getDocs(q);
              const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'markets', d.id)));
              await Promise.all(deletePromises);
              showNotification("Données réinitialisées avec succès.", 'success');
            } catch (error) {
              console.error("Error resetting data:", error);
              showNotification("Erreur lors de la réinitialisation.", 'error');
            }
            setConfirmModal(prev => ({ ...prev, show: false }));
          }
        });
      }
    });
  };

  const generatePDF = (type: 'full' | 'month') => {
    const doc = new jsPDF();
    const title = type === 'full' ? "Historique Complet - Marché Manager" : `Récapitulatif Mensuel - ${format(new Date(), 'MMMM yyyy', { locale: fr })}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    const filteredEntries = type === 'full' 
      ? [...entries].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      : entries.filter(e => {
          const d = parseISO(e.date);
          const now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const tableData = filteredEntries.map(e => [
      format(parseISO(e.date), 'dd/MM/yyyy'),
      e.marketName,
      `${e.cashGains + e.cardGains}€`,
      `${e.expenses}€`,
      `${e.cashGains + e.cardGains - e.expenses}€`,
      `${e.kmTravelled}km`,
      e.tags ? e.tags.join(', ') : '-'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Marché', 'Gains', 'Frais', 'Net', 'Km', 'Tags']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 9 }
    });

    const totalGains = filteredEntries.reduce((acc, curr) => acc + curr.cashGains + curr.cardGains, 0);
    const totalExpenses = filteredEntries.reduce((acc, curr) => acc + curr.expenses, 0);
    const totalProfit = totalGains - totalExpenses;
    const totalKm = filteredEntries.reduce((acc, curr) => acc + curr.kmTravelled, 0);

    const finalY = (doc as any).lastAutoTable.finalY || 40;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Gains: ${totalGains}€`, 14, finalY + 15);
    doc.text(`Total Frais: ${totalExpenses}€`, 14, finalY + 22);
    doc.text(`Bénéfice Net: ${totalProfit}€`, 14, finalY + 29);
    doc.text(`Distance Totale: ${totalKm}km`, 14, finalY + 36);

    doc.save(`marche-manager-${type}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // AI Grounding - Search for market info or weather
  const handleAiGrounding = async (type: 'search' | 'maps') => {
    if (!formData.marketName) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = type === 'maps' 
        ? `Donne-moi des informations pratiques sur le marché de "${formData.marketName}". Localisation précise, jours habituels, et ambiance.`
        : `Quelles sont les prévisions météo typiques ou actuelles pour un marché à "${formData.marketName}" le ${formData.date}?`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: type === 'maps' ? [{ googleMaps: {} }] : [{ googleSearch: {} }]
        }
      });
      
      setAiInfo(response.text || "Aucune information trouvée.");
    } catch (error) {
      console.error("AI Error:", error);
      setAiInfo("Erreur lors de la recherche d'informations.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'markets'), {
        ...formData,
        uid: user.uid,
        createdAt: new Date().toISOString()
      });
      
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          marketName: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          weather: 'Soleil',
          kmTravelled: 0,
          startTime: '08:00',
          endTime: '13:00',
          cashGains: 0,
          cardGains: 0,
          expenses: 0,
          satisfaction: 5,
          tags: [],
          photoUrl: ''
        });
        setActiveTab('dashboard');
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'markets');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      show: true,
      title: "Supprimer l'entrée",
      message: "Voulez-vous vraiment supprimer ce marché de votre historique ?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'markets', id));
          showNotification("Entrée supprimée.", 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `markets/${id}`);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  // Stats Calculations
  const stats = useMemo(() => {
    const totalGains = entries.reduce((acc, curr) => acc + curr.cashGains + curr.cardGains, 0);
    const totalExpenses = entries.reduce((acc, curr) => acc + curr.expenses, 0);
    const totalKm = entries.reduce((acc, curr) => acc + curr.kmTravelled, 0);
    const totalFuelCost = totalKm * 0.20;
    const totalProfit = totalGains - totalExpenses - totalFuelCost;
    const totalProfitWithStock = totalProfit - merchandiseExpenses;
    
    let chartData: any[] = [];

    if (statsPeriod === 'day') {
      chartData = [...Array(7)].map((_, i) => {
        const d = subDays(new Date(), i);
        const label = format(d, 'EEE', { locale: fr });
        const dayEntries = entries.filter(e => isSameDay(parseISO(e.date), d));
        const gains = dayEntries.reduce((acc, curr) => acc + curr.cashGains + curr.cardGains, 0);
        return { name: label, gains };
      }).reverse();
    } else if (statsPeriod === 'week') {
      chartData = [...Array(8)].map((_, i) => {
        const d = subWeeks(new Date(), i);
        const start = startOfWeek(d, { weekStartsOn: 1 });
        const end = endOfWeek(d, { weekStartsOn: 1 });
        const label = `S${format(d, 'w')}`;
        const weekEntries = entries.filter(e => {
          const entryDate = parseISO(e.date);
          return isWithinInterval(entryDate, { start, end });
        });
        const gains = weekEntries.reduce((acc, curr) => acc + curr.cashGains + curr.cardGains, 0);
        return { name: label, gains };
      }).reverse();
    } else if (statsPeriod === 'month') {
      chartData = [...Array(6)].map((_, i) => {
        const d = subMonths(new Date(), i);
        const monthStr = format(d, 'MMM', { locale: fr });
        const monthEntries = entries.filter(e => {
          const entryDate = parseISO(e.date);
          return entryDate.getMonth() === d.getMonth() && entryDate.getFullYear() === d.getFullYear();
        });
        const gains = monthEntries.reduce((acc, curr) => acc + curr.cashGains + curr.cardGains, 0);
        return { name: monthStr, gains };
      }).reverse();
    } else if (statsPeriod === 'year') {
      chartData = [...Array(3)].map((_, i) => {
        const d = subYears(new Date(), i);
        const label = format(d, 'yyyy');
        const yearEntries = entries.filter(e => parseISO(e.date).getFullYear() === d.getFullYear());
        const gains = yearEntries.reduce((acc, curr) => acc + curr.cashGains + curr.cardGains, 0);
        return { name: label, gains };
      }).reverse();
    }

    return { totalGains, totalExpenses, totalProfit, totalProfitWithStock, totalKm, totalFuelCost, chartData };
  }, [entries, statsPeriod, merchandiseExpenses]);

  const weekEntriesByDay = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      return entries.filter(e => isSameDay(parseISO(e.date), day));
    });
  }, [entries]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center justify-center gap-8">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Logo className="w-24 h-24" />
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-orange-500"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold animate-pulse">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="w-24 h-24 bg-orange-500/10 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/10 border border-orange-500/20">
            <Logo className="w-16 h-16" />
          </div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">Marché Manager</h1>
          
          <motion.p 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[10px] text-orange-500 uppercase tracking-[0.3em] font-bold mb-8"
          >
            créé par Sean Janselme
          </motion.p>

          <p className="text-gray-400 mb-12 text-lg">Gérez vos gains, vos frais et vos statistiques de commerçant en un clin d'œil.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-white text-black font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-xl"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Se connecter avec Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white font-sans pb-24">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/5 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-50">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Marché Manager</h1>
          <p className="text-xs text-gray-500">Bonjour, {user.displayName?.split(' ')[0]}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('settings')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <Settings size={20} className={activeTab === 'settings' ? "text-orange-500" : "text-gray-400"} />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#141414] p-5 rounded-3xl border border-white/5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bénéfice Net</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.totalProfit.toLocaleString()}€</p>
                  <p className="text-[10px] text-gray-500 mt-1">Carburant: -{stats.totalFuelCost.toLocaleString()}€</p>
                </div>
                <div className="bg-[#141414] p-5 rounded-3xl border border-white/5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bénéfice Total</p>
                  <p className={cn("text-2xl font-bold", stats.totalProfitWithStock >= 0 ? "text-green-500" : "text-red-500")}>
                    {stats.totalProfitWithStock.toLocaleString()}€
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">Stock: -{merchandiseExpenses.toLocaleString()}€</p>
                </div>
              </div>

              {/* Merchandise Expenses Section */}
              <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest">Frais Marchandise</h3>
                    <p className="text-xs text-gray-500">Stock actuel / Dépenses globales</p>
                  </div>
                  <button 
                    onClick={() => setIsEditingExpenses(!isEditingExpenses)}
                    className="text-xs font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-xl"
                  >
                    {isEditingExpenses ? "Annuler" : "Modifier"}
                  </button>
                </div>
                
                {isEditingExpenses ? (
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      autoFocus
                      defaultValue={merchandiseExpenses}
                      onBlur={(e) => updateMerchandiseExpenses(Number(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && updateMerchandiseExpenses(Number((e.target as HTMLInputElement).value))}
                      className="flex-1 bg-black/40 border border-orange-500/30 rounded-xl py-3 px-4 focus:outline-none focus:border-orange-500"
                    />
                    <button 
                      onClick={() => setIsEditingExpenses(false)}
                      className="bg-orange-500 text-white px-4 rounded-xl font-bold"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-white">{merchandiseExpenses.toLocaleString()}€</p>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Stock Actuel</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={stockPercentage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setStockPercentage(val);
                            updateStockPercentage(val);
                          }}
                          className="w-24 accent-orange-500"
                        />
                        <span className="text-sm font-bold text-orange-500 min-w-[40px]">{stockPercentage}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart */}
              <div className="bg-[#141414] p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp size={16} className="text-orange-500" />
                    Évolution des Gains
                  </h3>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                    {(['day', 'week', 'month', 'year'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setStatsPeriod(p)}
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold uppercase rounded-lg transition-all",
                          statsPeriod === p ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        {p === 'day' ? 'Jour' : p === 'week' ? 'Sem' : p === 'month' ? 'Mois' : 'An'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="name" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                        itemStyle={{ color: '#f97316' }}
                      />
                      <Bar dataKey="gains" radius={[6, 6, 0, 0]}>
                        {stats.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === stats.chartData.length - 1 ? '#f97316' : '#333'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Derniers Marchés</h3>
                  <button onClick={() => setActiveTab('history')} className="text-xs text-orange-500 font-medium">Voir tout</button>
                </div>
                <div className="space-y-3">
                  {entries.slice(0, 3).map(entry => (
                    <div 
                      key={entry.id} 
                      onClick={() => setSelectedEntry(entry)}
                      className="bg-[#141414] p-4 rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer hover:border-orange-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                          <WeatherIcon type={entry.weather} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold">{entry.marketName}</p>
                          <p className="text-xs text-gray-500">{format(parseISO(entry.date), 'dd MMMM yyyy', { locale: fr })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-500">+{entry.cashGains + entry.cardGains - entry.expenses - (entry.kmTravelled * 0.20)}€</p>
                        <SatisfactionStars rating={entry.satisfaction} />
                      </div>
                    </div>
                  ))}
                  {entries.length === 0 && (
                    <div className="text-center py-12 bg-[#141414] rounded-3xl border border-dashed border-white/10">
                      <p className="text-gray-500">Aucune donnée pour le moment.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'week' && (
            <motion.div 
              key="week"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold">Ma Semaine</h2>
                <p className="text-xs text-gray-500 font-medium">
                  {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM')} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM')}
                </p>
              </div>

              {/* Day Tabs */}
              <div className="flex gap-1.5 overflow-x-hidden">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, idx) => (
                  <button
                    key={day}
                    onClick={() => setSelectedWeekDay(idx)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl border transition-all flex flex-col items-center gap-0.5",
                      selectedWeekDay === idx 
                        ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "bg-[#141414] border-white/5 text-gray-500"
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tighter">{day}</span>
                    <span className="text-sm font-bold">
                      {format(eachDayOfInterval({ 
                        start: startOfWeek(new Date(), { weekStartsOn: 1 }), 
                        end: endOfWeek(new Date(), { weekStartsOn: 1 }) 
                      })[idx], 'dd')}
                    </span>
                  </button>
                ))}
              </div>

              {/* Day Content */}
              <div className="space-y-4">
                {weekEntriesByDay[selectedWeekDay].length > 0 ? (
                  weekEntriesByDay[selectedWeekDay].map(entry => (
                    <div 
                      key={entry.id} 
                      onClick={() => setSelectedEntry(entry)}
                      className="bg-[#141414] p-5 rounded-3xl border border-white/5 space-y-4 cursor-pointer hover:border-orange-500/30 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                            <WeatherIcon type={entry.weather} className="text-orange-500" />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{entry.marketName}</h4>
                            <p className="text-xs text-gray-500">{entry.startTime} - {entry.endTime}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-orange-500">+{entry.cashGains + entry.cardGains - entry.expenses - (entry.kmTravelled * 0.20)}€</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Net</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#0a0a0a] p-3 rounded-2xl flex justify-between items-center">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Km</span>
                          <span className="font-bold text-sm">{entry.kmTravelled} km</span>
                        </div>
                        <div className="bg-[#0a0a0a] p-3 rounded-2xl flex justify-between items-center">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Note</span>
                          <SatisfactionStars rating={entry.satisfaction} />
                        </div>
                      </div>

                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {entry.tags.map((tag, i) => (
                            <span key={i} className="bg-white/5 text-gray-400 px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/5 uppercase tracking-wider">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 bg-[#141414] rounded-3xl border border-dashed border-white/10">
                    <p className="text-gray-500">Aucun marché enregistré pour ce jour.</p>
                    <button 
                      onClick={() => setActiveTab('form')}
                      className="mt-4 text-orange-500 text-sm font-bold flex items-center gap-2 mx-auto"
                    >
                      <PlusCircle size={16} /> Ajouter un marché
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'form' && (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold mb-6">Nouveau Marché</h2>
              <form onSubmit={handleSubmit} className="space-y-6 pb-12">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom du Marché</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        value={formData.marketName}
                        onChange={e => setFormData({...formData, marketName: e.target.value})}
                        className="w-full bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 transition-colors"
                        placeholder="ex: Marché de Bastille"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                        <button 
                          type="button"
                          onClick={() => handleAiGrounding('maps')}
                          className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-orange-500 transition-colors"
                          title="Infos Maps"
                        >
                          <MapIcon size={18} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleAiGrounding('search')}
                          className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-orange-500 transition-colors"
                          title="Infos Météo/Web"
                        >
                          <Search size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {aiLoading && (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-orange-500"></div>
                      <p className="text-xs text-orange-500">Recherche d'informations en cours...</p>
                    </div>
                  )}

                  {aiInfo && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl relative">
                      <button onClick={() => setAiInfo(null)} className="absolute top-2 right-2 text-gray-500 hover:text-white">×</button>
                      <p className="text-xs text-gray-400 leading-relaxed">{aiInfo}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</label>
                      <input 
                        type="date" 
                        required
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Météo</label>
                      <select 
                        value={formData.weather}
                        onChange={e => setFormData({...formData, weather: e.target.value})}
                        className="w-full bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500 appearance-none"
                      >
                        <option>Soleil</option>
                        <option>Nuageux</option>
                        <option>Pluie</option>
                        <option>Orage</option>
                        <option>Vent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Km</label>
                      <input 
                        type="number" 
                        value={formData.kmTravelled}
                        onChange={e => setFormData({...formData, kmTravelled: Number(e.target.value)})}
                        className="w-full bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Début</label>
                      <input 
                        type="time" 
                        value={formData.startTime}
                        onChange={e => setFormData({...formData, startTime: e.target.value})}
                        className="w-full bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fin</label>
                      <input 
                        type="time" 
                        value={formData.endTime}
                        onChange={e => setFormData({...formData, endTime: e.target.value})}
                        className="w-full bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-orange-500/5 border border-orange-500/10 rounded-3xl space-y-6">
                    <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest">Finances</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Espèces (€)</label>
                        <input 
                          type="number" 
                          required
                          value={formData.cashGains}
                          onChange={e => setFormData({...formData, cashGains: Number(e.target.value)})}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CB (€)</label>
                        <input 
                          type="number" 
                          required
                          value={formData.cardGains}
                          onChange={e => setFormData({...formData, cardGains: Number(e.target.value)})}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frais / Dépenses (€)</label>
                      <input 
                        type="number" 
                        required
                        value={formData.expenses}
                        onChange={e => setFormData({...formData, expenses: Number(e.target.value)})}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-400">Bénéfice calculé :</span>
                      <span className="text-xl font-bold text-orange-500">
                        {formData.cashGains + formData.cardGains - formData.expenses}€
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags / Produits</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newTag.trim()) {
                              setFormData({...formData, tags: [...formData.tags, newTag.trim()]});
                              setNewTag('');
                            }
                          }
                        }}
                        placeholder="Ajouter un tag (ex: Fraises)"
                        className="flex-1 bg-[#141414] border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-orange-500"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (newTag.trim()) {
                            setFormData({...formData, tags: [...formData.tags, newTag.trim()]});
                            setNewTag('');
                          }
                        }}
                        className="bg-orange-500 text-white px-6 rounded-2xl font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, i) => (
                        <span 
                          key={i} 
                          className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-orange-500/20"
                        >
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, tags: formData.tags.filter((_, idx) => idx !== i)})}
                            className="hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Photo du Marché</label>
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData({ ...formData, photoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden" 
                        id="photo-upload"
                      />
                      <label 
                        htmlFor="photo-upload"
                        className={cn(
                          "w-full h-48 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all overflow-hidden",
                          formData.photoUrl 
                            ? "border-orange-500/50 bg-orange-500/5" 
                            : "border-white/10 bg-[#141414] hover:border-orange-500/30"
                        )}
                      >
                        {formData.photoUrl ? (
                          <div className="relative w-full h-full">
                            <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera size={24} className="text-white" />
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setFormData({ ...formData, photoUrl: '' });
                              }}
                              className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-red-500 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500">
                              <Camera size={24} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-gray-400">Ajouter une photo</p>
                              <p className="text-[10px] text-gray-600">Cliquez pour choisir un fichier</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Note du Marché (0-5)</label>
                    </div>
                    <div className="flex justify-between items-center bg-[#141414] p-4 rounded-2xl border border-white/10">
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFormData({ ...formData, satisfaction: num })}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all font-bold",
                              formData.satisfaction === num 
                                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                                : "bg-black/40 text-gray-500 hover:text-gray-300"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={20} 
                            className={i < formData.satisfaction ? "fill-yellow-400 text-yellow-400" : "text-gray-800"} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-orange-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
                >
                  Enregistrer le Marché
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-bold">Réglages</h2>
              
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Exportation</h3>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => generatePDF('full')}
                    className="bg-[#141414] p-5 rounded-3xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                        <FileDown size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Exporter Historique Complet</p>
                        <p className="text-xs text-gray-500">Générer un PDF de toutes vos données</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-600" />
                  </button>

                  <button 
                    onClick={() => generatePDF('month')}
                    className="bg-[#141414] p-5 rounded-3xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                        <FileDown size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Récapitulatif du Mois</p>
                        <p className="text-xs text-gray-500">PDF des marchés de {format(new Date(), 'MMMM', { locale: fr })}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Compte & Sécurité</h3>
                <div className="space-y-3">
                  <button 
                    onClick={handleResetData}
                    className="w-full bg-[#141414] p-5 rounded-3xl border border-white/5 flex items-center gap-4 hover:bg-red-500/5 hover:border-red-500/20 transition-colors text-red-400"
                  >
                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                      <RefreshCcw size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Réinitialiser les données</p>
                      <p className="text-xs opacity-60">Supprimer tout l'historique définitivement</p>
                    </div>
                  </button>

                  <button 
                    onClick={logout}
                    className="w-full bg-[#141414] p-5 rounded-3xl border border-white/5 flex items-center gap-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                      <LogOut size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Se déconnecter</p>
                      <p className="text-xs text-gray-500">Quitter votre session actuelle</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => showNotification("Pour supprimer votre compte, contactez support@marchemanager.fr", 'info')}
                    className="w-full bg-[#141414] p-5 rounded-3xl border border-white/5 flex items-center gap-4 hover:bg-red-500/5 hover:border-red-500/20 transition-colors text-red-600 opacity-50"
                  >
                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                      <Trash2 size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Supprimer le compte</p>
                      <p className="text-xs opacity-60">Action irréversible</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Aide & Support</h3>
                <div className="bg-[#141414] p-6 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                      <Star size={20} />
                    </div>
                    <div>
                      <p className="font-bold">Besoin d'aide ?</p>
                      <p className="text-xs text-gray-500">Consultez notre guide d'utilisation</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Marché Manager est conçu pour vous aider à suivre votre rentabilité. Si vous rencontrez un bug, n'hésitez pas à nous contacter.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-[#141414] rounded-3xl border border-white/5 text-center">
                <p className="text-xs text-gray-500 mb-2">Marché Manager v1.2.0</p>
                <p className="text-[10px] text-gray-600">Conçu pour les commerçants ambulants</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Historique</h2>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-500" />
                  <select 
                    value={tagFilter || ''} 
                    onChange={(e) => setTagFilter(e.target.value || null)}
                    className="bg-[#141414] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Tous les tags</option>
                    {Array.from(new Set(entries.flatMap(e => e.tags || []))).map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {entries
                  .filter(e => !tagFilter || e.tags?.includes(tagFilter))
                  .map(entry => (
                  <div 
                    key={entry.id} 
                    onClick={() => setSelectedEntry(entry)}
                    className="bg-[#141414] p-5 rounded-3xl border border-white/5 space-y-4 cursor-pointer hover:border-orange-500/30 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                          <WeatherIcon type={entry.weather} className="text-orange-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{entry.marketName}</h4>
                          <p className="text-xs text-gray-500">{format(parseISO(entry.date), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info size={18} className="text-gray-600" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#0a0a0a] p-3 rounded-2xl text-center">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Gains</p>
                        <p className="font-bold text-sm">{entry.cashGains + entry.cardGains}€</p>
                      </div>
                      <div className="bg-[#0a0a0a] p-3 rounded-2xl text-center">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Frais</p>
                        <p className="font-bold text-sm text-red-400">{entry.expenses + (entry.kmTravelled * 0.20)}€</p>
                      </div>
                      <div className="bg-[#0a0a0a] p-3 rounded-2xl text-center">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Net</p>
                        <p className="font-bold text-sm text-green-400">{entry.cashGains + entry.cardGains - entry.expenses - (entry.kmTravelled * 0.20)}€</p>
                      </div>
                    </div>

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {entry.tags.map((tag, i) => (
                          <span key={i} className="bg-white/5 text-gray-400 px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/5 uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="text-center py-20 text-gray-500">
                    Aucun historique disponible.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Market Details Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setSelectedEntry(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg bg-[#0a0a0a] rounded-t-[40px] sm:rounded-[40px] border border-white/10 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative h-64 bg-white/5">
                {selectedEntry.photoUrl ? (
                  <img src={selectedEntry.photoUrl} alt={selectedEntry.marketName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <MapPin size={64} />
                  </div>
                )}
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="absolute top-6 right-6 p-3 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#0a0a0a] to-transparent">
                  <h3 className="text-3xl font-bold text-white">{selectedEntry.marketName}</h3>
                  <p className="text-gray-400 font-medium">{format(parseISO(selectedEntry.date), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
                </div>
              </div>

              <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#141414] p-5 rounded-3xl border border-white/5 space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Bénéfice Net</p>
                    <p className="text-2xl font-bold text-orange-500">
                      {(selectedEntry.cashGains + selectedEntry.cardGains - selectedEntry.expenses - (selectedEntry.kmTravelled * 0.20)).toFixed(2)}€
                    </p>
                  </div>
                  <div className="bg-[#141414] p-5 rounded-3xl border border-white/5 space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Note</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-white">{selectedEntry.satisfaction}</span>
                      <SatisfactionStars rating={selectedEntry.satisfaction} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Détails de la journée</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 bg-[#141414] p-4 rounded-2xl border border-white/5">
                      <WeatherIcon type={selectedEntry.weather} className="text-orange-500" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Météo</p>
                        <p className="text-sm font-bold">{selectedEntry.weather}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-[#141414] p-4 rounded-2xl border border-white/5">
                      <Clock size={20} className="text-blue-500" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Horaires</p>
                        <p className="text-sm font-bold">{selectedEntry.startTime} - {selectedEntry.endTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-[#141414] p-4 rounded-2xl border border-white/5">
                      <MapPin size={20} className="text-green-500" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Distance</p>
                        <p className="text-sm font-bold">{selectedEntry.kmTravelled} km</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-[#141414] p-4 rounded-2xl border border-white/5">
                      <Euro size={20} className="text-yellow-500" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Carburant</p>
                        <p className="text-sm font-bold">{(selectedEntry.kmTravelled * 0.20).toFixed(2)}€</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Finances détaillées</h4>
                  <div className="bg-[#141414] p-6 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-gray-400">Ventes Espèces</span>
                      <span className="font-bold">{selectedEntry.cashGains}€</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-gray-400">Ventes CB</span>
                      <span className="font-bold">{selectedEntry.cardGains}€</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-gray-400">Frais (Repas/Place)</span>
                      <span className="font-bold text-red-400">-{selectedEntry.expenses}€</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-white font-bold">Bénéfice Net Final</span>
                      <span className="text-xl font-bold text-orange-500">
                        {(selectedEntry.cashGains + selectedEntry.cardGains - selectedEntry.expenses - (selectedEntry.kmTravelled * 0.20)).toFixed(2)}€
                      </span>
                    </div>
                  </div>
                </div>

                {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Produits & Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.tags.map((tag, i) => (
                        <span key={i} className="bg-orange-500/10 text-orange-500 px-4 py-1.5 rounded-xl text-xs font-bold border border-orange-500/20">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    if (selectedEntry.id) {
                      handleDelete(selectedEntry.id);
                      setSelectedEntry(null);
                    }
                  }}
                  className="w-full py-4 rounded-2xl border border-red-500/20 text-red-500 font-bold text-sm hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Supprimer ce marché
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-[#141414] border border-orange-500/30 p-8 rounded-[40px] flex flex-col items-center gap-4 shadow-2xl shadow-orange-500/20"
            >
              <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/40">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                >
                  <Check size={40} className="text-white" strokeWidth={4} />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-white">Enregistré !</h3>
              <p className="text-gray-400 text-sm">Votre marché a été ajouté avec succès.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/80 backdrop-blur-2xl border-t border-white/5 p-4 pb-8 z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'dashboard' ? "text-orange-500 scale-110" : "text-gray-500"
            )}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Stats</span>
          </button>

          <button 
            onClick={() => setActiveTab('week')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'week' ? "text-orange-500 scale-110" : "text-gray-500"
            )}
          >
            <MapPin size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Semaine</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('form')}
            className={cn(
              "w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/20 -mt-8 transition-all active:scale-90",
              activeTab === 'form' ? "scale-110 rotate-90" : ""
            )}
          >
            <PlusCircle size={32} className="text-white" />
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'history' ? "text-orange-500 scale-110" : "text-gray-500"
            )}
          >
            <History size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Journal</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === 'settings' ? "text-orange-500 scale-110" : "text-gray-500"
            )}
          >
            <Settings size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Réglages</span>
          </button>
        </div>
      </nav>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#141414] border border-white/10 rounded-[40px] p-8 space-y-6 text-center"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">{confirmModal.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold text-sm hover:bg-white/10 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-4 rounded-2xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification.show && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-[200] flex justify-center pointer-events-none"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border",
              notification.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-500" :
              notification.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" :
              "bg-blue-500/10 border-blue-500/20 text-blue-500"
            )}>
              {notification.type === 'success' && <Check size={18} />}
              {notification.type === 'error' && <X size={18} />}
              {notification.type === 'info' && <Info size={18} />}
              <span className="text-sm font-bold">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
