import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';

export default function BenefitsCheck() {
  const [search, setSearch] = useState('');
  const [employee, setEmployee] = useState(null);

  const handleSearch = (e) => {
    e.preventDefault();

    if (search === '123') {
      setEmployee({
        id: 1,
        name: 'Matteus Tirado',
        role: 'Gerente',
        benefits: {
          consumo: { 
            status: 'available', 
            limit: 100, 
            used: 20 
          },
          entrada: { 
            status: 'used', 
            date: '13/01/2026 14:30' 
          }
        }
      });
    } else {
      toast.error("Colaborador não encontrado.");
      setEmployee(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex">
      <Sidebar 
        activePage="benefits" 
        headerTitle="Gestão de Pessoas" 
        headerIcon="groups" 
        group="people" 
      />

      <main className="ml-64 flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Conferência de Benefícios
          </h1>
          <p className="text-white/50">
            Verifique a disponibilidade de benefícios diários.
          </p>
        </header>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="relative mb-10">
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite o CPF ou Matrícula..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-xl text-white focus:outline-none focus:border-blue-500 transition-colors shadow-lg"
            />
            <button 
              type="submit" 
              className="absolute right-3 top-3 bg-blue-600 p-2 rounded-xl text-white hover:bg-blue-500 transition-colors"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
          </form>

          {employee && (
            <div className="liquid-glass rounded-3xl p-8 animate-fade-in">
              
              <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{employee.name}</h2>
                  <p className="text-white/50">{employee.role}</p>
                </div>
                <div className="ml-auto">
                  <span className="bg-green-500/20 text-green-400 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest border border-green-500/30">
                    Ativo
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                
                <div className="bg-white/5 p-5 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-lg text-yellow-400">
                      <span className="material-symbols-outlined">restaurant</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Consumo Diário</h3>
                      <p className="text-sm text-white/50">
                        Limite: R$ {employee.benefits.consumo.limit},00
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      R$ {employee.benefits.consumo.used},00
                    </p>
                    <p className="text-xs text-yellow-400">Utilizado hoje</p>
                  </div>
                </div>

                <div 
                  className={`p-5 rounded-xl border flex justify-between items-center ${
                    employee.benefits.entrada.status === 'used' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className={`p-3 rounded-lg ${
                        employee.benefits.entrada.status === 'used' 
                          ? 'bg-red-500/20 text-red-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      <span className="material-symbols-outlined">confirmation_number</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Entrada Free</h3>
                      <p className="text-sm text-white/50">
                        {employee.benefits.entrada.status === 'used' 
                          ? 'Já utilizado hoje' 
                          : 'Disponível'}
                      </p>
                    </div>
                  </div>
                  
                  {employee.benefits.entrada.status === 'used' && (
                    <div className="text-right">
                      <span className="text-xs text-red-300 bg-red-900/40 px-2 py-1 rounded">
                        Utilizado às {employee.benefits.entrada.date.split(' ')[1]}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}