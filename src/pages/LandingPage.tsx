import { ArrowRight, ShieldCheck, Wallet, LineChart, Users, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Jika sudah login, langsung ke dashboard
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-khzm-green selection:text-white overflow-hidden">
      
      {/* Navbar / Header */}
      <header className="absolute top-0 w-full z-50 py-6 px-6 sm:px-12 lg:px-24 flex justify-between items-center bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo KHZM" className="w-14 h-14 object-contain" onError={(e) => { e.currentTarget.style.display='none' }}/>
          <span className="font-bold text-xl tracking-tight">SIP <span className="text-khzm-green">KHZM</span></span>
        </div>
        <nav>
          <button 
            onClick={() => navigate('/login')}
            className="text-sm font-semibold hover:text-khzm-green transition-colors px-4 py-2"
          >
            Masuk Akun
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 sm:px-12 lg:px-24 max-w-7xl mx-auto flex flex-col lg:flex-row items-center min-h-screen">
        
        {/* Abstract Background Elements (CSS only) */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-khzm-emerald/10 blur-[100px] -z-10 pointer-events-none animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-50 blur-[120px] -z-10 pointer-events-none animate-pulse" style={{ animationDuration: '10s' }}></div>
        
        {/* Left Text Content */}
        <div className="lg:w-1/2 z-10 flex flex-col items-center lg:items-start text-center lg:text-left space-y-8 animate-in slide-in-from-bottom-10 fade-in duration-1000">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-khzm-green text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            Keamanan Data Terjamin
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-slate-900">
            Sistem Keuangan <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-khzm-emerald to-khzm-green">
              Pondok Pesantren
            </span>
            <br/> KH Zumrotul Muttaqin
          </h1>
          
          <p className="text-lg text-slate-600 max-w-xl leading-relaxed">
            Platform modern untuk manajemen finansial pesantren. Terpusat, transparan, dan sangat mudah digunakan oleh pengurus maupun bendahara.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center lg:justify-start">
            <button 
              onClick={() => navigate('/login')}
              className="group relative inline-flex justify-center items-center gap-2 px-8 py-4 bg-khzm-green text-white font-bold rounded-2xl shadow-xl shadow-khzm-green/20 hover:shadow-2xl hover:shadow-khzm-green/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              <span className="relative z-10">Mulai Gunakan Sistem</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            </button>
          </div>

          <div className="flex items-center gap-6 pt-6 text-sm font-medium text-slate-500">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-khzm-green"/> Cepat</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-khzm-green"/> Transparan</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-khzm-green"/> Akurat</div>
          </div>
        </div>

        {/* Right Floating Elements Animation */}
        <div className="lg:w-1/2 relative mt-20 lg:mt-0 h-[400px] lg:h-[600px] w-full flex justify-center items-center animate-in fade-in duration-1000 delay-300">
          
          {/* Main Central Card */}
          <div className="absolute z-20 w-64 bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 animate-[bounce_6s_ease-in-out_infinite]">
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-khzm-green" />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">+ Rp 500.000</span>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-1/2 bg-gray-100 rounded-full"></div>
              <div className="h-2 w-3/4 bg-gray-100 rounded-full"></div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-end">
              <span className="text-xs text-gray-400 font-medium">Saldo Kas</span>
              <span className="text-lg font-black text-gray-800">Rp 4.5M</span>
            </div>
          </div>

          {/* Floating Card 1 (Top Left) */}
          <div className="absolute z-10 w-48 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 -ml-40 -mt-40 animate-[bounce_7s_ease-in-out_infinite_0.5s] hidden sm:block">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <LineChart className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-gray-600">Grafik Masuk</span>
            </div>
            <div className="flex items-end gap-1 h-12">
              <div className="w-full bg-blue-100 rounded-t-sm h-[30%]"></div>
              <div className="w-full bg-blue-200 rounded-t-sm h-[50%]"></div>
              <div className="w-full bg-blue-300 rounded-t-sm h-[80%]"></div>
              <div className="w-full bg-blue-500 rounded-t-sm h-[100%]"></div>
            </div>
          </div>

          {/* Floating Card 2 (Bottom Right) */}
          <div className="absolute z-30 w-52 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 ml-32 mt-48 animate-[bounce_8s_ease-in-out_infinite_1s] hidden sm:block">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-orange-500" />
              </div>
              <span className="text-xs font-bold text-gray-600">Data Santri</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                <div className="h-1.5 w-20 bg-gray-100 rounded-full"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                <div className="h-1.5 w-16 bg-gray-100 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Background circles */}
          <div className="absolute w-80 h-80 rounded-full border border-dashed border-gray-200 animate-[spin_60s_linear_infinite]"></div>
          <div className="absolute w-[400px] h-[400px] rounded-full border border-dashed border-gray-100 animate-[spin_80s_linear_infinite_reverse]"></div>

        </div>

      </section>

    </div>
  );
};

export default LandingPage;
