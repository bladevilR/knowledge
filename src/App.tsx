import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Search, Menu, MessageSquare, BookOpen, ShieldAlert, 
  Settings, History, BrainCircuit, FileText, Send,
  Cpu, Database, HardDrive, Lock, Sparkles, AlertTriangle
} from 'lucide-react';

export default function App() {
  const [inputText, setInputText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="relative flex h-screen w-full bg-[#f1f5f9] text-slate-800 font-sans overflow-hidden">
      
      {/* 🔮 Ambient Aurora Background (核心高级感来源：模糊的弥散光) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* 苏州地铁蓝光晕 */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15], x: [0, 60, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] rounded-full bg-[#0A1C40] mix-blend-multiply filter blur-[140px]"
        />
        {/* 海棠红光晕 */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1], y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[30%] -right-[15%] w-[45%] h-[50%] rounded-full bg-[#8B1831] mix-blend-multiply filter blur-[140px]"
        />
        {/* 辅助科技蓝点缀 */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.3, 0.2], x: [0, -40, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -bottom-[20%] left-[20%] w-[40%] h-[50%] rounded-full bg-[#38bdf8] mix-blend-multiply filter blur-[160px]"
        />
        {/* 增加背景纹理 */}
        <div className="absolute inset-0 opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
      </div>

      {/* 🚀 侧边栏 (Sidebar) - Vision OS Frosted Material */}
      <motion.aside 
        initial={{ width: 280 }}
        animate={{ width: isSidebarOpen ? 280 : 88 }}
        className="h-full flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-20 shrink-0 bg-white/40 backdrop-blur-2xl border-r border-white/60 shadow-[4px_0_24px_rgba(10,28,64,0.02)]"
      >
        {/* Logo 区域 */}
        <div className="p-6 flex items-center gap-4 relative">
          <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0A1C40] to-[#1e3a8a] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(10,28,64,0.3)] border border-white/20"
          >
            <BrainCircuit className="w-5 h-5 text-white" />
          </motion.div>
          {isSidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="text-slate-800 font-extrabold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-[#0A1C40] to-[#8B1831]">
                SYS:METRO
              </span>
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">
                AI Knowledge Hub
              </span>
            </motion.div>
          )}
        </div>

        {/* 导航菜单 */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          <NavItem icon={<MessageSquare className="w-4 h-4" />} label="新对话" active isOpen={isSidebarOpen} />
          <NavItem icon={<BookOpen className="w-4 h-4" />} label="线网知识图谱" isOpen={isSidebarOpen} />
          <NavItem icon={<Database className="w-4 h-4" />} label="本地部署状态" isOpen={isSidebarOpen} />
          <NavItem icon={<History className="w-4 h-4" />} label="查询审计日志" isOpen={isSidebarOpen} />
          
          <div className="pt-8 pb-3 px-3">
            {isSidebarOpen ? (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">企业业务流</p>
            ) : <div className="h-[1px] bg-slate-300/50 w-8 mx-auto" />}
          </div>
          <NavItem icon={<ShieldAlert className="w-4 h-4" />} label="大客流应急响应" isOpen={isSidebarOpen} color="amber" />
          <NavItem icon={<FileText className="w-4 h-4" />} label="安监审查规范" isOpen={isSidebarOpen} color="rose" />
        </div>

        {/* 底部用户信息栏 - Glass Profile */}
        <div className="p-5 m-3 rounded-2xl bg-white/30 border border-white/50 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 shadow-inner border border-white">
                <span className="text-sm font-bold text-slate-600">S</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col overflow-hidden whitespace-nowrap">
                <span className="text-sm font-semibold text-slate-800">SZM-8291</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                  <Lock className="w-3 h-3 text-slate-400" /> 企业内网授权
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* 🔭 主视界 (Main Viewport) */}
      <main className="flex-1 flex flex-col h-full relative z-10">
        
        {/* 顶部悬浮控制台 Header */}
        <header className="h-16 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/40 rounded-xl transition-all shadow-sm border border-transparent hover:border-white/60"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-white/30 backdrop-blur-md border border-white/50 rounded-full shadow-sm text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-blue-500"/> Core: Qwen-Max</span>
              <div className="w-px h-3 bg-slate-300"></div>
              <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-emerald-500"/> Docs Sync: 100%</span>
            </div>
            <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/40 rounded-xl transition-all shadow-sm border border-transparent hover:border-white/60">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 欢迎与数据视窗区域 (Viewport) */}
        <div className="flex-1 overflow-y-auto w-full relative z-10 flex flex-col items-center pt-8 pb-32 px-6 scroll-smooth">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full max-w-4xl text-center mb-12 mt-8"
          >
            <div className="inline-flex items-center justify-center mb-6">
                <div className="px-5 py-1.5 rounded-full text-xs font-semibold tracking-widest text-[#0A1C40] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_2px_10px_rgba(10,28,64,0.05)] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#8B1831]" />
                  <span>SUZHOU METRO INTERNAL AI</span>
                </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-slate-800 tracking-tight mb-6 drop-shadow-sm leading-tight">
              轨交业务智库 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0A1C40] to-blue-600">Pro</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
              基于苏州地铁私有云部署的数据中枢。已深度解析全线网 <strong className="text-[#0A1C40] font-bold text-xl px-1">4,291</strong> 份运营规程与维保技术白皮书。
            </p>
          </motion.div>

          {/* 💎 悬浮玻璃卡片矩阵 (Glassmorphic Bento Grid) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8"
          >
            <GlassCard 
              title="行车与客运规章" 
              desc="查询列车运行图、大客流组织及突发情况应急预案。" 
              icon={<BookOpen className="w-6 h-6 text-indigo-600" />}
              gradient="from-indigo-500/10 to-transparent"
            />
             <GlassCard 
              title="机电与信号维保" 
              desc="检索卡斯柯系统代码、触网检修标准及站台门故障处理。" 
              icon={<Cpu className="w-6 h-6 text-emerald-600" />}
              gradient="from-emerald-500/10 to-transparent"
            />
             <GlassCard 
              title="安全文明审查" 
              desc="施工动火作业审批流程、红线标准及违规案例库。" 
              icon={<ShieldAlert className="w-6 h-6 text-[#8B1831]" />}
              gradient="from-rose-500/10 to-transparent"
            />
          </motion.div>

        </div>

        {/* 🔮 底部魔幻药丸输入框 (Magic Pill Input Area) */}
        <div className="absolute bottom-0 left-0 w-full p-8 z-30 pointer-events-none">
          <div className="w-full max-w-3xl mx-auto pointer-events-auto">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, type: "spring", damping: 20 }}
              className="bg-white/60 backdrop-blur-3xl border border-white/80 shadow-[0_8px_40px_rgba(10,28,64,0.08)] rounded-[32px] p-2 relative transition-all duration-300 focus-within:shadow-[0_12px_50px_rgba(10,28,64,0.15)] focus-within:bg-white/80"
            >
              <div className="flex items-center gap-3 pl-2">
                <div className="w-10 h-10 rounded-full bg-slate-100/50 flex items-center justify-center shrink-0 border border-white max-sm:hidden">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="询问规章、故障代码、或输入检索条件..."
                  className="w-full max-h-32 min-h-[52px] bg-transparent outline-none resize-none py-3.5 text-slate-800 placeholder-slate-500 font-medium text-[16px] flex-1 leading-relaxed"
                  rows={1}
                />
                <button 
                  className={`h-12 px-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 font-semibold gap-2 border ${
                    inputText.trim() 
                      ? 'bg-[#0A1C40] text-white border-[#0A1C40] shadow-[0_4px_14px_rgba(10,28,64,0.3)] hover:scale-[1.02] active:scale-[0.98]' 
                      : 'bg-white/50 border-white text-slate-400'
                  }`}
                >
                  <span className="hidden sm:inline">下达指令</span>
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </motion.div>
            <div className="flex items-center justify-center gap-4 px-4 pt-4">
               <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-white/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/40">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  禁止上传含有乘客 PII (个人隐私) 的未脱敏数据
               </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

// 侧边栏导航组件
function NavItem({ icon, label, active = false, isOpen, color = 'blue' }: { icon: React.ReactNode, label: string, active?: boolean, isOpen: boolean, color?: string }) {
  return (
    <button 
      className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 border ${
        active 
          ? 'bg-white text-[#0A1C40] border-white shadow-[0_2px_10px_rgba(10,28,64,0.06)] font-semibold' 
          : 'text-slate-600 border-transparent hover:bg-white/50 hover:text-slate-900 border hover:border-white/60'
      } ${!isOpen ? 'justify-center' : ''}`}
      title={!isOpen ? label : undefined}
    >
      <div className={`${active ? 'scale-110' : ''} transition-transform`}>
        {icon}
      </div>
      {isOpen && <span className="whitespace-nowrap text-[13px]">{label}</span>}
    </button>
  );
}

// 悬浮玻璃卡片
function GlassCard({ title, desc, icon, gradient }: { title: string, desc: string, icon: React.ReactNode, gradient: string }) {
  return (
    <button className="relative flex flex-col items-start p-6 rounded-[28px] border border-white/60 bg-white/40 backdrop-blur-2xl transition-all duration-500 ease-out group text-left hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-10px_rgba(10,28,64,0.1)] hover:bg-white/60 hover:border-white/80 overflow-hidden">
      {/* 内部微光渐变 */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${gradient} rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
      
      <div className="bg-white/80 p-3.5 rounded-2xl mb-6 shadow-sm border border-white group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-10">
        {icon}
      </div>
      <h3 className="font-bold text-[17px] text-slate-800 mb-2 relative z-10 tracking-tight">{title}</h3>
      <p className="text-[13px] text-slate-600 leading-relaxed font-medium relative z-10">{desc}</p>
    </button>
  );
}

