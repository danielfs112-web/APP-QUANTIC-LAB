import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  DollarSign, 
  Package, 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  Trash2,
  Edit2,
  ChevronRight,
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
  deleteDoc, 
  query 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';

// --- Configuración de Firebase ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'anuarios-manager-v1';

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
  const [isModalOpen, setIsModalOpen] = useState(null); // 'order', 'expense', 'inventory'

  // Form states
  const [orderForm, setOrderForm] = useState({ cliente: '', descripcion: '', total: 0, adelanto: 0, estado: 'Pendiente', fechaEntrega: '' });
  const [expenseForm, setExpenseForm] = useState({ concepto: '', monto: 0, fecha: new Date().toISOString().split('T')[0] });
  const [inventoryForm, setInventoryForm] = useState({ item: '', stock: 0, minimo: 5 });

  // Auth initialization
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data subscriptions
  useEffect(() => {
    if (!user) return;

    const paths = {
      orders: collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
      expenses: collection(db, 'artifacts', appId, 'public', 'data', 'expenses'),
      inventory: collection(db, 'artifacts', appId, 'public', 'data', 'inventory')
    };

    const unsubOrders = onSnapshot(paths.orders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error orders:", err));

    const unsubExpenses = onSnapshot(paths.expenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error expenses:", err));

    const unsubInventory = onSnapshot(paths.inventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error inventory:", err));

    return () => {
      unsubOrders();
      unsubExpenses();
      unsubInventory();
    };
  }, [user]);

  // Helpers
  const addData = async (type, data) => {
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', type);
      await addDoc(col, { ...data, createdAt: new Date().toISOString() });
      setIsModalOpen(null);
    } catch (e) { console.error("Error adding doc:", e); }
  };

  const updateStatus = async (id, newStatus) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', id);
    await updateDoc(docRef, { estado: newStatus });
  };

  const deleteItem = async (type, id) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', type, id);
    await deleteDoc(docRef);
  };

  // Calculations
  const stats = useMemo(() => {
    const totalVentas = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalRecaudado = orders.reduce((sum, o) => sum + (Number(o.adelanto) || 0), 0);
    const totalGastos = expenses.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);
    const pedidosPendientes = orders.filter(o => o.estado !== 'Entregado').length;
    return { totalVentas, totalRecaudado, totalGastos, pedidosPendientes, balance: totalRecaudado - totalGastos };
  }, [orders, expenses]);

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="animate-pulse text-blue-600 font-medium">Cargando sistema...</div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 text-blue-600 mb-8">
            <BookOpen size={28} strokeWidth={2.5} />
            <span className="font-bold text-xl tracking-tight">StudioManager</span>
          </div>
          
          <nav className="space-y-1">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={LayoutDashboard} 
              label="Tablero" 
            />
            <NavItem 
              active={activeTab === 'orders'} 
              onClick={() => setActiveTab('orders')} 
              icon={ShoppingBag} 
              label="Pedidos" 
            />
            <NavItem 
              active={activeTab === 'finance'} 
              onClick={() => setActiveTab('finance')} 
              icon={DollarSign} 
              label="Finanzas" 
            />
            <NavItem 
              active={activeTab === 'inventory'} 
              onClick={() => setActiveTab('inventory')} 
              icon={Package} 
              label="Inventario" 
            />
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <User size={16} />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">Usuario Admin</p>
              <p className="text-[10px] text-slate-400 truncate">{user.uid}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-lg font-semibold capitalize">
            {activeTab === 'dashboard' ? 'Resumen General' : 
             activeTab === 'orders' ? 'Control de Pedidos' : 
             activeTab === 'finance' ? 'Ingresos y Gastos' : 'Almacén e Insumos'}
          </h1>
          <div className="flex gap-3">
            {activeTab === 'orders' && <Button onClick={() => setIsModalOpen('order')} icon={Plus}>Nuevo Pedido</Button>}
            {activeTab === 'finance' && <Button onClick={() => setIsModalOpen('expense')} icon={Plus}>Registrar Gasto</Button>}
            {activeTab === 'inventory' && <Button onClick={() => setIsModalOpen('inventory')} icon={Plus}>Agregar Insumo</Button>}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Ventas Totales" value={`$${stats.totalVentas}`} icon={TrendingUp} color="text-emerald-600" />
                <StatCard label="Recaudado (Adelantos)" value={`$${stats.totalRecaudado}`} icon={DollarSign} color="text-blue-600" />
                <StatCard label="Gastos" value={`$${stats.totalGastos}`} icon={TrendingDown} color="text-red-600" />
                <StatCard label="Pedidos Activos" value={stats.pedidosPendientes} icon={Clock} color="text-amber-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800">Pedidos Recientes</h3>
                    <Button variant="ghost" className="text-xs" onClick={() => setActiveTab('orders')}>Ver todos</Button>
                  </div>
                  <div className="space-y-4">
                    {orders.slice(0, 5).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {order.cliente[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{order.cliente}</p>
                            <p className="text-xs text-slate-500">{order.descripcion}</p>
                          </div>
                        </div>
                        <Badge status={order.estado}>{order.estado}</Badge>
                      </div>
                    ))}
                    {orders.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">No hay pedidos registrados</p>}
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800">Alertas de Inventario</h3>
                    <Button variant="ghost" className="text-xs" onClick={() => setActiveTab('inventory')}>Ver stock</Button>
                  </div>
                  <div className="space-y-4">
                    {inventory.filter(i => i.stock <= i.minimo).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="text-red-500" size={20} />
                          <div>
                            <p className="font-semibold text-sm">{item.item}</p>
                            <p className="text-xs text-red-600">Quedan: {item.stock} unidades</p>
                          </div>
                        </div>
                        <Badge status="Bajo Stock">Urgente</Badge>
                      </div>
                    ))}
                    {inventory.filter(i => i.stock <= i.minimo).length === 0 && (
                      <div className="text-center py-10">
                        <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                        <p className="text-sm text-slate-500">Todo el inventario está al día</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Orders View */}
          {activeTab === 'orders' && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Detalle</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Pagos</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold">{order.cliente}</p>
                          <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.descripcion}</td>
                        <td className="px-6 py-4">
                          <select 
                            value={order.estado}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                          >
                            {['Pendiente', 'En Diseño', 'En Impresión', 'Listo', 'Entregado'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p><span className="text-slate-400">Total:</span> ${order.total}</p>
                            <p><span className="text-emerald-500">Abonado:</span> ${order.adelanto}</p>
                            <p className="font-bold text-xs mt-1">Saldo: ${(order.total - order.adelanto).toFixed(2)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => deleteItem('orders', order.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Finance View */}
          {activeTab === 'finance' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold">Historial de Gastos</h3>
                    <TrendingDown className="text-red-400" size={20} />
                  </div>
                  <div className="p-0">
                    {expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="font-medium">{expense.concepto}</p>
                          <p className="text-xs text-slate-400">{expense.fecha}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-red-600">-${expense.monto}</span>
                          <button onClick={() => deleteItem('expenses', expense.id)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {expenses.length === 0 && <p className="p-10 text-center text-slate-400 italic">No hay gastos registrados</p>}
                  </div>
                </Card>
              </div>
              <div className="space-y-6">
                <Card className="p-6 bg-blue-600 text-white">
                  <h3 className="text-blue-100 text-sm font-medium mb-1">Balance Actual</h3>
                  <p className="text-3xl font-bold">${stats.balance.toFixed(2)}</p>
                  <div className="mt-4 pt-4 border-t border-blue-500 flex justify-between text-xs">
                    <span>Recaudado: ${stats.totalRecaudado}</span>
                    <span>Gastado: ${stats.totalGastos}</span>
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Ingresos por Pedido</h3>
                  <div className="space-y-4">
                    {orders.filter(o => o.adelanto > 0).slice(0, 5).map(o => (
                      <div key={o.id} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 truncate mr-2">{o.cliente}</span>
                        <span className="text-emerald-600 font-bold">+${o.adelanto}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Inventory View */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map(item => (
                <Card key={item.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <Package size={24} />
                    </div>
                    <Badge status={item.stock <= item.minimo ? 'Bajo Stock' : 'Normal'}>
                      {item.stock <= item.minimo ? 'Reabastecer' : 'Stock OK'}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{item.item}</h3>
                  <p className="text-3xl font-black text-slate-800 mb-4">{item.stock}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventory', item.id);
                          updateDoc(docRef, { stock: Math.max(0, item.stock - 1) });
                        }}
                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                      >-</button>
                      <button 
                        onClick={() => {
                          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventory', item.id);
                          updateDoc(docRef, { stock: item.stock + 1 });
                        }}
                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                      >+</button>
                    </div>
                    <button onClick={() => deleteItem('inventory', item.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

        </div>
      </main>

      {/* Modals */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-6">
              {isModalOpen === 'order' ? 'Nuevo Pedido' : 
               isModalOpen === 'expense' ? 'Registrar Gasto' : 'Nuevo Insumo'}
            </h2>
            
            <div className="space-y-4">
              {isModalOpen === 'order' && (
                <>
                  <Input label="Cliente" value={orderForm.cliente} onChange={e => setOrderForm({...orderForm, cliente: e.target.value})} placeholder="Nombre del cliente o escuela" />
                  <Input label="Descripción" value={orderForm.descripcion} onChange={e => setOrderForm({...orderForm, descripcion: e.target.value})} placeholder="Anuario 2024, Impresiones 4x6, etc." />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Total ($)" type="number" value={orderForm.total} onChange={e => setOrderForm({...orderForm, total: e.target.value})} />
                    <Input label="Adelanto ($)" type="number" value={orderForm.adelanto} onChange={e => setOrderForm({...orderForm, adelanto: e.target.value})} />
                  </div>
                  <Button className="w-full" onClick={() => addData('orders', orderForm)}>Crear Pedido</Button>
                </>
              )}
              
              {isModalOpen === 'expense' && (
                <>
                  <Input label="Concepto" value={expenseForm.concepto} onChange={e => setExpenseForm({...expenseForm, concepto: e.target.value})} placeholder="Papel, tinta, alquiler..." />
                  <Input label="Monto ($)" type="number" value={expenseForm.monto} onChange={e => setExpenseForm({...expenseForm, monto: e.target.value})} />
                  <Input label="Fecha" type="date" value={expenseForm.fecha} onChange={e => setExpenseForm({...expenseForm, fecha: e.target.value})} />
                  <Button className="w-full" onClick={() => addData('expenses', expenseForm)}>Guardar Gasto</Button>
                </>
              )}

              {isModalOpen === 'inventory' && (
                <>
                  <Input label="Nombre del Insumo" value={inventoryForm.item} onChange={e => setInventoryForm({...inventoryForm, item: e.target.value})} placeholder="Ej. Papel Fotográfico Mate" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Stock Inicial" type="number" value={inventoryForm.stock} onChange={e => setInventoryForm({...inventoryForm, stock: Number(e.target.value)})} />
                    <Input label="Mínimo Alerta" type="number" value={inventoryForm.minimo} onChange={e => setInventoryForm({...inventoryForm, minimo: Number(e.target.value)})} />
                  </div>
                  <Button className="w-full" onClick={() => addData('inventory', inventoryForm)}>Añadir al Inventario</Button>
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

// --- Subcomponentes Auxiliares ---

function NavItem({ active, onClick, icon: Icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-blue-50 text-blue-600' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`p-2 bg-slate-50 rounded-lg ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </Card>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
      <input 
        {...props}
        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
      />
    </div>
  );
}