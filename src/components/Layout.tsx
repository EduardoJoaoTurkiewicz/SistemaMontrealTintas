import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OfflineIndicator } from './OfflineIndicator';
import {
  Home,
  Users,
  ShoppingCart,
  CreditCard,
  FileText,
  Calendar,
  Receipt,
  DollarSign,
  Clock,
  TrendingUp,
  Zap,
  Car,
  Package,
  Factory,
  UserCheck,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard',   label: 'Dashboard',        icon: Home,          color: 'from-blue-600 to-sky-700' },
  { id: 'employees',   label: 'Funcionários',      icon: Users,         color: 'from-slate-600 to-gray-700' },
  { id: 'sales',       label: 'Vendas',            icon: ShoppingCart,  color: 'from-blue-600 to-indigo-700' },
  { id: 'debts',       label: 'Dívidas',           icon: CreditCard,    color: 'from-red-600 to-rose-700' },
  { id: 'credit-card', label: 'Cartão de Crédito', icon: CreditCard,    color: 'from-blue-600 to-cyan-700' },
  { id: 'checks',      label: 'Cheques',           icon: FileText,      color: 'from-yellow-600 to-amber-700' },
  { id: 'boletos',     label: 'Boletos',           icon: Receipt,       color: 'from-cyan-600 to-blue-700' },
  { id: 'acertos',     label: 'Acertos',           icon: Clock,         color: 'from-blue-600 to-sky-700' },
  { id: 'pix-fees',    label: 'Tarifas PIX',       icon: Zap,           color: 'from-blue-600 to-indigo-700' },
  { id: 'cash',        label: 'Caixa',             icon: DollarSign,    color: 'from-blue-600 to-sky-700' },
  { id: 'taxes',       label: 'Impostos',          icon: FileText,      color: 'from-orange-600 to-red-700' },
  { id: 'reports',     label: 'Relatórios',        icon: TrendingUp,    color: 'from-blue-600 to-sky-700' },
  { id: 'agenda',      label: 'Agenda',            icon: Calendar,      color: 'from-blue-600 to-sky-700' },
  { id: 'permutas',    label: 'Permutas',          icon: Car,           color: 'from-blue-600 to-sky-700' },
  { id: 'estoque',     label: 'Estoque',           icon: Package,       color: 'from-teal-600 to-emerald-700' },
  { id: 'producao',    label: 'Produção',          icon: Factory,       color: 'from-orange-600 to-amber-700' },
  { id: 'clientes',    label: 'Clientes',          icon: UserCheck,     color: 'from-blue-600 to-sky-700' },
  { id: 'orcamentos',  label: 'Orçamentos',        icon: ClipboardList, color: 'from-teal-600 to-emerald-700' },
];

const SIDEBAR_EXPANDED_WIDTH = 288; // px  (≈ w-72)
const SIDEBAR_COLLAPSED_WIDTH = 68; // px

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  // ── Collapsed state ─────────────────────────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('sidebar-collapsed');
      if (stored !== null) return stored === 'true';
    } catch (_) { /* ignore */ }
    // Default: collapsed on small screens
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(isCollapsed)); }
    catch (_) { /* ignore */ }
  }, [isCollapsed]);

  // Collapse by default on small screens when resizing down
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768 && !isCollapsed) {
        setIsCollapsed(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isCollapsed]);

  const currentItem = menuItems.find(item => item.id === currentPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-sky-50/50 flex">
      <OfflineIndicator />

      {/* ── Sidebar ── */}
      <motion.div
        animate={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="flex-shrink-0 bg-gradient-to-b from-slate-800 via-blue-900 to-sky-900 shadow-2xl relative flex flex-col h-screen overflow-hidden"
        style={{ minWidth: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
      >
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-4 w-28 h-28 bg-blue-400/20 rounded-full blur-2xl" />
          <div className="absolute bottom-20 right-4 w-32 h-32 bg-sky-400/15 rounded-full blur-2xl" />
        </div>

        {/* ── Logo / Header ── */}
        <div className="relative px-3 pt-5 pb-4 border-b border-blue-700/30 flex-shrink-0">
          <div className="flex items-center justify-center">
            {isCollapsed ? (
              /* Mini logo when collapsed */
              <div className="flex items-center justify-center w-10 h-10">
                <img
                  src="/ChatGPT_Image_7_de_abr._de_2026__20_03_38__1_-removebg-preview.png"
                  alt="Montreal Tintas"
                  className="w-10 h-10 object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              /* Full logo when expanded */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="flex flex-col items-center w-full px-2 py-1"
              >
                <img
                  src="/ChatGPT_Image_7_de_abr._de_2026__20_03_38__1_-removebg-preview.png"
                  alt="Montreal Tintas"
                  className="w-[55%] object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </motion.div>
            )}
          </div>

          {/* Online indicator */}
          <div className={`flex items-center gap-2 mt-3 ${isCollapsed ? 'justify-center' : 'px-1'}`}>
            <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse shadow-lg flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  key="online-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-blue-200 text-xs font-bold whitespace-nowrap overflow-hidden"
                >
                  Sistema Online
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav
          className="relative flex-1 overflow-y-auto py-4 px-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(96,165,250,0.4) transparent' }}
          role="navigation"
        >
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center text-left rounded-2xl transition-all duration-200 mb-1.5 group relative overflow-hidden
                  ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'}
                  ${isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-xl`
                    : 'text-blue-100 hover:text-white hover:bg-blue-700/40'
                  }
                `}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent pointer-events-none" />
                )}
                <div className={`
                  p-2 rounded-xl flex-shrink-0 transition-all duration-200
                  ${isActive ? 'bg-white/20 shadow-lg' : 'bg-blue-700/30 group-hover:bg-blue-600/50'}
                  ${isCollapsed ? 'mx-auto' : 'mr-3'}
                `}>
                  <Icon className="w-5 h-5" />
                </div>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      key={`label-${item.id}`}
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.18 }}
                      className="font-bold text-sm relative z-10 whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {isActive && !isCollapsed && (
                  <div className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full shadow-lg" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Toggle Button ── */}
        <div className="relative flex-shrink-0 p-3 border-t border-blue-700/30">
          <button
            onClick={() => setIsCollapsed(p => !p)}
            title={isCollapsed ? 'Expandir menu' : 'Minimizar menu'}
            className={`
              w-full flex items-center rounded-2xl px-3 py-2.5 text-blue-200 hover:text-white hover:bg-blue-700/40
              transition-all duration-200 group
              ${isCollapsed ? 'justify-center' : 'gap-3'}
            `}
          >
            {isCollapsed
              ? <PanelLeftOpen className="w-5 h-5" />
              : (
                <>
                  <PanelLeftClose className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold text-sm">Minimizar</span>
                </>
              )
            }
          </button>
        </div>
      </motion.div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-xl border-b border-blue-100/50 shadow-lg flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-gradient-to-r ${currentItem?.color ?? 'from-blue-600 to-sky-700'} shadow-xl flex-shrink-0`}>
                {React.createElement(currentItem?.icon ?? Home, { className: 'w-7 h-7 text-white' })}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  {currentItem?.label ?? 'Dashboard'}
                </h2>
                <p className="text-slate-600 font-semibold text-sm">
                  Sistema Montreal Tintas — Gestão Empresarial
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
