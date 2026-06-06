import React, { useState, useEffect, useRef } from 'react';
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
  Menu,
  X,
  Truck,
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
  { id: 'fornecedores', label: 'Fornecedores',      icon: Truck,         color: 'from-emerald-600 to-teal-700' },
  { id: 'orcamentos',  label: 'Orçamentos',        icon: ClipboardList, color: 'from-teal-600 to-emerald-700' },
];

// Width constants (px)
const EXPANDED_W = 272;
const COLLAPSED_W = 72;

function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem('sidebar-collapsed');
    if (v !== null) return v === 'true';
  } catch (_) { /* ignore */ }
  return typeof window !== 'undefined' && window.innerWidth < 1024;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  // Mobile drawer state (screens < 768px)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Persist collapsed preference
  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)); } catch (_) { /* ignore */ }
  }, [collapsed]);

  // Auto-collapse on tablet resize
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024 && window.innerWidth >= 768 && !collapsed) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [collapsed]);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [drawerOpen]);

  // Close mobile drawer and navigate
  const handleNav = (id: string) => {
    onPageChange(id);
    setDrawerOpen(false);
  };

  const currentItem = menuItems.find(item => item.id === currentPage);
  const sidebarW = collapsed ? COLLAPSED_W : EXPANDED_W;

  // ─── Shared nav list ────────────────────────────────────────────────────────
  const NavList = ({ mini }: { mini: boolean }) => (
    <nav
      className="flex-1 overflow-y-auto py-3 px-2"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(96,165,250,0.35) transparent' }}
      role="navigation"
      aria-label="Menu principal"
    >
      {menuItems.map(item => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            title={mini ? item.label : undefined}
            aria-label={item.label}
            className={`
              w-full flex items-center rounded-xl transition-all duration-200 mb-1 group relative overflow-hidden
              ${mini ? 'justify-center px-1 py-3' : 'px-3 py-3 gap-3'}
              ${isActive
                ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                : 'text-blue-100 hover:text-white hover:bg-white/10'
              }
            `}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent pointer-events-none" />
            )}

            {/* Icon container */}
            <div className={`
              flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200
              ${mini ? 'w-10 h-10' : 'w-9 h-9'}
              ${isActive
                ? 'bg-white/20 shadow-md'
                : 'bg-white/10 group-hover:bg-white/20'
              }
            `}>
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.2 : 1.8} />
            </div>

            {/* Label */}
            {!mini && (
              <span className="font-semibold text-sm leading-tight truncate relative z-10 flex-1 text-left">
                {item.label}
              </span>
            )}

            {/* Active dot */}
            {isActive && !mini && (
              <div className="w-1.5 h-1.5 rounded-full bg-white/80 flex-shrink-0" />
            )}
          </button>
        );
      })}
    </nav>
  );

  // ─── Toggle button ───────────────────────────────────────────────────────────
  const ToggleBtn = ({ mini }: { mini: boolean }) => (
    <div className="flex-shrink-0 px-2 py-3 border-t border-white/10">
      <button
        onClick={() => setCollapsed(p => !p)}
        title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
        className={`
          w-full flex items-center rounded-xl px-2 py-2.5 text-blue-200 hover:text-white hover:bg-white/10
          transition-all duration-200 group
          ${mini ? 'justify-center' : 'gap-3'}
        `}
      >
        <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
          {collapsed
            ? <PanelLeftOpen className="w-6 h-6" />
            : <PanelLeftClose className="w-6 h-6" />
          }
        </div>
        {!mini && (
          <span className="font-semibold text-sm">Minimizar</span>
        )}
      </button>
    </div>
  );

  // ─── Logo header ─────────────────────────────────────────────────────────────
  const LogoHeader = ({ mini }: { mini: boolean }) => (
    <div className={`flex-shrink-0 border-b border-white/10 ${mini ? 'px-1 py-4' : 'px-4 py-4'}`}>
      <div className={`flex items-center ${mini ? 'justify-center' : 'justify-start'}`}>
        {mini ? (
          <div className="w-10 h-10 flex items-center justify-center">
            <img
              src="/ChatGPT_Image_7_de_abr._de_2026__20_03_38__1_-removebg-preview.png"
              alt="Montreal Tintas"
              className="w-10 h-10 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <img
              src="/ChatGPT_Image_7_de_abr._de_2026__20_03_38__1_-removebg-preview.png"
              alt="Montreal Tintas"
              className="w-[80%] max-w-[180px] object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
      </div>
      {/* Online pill */}
      <div className={`flex items-center gap-2 mt-3 ${mini ? 'justify-center' : 'px-1'}`}>
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        {!mini && (
          <span className="text-blue-200 text-xs font-semibold whitespace-nowrap">Sistema Online</span>
        )}
      </div>
    </div>
  );

  return (
    // Root: full viewport, no scroll on the root itself
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-sky-50/50 flex">
      <OfflineIndicator />

      {/* ═══════════════════════════════════════════════════════════════════════
          DESKTOP / TABLET SIDEBAR — fixed left, full viewport height
          Hidden on mobile (< 768px) via `hidden md:flex`
      ════════════════════════════════════════════════════════════════════════ */}
      <motion.aside
        animate={{ width: sidebarW }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 z-40
                   bg-gradient-to-b from-slate-800 via-blue-900 to-sky-950 shadow-2xl overflow-hidden"
        style={{ width: sidebarW, minWidth: sidebarW }}
      >
        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-16 left-2 w-24 h-24 bg-blue-400/15 rounded-full blur-2xl" />
          <div className="absolute bottom-24 right-2 w-28 h-28 bg-sky-400/10 rounded-full blur-2xl" />
        </div>

        <div className="relative flex flex-col h-full">
          <LogoHeader mini={collapsed} />
          <NavList mini={collapsed} />
          <ToggleBtn mini={collapsed} />
        </div>
      </motion.aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          MOBILE — Fixed bottom bar + slide-in drawer
          Visible only on mobile (< 768px)
      ════════════════════════════════════════════════════════════════════════ */}
      {/* Bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-800 to-blue-900 border-t border-white/10 shadow-2xl">
        <div className="flex items-center justify-around px-2 py-2">
          {/* Show first 4 menu items as quick-access icons */}
          {menuItems.slice(0, 4).map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                aria-label={item.label}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? `bg-gradient-to-b ${item.color} text-white shadow-md`
                    : 'text-blue-200 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[10px] font-semibold leading-none truncate max-w-[56px]">
                  {item.label}
                </span>
              </button>
            );
          })}
          {/* Hamburger to open full drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu completo"
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-blue-200 hover:text-white transition-all"
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="drawer"
              ref={drawerRef}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col
                         bg-gradient-to-b from-slate-800 via-blue-900 to-sky-950 shadow-2xl overflow-hidden"
            >
              <div className="relative flex flex-col h-full">
                {/* Close button */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/10 flex-shrink-0">
                  <img
                    src="/ChatGPT_Image_7_de_abr._de_2026__20_03_38__1_-removebg-preview.png"
                    alt="Montreal Tintas"
                    className="h-10 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Fechar menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <NavList mini={false} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT — fills remaining space, scrolls independently
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top header */}
        <header className="flex-shrink-0 bg-white/85 backdrop-blur-xl border-b border-blue-100/60 shadow-sm z-30">
          <div className="px-5 py-3.5 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl bg-gradient-to-r ${currentItem?.color ?? 'from-blue-600 to-sky-700'} shadow-lg flex-shrink-0`}>
              {React.createElement(currentItem?.icon ?? Home, { className: 'w-6 h-6 text-white', strokeWidth: 2 })}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-tight">
                {currentItem?.label ?? 'Dashboard'}
              </h2>
              <p className="text-slate-500 font-medium text-xs">
                Sistema Montreal Tintas — Gestão Empresarial
              </p>
            </div>
          </div>
        </header>

        {/* Page content — scrolls independently */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
