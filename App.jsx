import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  DollarSign, 
  Package, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertCircle,
  Trash2,
  User,
  ShoppingBag
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';

/**
 * CONFIGURACIÓN DE FIREBASE
 * Optimizada para evitar errores de compilación en entornos ES2015.
 */
const getSafeEnv = (key) => {
  try {
    // Intentamos acceder a import.meta de forma segura
    const meta = (globalThis && globalThis.import && globalThis.import.meta) || {};
    const env = meta.env || {};
    return env[key];
  } catch (e) {
    return undefined;
  }
};

const getFirebaseConfig = () => {
  try {
    // 1. Intentar desde variables de Vercel (VITE_FIREBASE_CONFIG)
    // Usamos una evaluación indirecta para evitar que el compilador se queje de import.meta
    const viteConfig = getSafeEnv('VITE_FIREBASE_CONFIG');
    if (viteConfig) return JSON.parse(viteConfig);
    
    // 2. Intentar desde el entorno de previsualización del chat
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Error al cargar la configuración de Firebase:", e);
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const appId = getSafeEnv('VITE_APP_ID') || 
              (typeof __app_id !== 'undefined' ? __app_id : 'anuarios-manager-v1');

// Inicializar Firebase solo si la configuración es válida
let app, auth, db;
if (firebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Error inicializando servicios de Firebase:", e);
  }
}

// --- Componentes Reutilizables de UI ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", icon: Icon }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-50"
  };
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const Badge = ({ children, status }) => {
  const styles = {
    'Pendiente': 'bg-yellow-100 text-yellow-700',
    'En Diseño': 'bg-blue-100 text-blue-700',
    'En Impresión': 'bg-purple-100 text-purple-700',
    'Listo': 'bg-green-100 text-green-700',
    'Entregado': 'bg-slate-100 text-slate-700',
    'Bajo Stock': 'bg-red-100 text-red-700',
    'Normal': 'bg-green-100 text-green-700'
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {children}
    </span>
  );
};

// --- Aplicación Principal ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(null);

  // Estados de formularios
  const [orderForm, setOrderForm] = useState({ cliente: '', descripcion: '', total: 0, adelanto: 0, estado: 'Pendiente' });
  const [expenseForm, setExpenseForm] = useState({ concepto: '', monto: 0, fecha: new Date().toISOString().split('T')[0] });
  const [inventoryForm, setInventoryForm] = useState({ item: '', stock: 0, minimo: 5 });

  // 1. Pantalla de error si falta la configuración
  if (!firebaseConfig) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-slate-800">Falta Configuración</h1>
        <p className="text-slate-500 mt-2 max-w-md text-sm">
          La aplicación no pudo conectar con la base de datos. Si estás en Vercel, verifica las variables <code className="bg-slate-200 px-1 rounded text-red-600">VITE_FIREBASE_CONFIG</code> y <code className="bg-slate-200 px-1 rounded text-red-600">VITE_APP_ID</code>.
        </p>
      </div>
    );
  }

  // 2. Gestión de Autenticación
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Error en autenticación:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 3. Suscripción a la base de datos (Firestore)
  useEffect(() => {
    if (!user || !db) return;

    const paths = {
      orders: collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
      expenses: collection(db, 'artifacts', appId, 'public', 'data', 'expenses'),
      inventory: collection(db, 'artifacts', appId, 'public', 'data', 'inventory')
    };

    const unsubOrders = onSnapshot(paths.orders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error en pedidos:", err));

    const unsubExpenses = onSnapshot(paths.expenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error en finanzas:", err));

    const unsubInventory = onSnapshot(paths.inventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error en inventario:", err));

    return () => {
      unsubOrders();
      unsubExpenses();
      unsubInventory();
    };
  }, [user]);

  // Funciones de Base de Datos
  const addData = async (type, data) => {
    if (!db) return;
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', type);
      await addDoc(col, { ...data, createdAt: new Date().toISOString() });
      setIsModalOpen(null);
    } catch (e) { console.error("Error al guardar:", e); }
  };

  const updateStatus = async (id, newStatus) => {
    if (!db) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', id);
    await updateDoc(docRef, { estado: newStatus });
  };

  const deleteItem = async (type, id) => {
    if (!db) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', type, id);
    await deleteDoc(docRef);
  };

  // Cálculos de Negocio
  const stats = useMemo(() => {
    const totalVentas = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalRecaudado = orders.reduce((sum, o) => sum + (Number(o.adelanto) || 0), 0);
    const totalGastos = expenses.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);
    const pedidosPendientes = orders.filter(o => o.estado !== 'Entregado').length;
    return { totalVentas, totalRecaudado, totalGastos, pedidosPendientes, balance: totalRecaudado - totalGastos };
  }, [orders, expenses]);

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-blue-600 font-medium animate-pulse">Iniciando sistema seguro...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar / Navegación */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-3 text-blue-600 mb-8">
            <BookOpen size={28} strokeWidth={2.5} />
            <span className="font-bold text-xl tracking-tight">StudioManager</span>
          </div>
          <nav className="space-y-1">
            <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Tablero" />
            <NavItem active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={ShoppingBag} label="Pedidos" />
            <NavItem active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={DollarSign} label="Finanzas" />
            <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={Package} label="Inventario" />
          </nav>
        </div>
        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <User size={16} />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">Administrador</p>
              <p className="text-[10px] text-slate-400">ID: {user.uid.substring(0, 8)}...</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="md:hidden text-blue-600"><BookOpen size={24} /></div>
            <h1 className="text-lg font-semibold">
              {activeTab === 'dashboard' ? 'Resumen' : activeTab === 'orders' ? 'Pedidos' : activeTab === 'finance' ? 'Finanzas' : 'Inventario'}
            </h1>
          </div>
          <div className="flex gap-3">
            {activeTab === 'orders' && <Button onClick={() => setIsModalOpen('order')} icon={Plus}>Pedido</Button>}
            {activeTab === 'finance' && <Button onClick={() => setIsModalOpen('expense')} icon={Plus}>Gasto</Button>}
            {activeTab === 'inventory' && <Button onClick={() => setIsModalOpen('inventory')} icon={Plus}>Insumo</Button>}
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Ventas" value={`$${stats.totalVentas}`} icon={TrendingUp} color="text-emerald-600" />
                <StatCard label="Abonos" value={`$${stats.totalRecaudado}`} icon={DollarSign} color="text-blue-600" />
                <StatCard label="Gastos" value={`$${stats.totalGastos}`} icon={TrendingDown} color="text-red-600" />
                <StatCard label="Pendientes" value={stats.pedidosPendientes} icon={Clock} color="text-amber-600" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><Clock size={18}/> Pedidos Recientes</h3>
                  <div className="space-y-3">
                    {orders.slice(0, 5).map(o => (
                      <div key={o.id} className="flex items-center justify-between p-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <span className="text-sm font-medium">{o.cliente}</span>
                        <Badge status={o.estado}>{o.estado}</Badge>
                      </div>
                    ))}
                    {orders.length === 0 && <p className="text-slate-400 text-sm italic py-4 text-center">Sin pedidos registrados.</p>}
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-red-600"><AlertCircle size={18}/> Stock Crítico</h3>
                  <div className="space-y-3">
                    {inventory.filter(i => i.stock <= i.minimo).map(i => (
                      <div key={i.id} className="flex items-center justify-between text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                        <span className="font-medium">{i.item}</span>
                        <span className="font-bold">{i.stock} un.</span>
                      </div>
                    ))}
                    {inventory.filter(i => i.stock <= i.minimo).length === 0 && <p className="text-emerald-600 text-sm text-center py-4">Inventario completo y suficiente.</p>}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* PEDIDOS */}
          {activeTab === 'orders' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Finanzas</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-sm">{o.cliente}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{o.descripcion}</p>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            value={o.estado}
                            onChange={(e) => updateStatus(o.id, e.target.value)}
                            className="text-xs font-bold border border-slate-200 bg-white rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {['Pendiente', 'En Diseño', 'En Impresión', 'Listo', 'Entregado'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-xs">Total: ${o.total}</span>
                            <span className="text-emerald-600 font-bold">Abono: ${o.adelanto}</span>
                            <span className="text-xs font-bold text-slate-800">Resta: ${(o.total - o.adelanto).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => deleteItem('orders', o.id)} className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all">
                            <Trash2 size={16}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* FINANZAS */}
          {activeTab === 'finance' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 overflow-hidden">
                   <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 text-sm uppercase">Gastos Operativos</div>
                   <div className="divide-y divide-slate-50">
                     {expenses.map(e => (
                       <div key={e.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="font-bold text-sm text-slate-800">{e.concepto}</p>
                            <p className="text-xs text-slate-400">{e.fecha}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-red-600 font-bold">-${e.monto}</span>
                            <button onClick={() => deleteItem('expenses', e.id)} className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                          </div>
                       </div>
                     ))}
                     {expenses.length === 0 && <p className="p-12 text-center text-slate-400 text-sm italic">No hay registros financieros.</p>}
                   </div>
                </Card>
                <div className="space-y-4">
                  <Card className="p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-200">
                    <h3 className="text-sm font-medium opacity-80 mb-1">Caja Chica (Balance)</h3>
                    <p className="text-4xl font-bold">${stats.balance.toFixed(2)}</p>
                    <div className="mt-6 space-y-2 border-t border-blue-500/30 pt-4">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="opacity-70">Abonos Recibidos:</span>
                        <span>+${stats.totalRecaudado}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="opacity-70">Gastos Totales:</span>
                        <span>-${stats.totalGastos}</span>
                      </div>
                    </div>
                  </Card>
                </div>
             </div>
          )}

          {/* INVENTARIO */}
          {activeTab === 'inventory' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {inventory.map(i => (
                  <Card key={i.id} className={`p-6 border-t-4 ${i.stock <= i.minimo ? 'border-t-red-500' : 'border-t-emerald-500'} relative overflow-hidden`}>
                     {i.stock <= i.minimo && (
                       <div className="absolute top-2 right-2"><AlertCircle size={16} className="text-red-500 animate-pulse"/></div>
                     )}
                     <h3 className="font-bold text-slate-700 mb-1">{i.item}</h3>
                     <p className="text-xs text-slate-400 mb-4 font-medium uppercase tracking-widest">Existencia Actual</p>
                     <p className="text-4xl font-black text-slate-800 mb-6">{i.stock}</p>
                     <div className="flex gap-2 justify-between items-center">
                        <div className="flex gap-2">
                          <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', i.id), { stock: Math.max(0, i.stock - 1) })} className="w-10 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-lg">-</button>
                          <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', i.id), { stock: i.stock + 1 })} className="w-10 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-lg">+</button>
                        </div>
                        <button onClick={() => deleteItem('inventory', i.id)} className="text-slate-200 hover:text-red-400 transition-colors">
                          <Trash2 size={18}/>
                        </button>
                     </div>
                  </Card>
                ))}
                {inventory.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Package size={48} className="text-slate-200 mb-4" />
                    <p className="text-slate-400 font-medium">No hay insumos registrados en el almacén.</p>
                  </div>
                )}
             </div>
          )}
        </div>
      </main>

      {/* Navegación móvil (Inferior) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-50">
        <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><LayoutDashboard size={20} /></button>
        <button onClick={() => setActiveTab('orders')} className={`p-2 rounded-lg ${activeTab === 'orders' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><ShoppingBag size={20} /></button>
        <button onClick={() => setActiveTab('finance')} className={`p-2 rounded-lg ${activeTab === 'finance' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><DollarSign size={20} /></button>
        <button onClick={() => setActiveTab('inventory')} className={`p-2 rounded-lg ${activeTab === 'inventory' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><Package size={20} /></button>
      </nav>

      {/* Modales */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              <Plus size={20} className="text-blue-600"/> Añadir {isModalOpen === 'order' ? 'Pedido' : isModalOpen === 'expense' ? 'Gasto' : 'Insumo'}
            </h2>
            <div className="space-y-4">
              {isModalOpen === 'order' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cliente / Escuela</label>
                    <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" placeholder="Nombre completo" onChange={e => setOrderForm({...orderForm, cliente: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Detalles del Trabajo</label>
                    <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" placeholder="Ej. 100 Anuarios" onChange={e => setOrderForm({...orderForm, descripcion: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Precio Total</label>
                      <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" type="number" placeholder="0.00" onChange={e => setOrderForm({...orderForm, total: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Abono Inicial</label>
                      <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" type="number" placeholder="0.00" onChange={e => setOrderForm({...orderForm, adelanto: Number(e.target.value)})} />
                    </div>
                  </div>
                  <Button className="w-full py-3 mt-4" onClick={() => addData('orders', orderForm)}>Guardar Pedido</Button>
                </>
              )}
              {isModalOpen === 'expense' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Concepto de Gasto</label>
                    <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" placeholder="Ej. Pago local / Tinta" onChange={e => setExpenseForm({...expenseForm, concepto: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Monto Gastado</label>
                    <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" type="number" placeholder="0.00" onChange={e => setExpenseForm({...expenseForm, monto: Number(e.target.value)})} />
                  </div>
                  <Button className="w-full py-3 mt-4" onClick={() => addData('expenses', expenseForm)}>Registrar Salida</Button>
                </>
              )}
              {isModalOpen === 'inventory' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Material</label>
                    <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" placeholder="Ej. Hojas Glace" onChange={e => setInventoryForm({...inventoryForm, item: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Stock Inicial</label>
                      <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" type="number" onChange={e => setInventoryForm({...inventoryForm, stock: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Mínimo Alerta</label>
                      <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" type="number" onChange={e => setInventoryForm({...inventoryForm, minimo: Number(e.target.value)})} />
                    </div>
                  </div>
                  <Button className="w-full py-3 mt-4" onClick={() => addData('inventory', inventoryForm)}>Añadir Stock</Button>
                </>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setIsModalOpen(null)}>Cancelar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Subcomponentes adicionales
function NavItem({ active, onClick, icon: Icon, label }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} /> {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
      <div>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
      <div className={`${color} p-2 bg-slate-50 rounded-lg hidden sm:block`}>
        <Icon size={20} />
      </div>
    </Card>
  );
}
