import React, { useState, useEffect } from 'react';

  const removeFloating = () => {
  document.querySelectorAll('[style*="position: fixed"][style*="bottom: 1rem"][style*="right: 1rem"][style*="z-index: 2147483647"]').forEach(el => el.remove());
};

// executa já no load
removeFloating();

// observa mudanças no DOM
const observer = new MutationObserver(removeFloating);
observer.observe(document.body, { childList: true, subtree: true });

import { AppProvider, useAppContext } from './context/AppContext';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import { Debts } from './components/Debts';
import { Checks } from './components/Checks';
import { Boletos } from './components/Boletos';
import { PixFees } from './components/PixFees';
import Reports from './components/Reports';
import { CashManagement } from './components/CashManagement';
import Agenda from './components/Agenda';
import { Employees } from './components/Employees';
import { Taxes } from './components/Taxes';
import { Acertos } from './components/Acertos';
import { PrintReportPage } from './components/reports/PrintReportPage';
import { Permutas } from './components/Permutas';
import CreditCard from './components/CreditCard';
import Estoque from './components/Estoque';
import Producao from './components/Producao';
import ProductionLabelsPrint from './components/print/ProductionLabelsPrint';
import { ClientesPage } from './components/ClientesPage';
import { Orcamentos } from './components/Orcamentos';
import { Fornecedores } from './components/Fornecedores';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#333',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <ConnectionStatus />
          <Routes>
            <Route path="/print/reports" element={<PrintReportPage />} />
            <Route path="/print/etiquetas/:id" element={<ProductionLabelsPrint />} />
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </AppProvider>
      </Router>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { setNavigateToPage } = useAppContext();

  useEffect(() => {
    setNavigateToPage(setCurrentPage);
  }, [setNavigateToPage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/50">
      <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
        {renderPage(currentPage)}
      </Layout>
    </div>
  );
}

function renderPage(currentPage: string) {
  switch (currentPage) {
    case 'sales':
      return <Sales />;
    case 'debts':
      return <Debts />;
    case 'credit-card':
      return <CreditCard />;
    case 'checks':
      return <Checks />;
    case 'boletos':
      return <Boletos />;
    case 'pix-fees':
      return <PixFees />;
    case 'employees':
      return <Employees />;
    case 'cash':
      return <CashManagement />;
    case 'taxes':
      return <Taxes />;
    case 'reports':
      return <Reports />;
    case 'agenda':
      return <Agenda />;
    case 'acertos':
      return <Acertos />;
    case 'permutas':
      return <Permutas />;
    case 'estoque':
      return <Estoque />;
    case 'producao':
      return <Producao />;
    case 'clientes':
      return <ClientesPage />;
    case 'fornecedores':
      return <Fornecedores />;
    case 'orcamentos':
      return <Orcamentos />;
    default:
      return <Dashboard />;
  }
}

export default App;