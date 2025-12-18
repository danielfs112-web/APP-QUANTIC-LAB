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
import { initializeApp, getApps } from 'firebase/app';
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
 * Se utiliza una lógica de carga segura para evitar errores de compilación
 * relacionados con el objeto import.meta en diferentes entornos.
 */
const loadConfig = () => {
  let config = null;
  let source = "none";

  try {
    // Intentar acceder a las variables de entorno de Vite de forma segura
    // @ts-ignore
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const viteConfig = env.VITE_FIREBASE_CONFIG;
    
    if (viteConfig && viteConfig !== "") {
      config = JSON.parse(viteConfig);
      source = "Vercel (Vite)";
    }
  } catch (e) {
    console.warn("No se pudo cargar VITE_FIREBASE_CONFIG de forma directa.");
  }

  // Intentar leer del entorno de previsualización del chat
  if (!config) {
    try {
      if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        config = JSON.parse(__firebase_config);
        source = "Chat Preview";
      }
    } catch (e) {
      console.warn("No se detectó __firebase_config global.");
    }
  }

  return { config, source };
};

const { config: firebaseConfig, source: configSource } = loadConfig();

// Obtener el ID de la app de forma segura
const getAppId = () => {
  try {
    // @ts-ignore
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const viteId = env.VITE_APP_ID;
    if (viteId) return viteId;
  } catch (e) {}
  
  if (typeof __app_id !== 'undefined') return __app_id;
  return 'anuarios-manager-v1';
};

const appId = getAppId();

// Inicializar Firebase solo si existe configuración
let app, auth, db;
if (firebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Error inicializando Firebase:", e);
  }
}

// --- Componentes de UI ---
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

  const [orderForm, setOrderForm] = useState({ cliente: '', descripcion: '', total: 0, adelanto: 0, estado: 'Pendiente' });
  const [expenseForm, setExpenseForm] = useState({ concepto: '', monto: 0, fecha: new Date().toISOString().split('T')[0] });
  const [inventoryForm, setInventoryForm] = useState({ item: '', stock: 0, minimo: 5 });

  // 1. Diagnóstico de errores en pantalla
  if (!firebaseConfig) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-white p-10 text-center">
        <div className="bg-red-50 p-8 rounded-2xl border border-red-100 max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800">Error de Conexión</h1>
          <p className="text-slate-600 mt-4 text-sm leading-relaxed">
            La aplicación no ha detectado las "llaves" necesarias para funcionar.
          </p>
          <div className="mt-6 text-left bg-white p-4 rounded-lg border border-red-100 text-[11px] font-mono text-slate-500">
            <p className="font-bold text-red-600 mb-2 underline">VERIFICA ESTO EN VERCEL:</p>
            <p>1. Ve a Settings {"->"} Environment Variables</p>
            <p>2. Agrega: <span className="text-blue-600">VITE_FIREBASE_CONFIG</span></p>
            <p>3. Agrega: <span className="text-blue-600">VITE_APP_ID</span></p>
            <p className="mt-2 text-[10px] opacity-70">Nota: Deben empezar con VITE_ obligatoriamente.</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-bold"
          >
            Reintentar Carga
          </button>
        </div>
      </div>
    );
  }

  // 2. Autenticación
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
        console.error("Auth error:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 3. Datos en tiempo real
  useEffect(() => {
    if (!user || !db) return;

    const paths = {
      orders: collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
      expenses: collection(db, 'artifacts', appId, 'public', 'data', 'expenses'),
      inventory: collection(db, 'artifacts', appId, 'public', 'data', 'inventory')
    };

    const unsubOrders = onSnapshot(paths.orders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error pedidos:", err));

    const unsubExpenses = onSnapshot(paths.expenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error finanzas:", err));

    const unsubInventory = onSnapshot(paths.inventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error inventario:", err));

    return () => {
      unsubOrders();
      unsubExpenses();
      unsubInventory();
    };
  }, [user]);

  const addData = async (type, data) => {
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', type);
      await addDoc(col, { ...data, createdAt: new Date().toISOString() });
      setIsModalOpen(null);
    } catch (e) { console.error("Error add:", e); }
  };

  const updateStatus = async (id, newStatus) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', id);
    await updateDoc(docRef, { estado: newStatus });
  };

  const deleteItem = async (type, id) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', type, id);
    await deleteDoc(docRef);
  };

  const stats = useMemo(() => {
    const totalVentas = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalRecaudado = orders.reduce((sum, o) => sum + (Number(o.adelanto) || 0), 0);
    const totalGastos = expenses.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);
    const pedidosPendientes = orders.filter(o => o.estado !== 'Entregado').length;
    return { totalVentas, totalRecaudado, totalGastos, pedidosPendientes, balance: totalRecaudado - totalGastos };
  }, [orders, expenses]);

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-blue-600 font-medium animate-pulse">Cargando aplicación...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Navegación lateral (Desktop) */}
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
          <p className="text-[10px] text-slate-400 font-mono">Config: {configSource}</p>
        </div>
      </aside>

      {/* Área principal */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
          <h1 className="text-lg font-bold">
            {activeTab === 'dashboard' ? 'Resumen' : activeTab === 'orders' ? 'Pedidos' : activeTab === 'finance' ? 'Caja' : 'Inventario'}
          </h1>
          <div className="flex gap-2">
            {activeTab === 'orders' && <Button onClick={() => setIsModalOpen('order')} icon={Plus} className="text-sm px-3">Nuevo</Button>}
            {activeTab === 'finance' && <Button onClick={() => setIsModalOpen('expense')} icon={Plus} className="text-sm px-3">Gasto</Button>}
            {activeTab === 'inventory' && <Button onClick={() => setIsModalOpen('inventory')} icon={Plus} className="text-sm px-3">Stock</Button>}
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard label="Ventas" value={`$${stats.totalVentas}`} icon={TrendingUp} color="text-emerald-600" />
                <StatCard label="Abonos" value={`$${stats.totalRecaudado}`} icon={DollarSign} color="text-blue-600" />
                <StatCard label="Gastos" value={`$${stats.totalGastos}`} icon={TrendingDown} color="text-red-600" />
                <StatCard label="Activos" value={stats.pedidosPendientes} icon={Clock} color="text-amber-600" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Pedidos Recientes</h3>
                  <div className="space-y-2">
                    {orders.slice(0, 5).map(o => (
                      <div key={o.id} className="flex items-center justify-between p-2 border-b border-slate-50 last:border-0">
                        <span className="text-sm font-medium">{o.cliente}</span>
                        <Badge status={o.estado}>{o.estado}</Badge>
                      </div>
                    ))}
                    {orders.length === 0 && <p className="text-slate-400 text-xs py-4">No hay datos.</p>}
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="font-bold mb-4 text-red-600">Stock Bajo</h3>
                  <div className="space-y-2">
                    {inventory.filter(i => i.stock <= i.minimo).map(i => (
                      <div key={i.id} className="flex items-center justify-between text-xs bg-red-50 p-2 rounded">
                        <span className="font-bold">{i.item}</span>
                        <span>{i.stock} un.</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Pedidos */}
          {activeTab === 'orders' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase">Estado</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase">Pagos</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium">{o.cliente}</td>
                        <td className="px-4 py-3">
                          <select 
                            value={o.estado}
                            onChange={(e) => updateStatus(o.id, e.target.value)}
                            className="text-[11px] font-bold border rounded p-1"
                          >
                            {['Pendiente', 'En Diseño', 'En Impresión', 'Listo', 'Entregado'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-emerald-600">${o.adelanto} <span className="text-slate-400 font-normal">/ ${o.total}</span></p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteItem('orders', o.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Finanzas */}
          {activeTab === 'finance' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 overflow-hidden">
                   {expenses.map(e => (
                     <div key={e.id} className="p-4 border-b flex justify-between items-center text-sm">
                        <div><p className="font-bold">{e.concepto}</p><p className="text-xs text-slate-400">{e.fecha}</p></div>
                        <div className="flex items-center gap-4">
                          <span className="text-red-600 font-bold">-${e.monto}</span>
                          <button onClick={() => deleteItem('expenses', e.id)} className="text-slate-200"><Trash2 size={14}/></button>
                        </div>
                     </div>
                   ))}
                   {expenses.length === 0 && <p className="p-10 text-center text-slate-400 italic">No hay gastos.</p>}
                </Card>
                <Card className="p-6 bg-blue-600 text-white shadow-xl h-fit">
                   <h3 className="text-xs opacity-70 font-bold uppercase mb-2">Balance General</h3>
                   <p className="text-4xl font-black">${stats.balance.toFixed(2)}</p>
                </Card>
             </div>
          )}

          {/* Inventario */}
          {activeTab === 'inventory' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.map(i => (
                  <Card key={i.id} className="p-5">
                     <h3 className="font-bold text-slate-700 mb-1">{i.item}</h3>
                     <p className="text-3xl font-black mb-4">{i.stock}</p>
                     <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', i.id), { stock: Math.max(0, i.stock - 1) })} className="w-8 h-8 border rounded hover:bg-slate-50 font-bold">-</button>
                          <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', i.id), { stock: i.stock + 1 })} className="w-8 h-8 border rounded hover:bg-slate-50 font-bold">+</button>
                        </div>
                        <button onClick={() => deleteItem('inventory', i.id)} className="text-slate-200"><Trash2 size={16}/></button>
                     </div>
                  </Card>
                ))}
             </div>
          )}
        </div>
      </main>

      {/* Navegación móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-40">
        <button onClick={() => setActiveTab('dashboard')} className={`p-2 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}><LayoutDashboard size={20} /></button>
        <button onClick={() => setActiveTab('orders')} className={`p-2 ${activeTab === 'orders' ? 'text-blue-600' : 'text-slate-400'}`}><ShoppingBag size={20} /></button>
        <button onClick={() => setActiveTab('finance')} className={`p-2 ${activeTab === 'finance' ? 'text-blue-600' : 'text-slate-400'}`}><DollarSign size={20} /></button>
        <button onClick={() => setActiveTab('inventory')} className={`p-2 ${activeTab === 'inventory' ? 'text-blue-600' : 'text-slate-400'}`}><Package size={20} /></button>
      </nav>

      {/* Modales */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 shadow-2xl">
            <h2 className="text-lg font-bold mb-4">Añadir {isModalOpen}</h2>
            <div className="space-y-4">
              {isModalOpen === 'order' && (
                <>
                  <input className="w-full p-2 border rounded-lg bg-slate-50" placeholder="Cliente" onChange={e => setOrderForm({...orderForm, cliente: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="w-full p-2 border rounded-lg bg-slate-50" type="number" placeholder="Total" onChange={e => setOrderForm({...orderForm, total: Number(e.target.value)})} />
                    <input className="w-full p-2 border rounded-lg bg-slate-50" type="number" placeholder="Abono" onChange={e => setOrderForm({...orderForm, adelanto: Number(e.target.value)})} />
                  </div>
                  <Button className="w-full" onClick={() => addData('orders', orderForm)}>Guardar</Button>
                </>
              )}
              {isModalOpen === 'expense' && (
                <>
                  <input className="w-full p-2 border rounded-lg bg-slate-50" placeholder="Concepto" onChange={e => setExpenseForm({...expenseForm, concepto: e.target.value})} />
                  <input className="w-full p-2 border rounded-lg bg-slate-50" type="number" placeholder="Monto" onChange={e => setExpenseForm({...expenseForm, monto: Number(e.target.value)})} />
                  <Button className="w-full" onClick={() => addData('expenses', expenseForm)}>Guardar</Button>
                </>
              )}
              {isModalOpen === 'inventory' && (
                <>
                  <input className="w-full p-2 border rounded-lg bg-slate-50" placeholder="Nombre" onChange={e => setInventoryForm({...inventoryForm, item: e.target.value})} />
                  <input className="w-full p-2 border rounded-lg bg-slate-50" type="number" placeholder="Stock" onChange={e => setInventoryForm({...inventoryForm, stock: Number(e.target.value)})} />
                  <Button className="w-full" onClick={() => addData('inventory', inventoryForm)}>Guardar</Button>
                </>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setIsModalOpen(null)}>Cerrar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function NavItem({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
      <Icon size={20} /> {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="p-3 flex justify-between items-center">
      <div><p className="text-slate-400 text-[9px] font-bold uppercase">{label}</p><p className="text-base font-bold">{value}</p></div>
      <div className={color}><Icon size={18} /></div>
    </Card>
  );
}
