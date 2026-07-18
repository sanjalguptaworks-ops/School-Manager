import { motion } from 'framer-motion';
import { UserCog, GraduationCap, Users, BookOpen } from 'lucide-react';

export function RolesScene() {
  return (
    <motion.div
      className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center overflow-hidden text-slate-900"
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.05)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      <div className="z-10 flex flex-col items-center text-center mb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="px-8 py-3 bg-sky-100 text-sky-700 font-bold rounded-full mb-8 text-2xl tracking-wide uppercase"
        >
          Unified Platform
        </motion.div>
        <motion.h2 
          className="text-7xl font-extrabold text-slate-800"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
        >
          4 Roles. 1 Unified View.
        </motion.h2>
      </div>

      <div className="relative w-full max-w-6xl mx-auto h-[600px] flex items-center justify-center z-10">
        {/* Center Node */}
        <motion.div 
          className="absolute w-48 h-48 bg-sky-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_100px_rgba(14,165,233,0.4)] z-20 rotate-3"
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 3 }}
          transition={{ type: "spring", bounce: 0.5, delay: 1 }}
        >
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Logo" className="w-24 h-24 brightness-0 invert drop-shadow-md" />
        </motion.div>

        {/* Connecting Lines */}
        <motion.svg className="absolute inset-0 w-full h-full pointer-events-none z-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
          <motion.path d="M 50% 50% L 25% 15%" stroke="#bae6fd" strokeWidth="6" strokeDasharray="12 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.2 }} />
          <motion.path d="M 50% 50% L 75% 15%" stroke="#bae6fd" strokeWidth="6" strokeDasharray="12 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.4 }} />
          <motion.path d="M 50% 50% L 25% 85%" stroke="#bae6fd" strokeWidth="6" strokeDasharray="12 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.6 }} />
          <motion.path d="M 50% 50% L 75% 85%" stroke="#bae6fd" strokeWidth="6" strokeDasharray="12 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.8 }} />
        </motion.svg>

        <RoleNode icon={<UserCog size={56} />} title="Admin" position={{ top: '5%', left: '15%' }} delay={1.4} />
        <RoleNode icon={<BookOpen size={56} />} title="Teacher" position={{ top: '5%', right: '15%' }} delay={1.6} />
        <RoleNode icon={<GraduationCap size={56} />} title="Student" position={{ bottom: '5%', left: '15%' }} delay={1.8} />
        <RoleNode icon={<Users size={56} />} title="Parent" position={{ bottom: '5%', right: '15%' }} delay={2.0} />
      </div>
    </motion.div>
  );
}

function RoleNode({ icon, title, position, delay }: any) {
  return (
    <motion.div
      className="absolute flex items-center gap-8 bg-white p-8 pr-12 rounded-[2.5rem] border border-slate-200 shadow-2xl"
      style={position}
      initial={{ opacity: 0, scale: 0.8, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, type: "spring", bounce: 0.4, delay }}
    >
      <div className="p-5 bg-sky-100 text-sky-700 rounded-2xl">
        {icon}
      </div>
      <div className="text-4xl font-bold text-slate-800">{title}</div>
    </motion.div>
  );
}
