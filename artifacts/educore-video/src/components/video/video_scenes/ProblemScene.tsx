import { motion } from 'framer-motion';
import { FileSpreadsheet, Wallet, CalendarX2 } from 'lucide-react';

export function ProblemScene() {
  return (
    <motion.div
      className="absolute inset-0 bg-slate-100 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: "-100%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Drifting background elements */}
      <motion.div 
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-rose-100 rounded-full mix-blend-multiply blur-3xl pointer-events-none"
        animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-amber-100 rounded-full mix-blend-multiply blur-3xl pointer-events-none"
        animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 2 }}
      />

      <div className="relative z-10 w-full max-w-[80rem] mx-auto px-8 flex flex-col items-center">
        <div className="overflow-hidden mb-24">
          <motion.h2 
            className="text-[5rem] font-bold text-slate-800 text-center leading-tight pb-4"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            The old way is <span className="text-rose-600">broken.</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-3 gap-16 w-full">
          <ProblemCard 
            icon={<FileSpreadsheet size={72} className="text-rose-600" />}
            title="Scattered Spreadsheets"
            delay={0.6}
            rotation={-4}
            yOffset={20}
          />
          <ProblemCard 
            icon={<Wallet size={72} className="text-amber-600" />}
            title="Missed Fees"
            delay={0.9}
            rotation={2}
            yOffset={-10}
          />
          <ProblemCard 
            icon={<CalendarX2 size={72} className="text-orange-600" />}
            title="Manual Attendance"
            delay={1.2}
            rotation={-2}
            yOffset={30}
          />
        </div>
      </div>
    </motion.div>
  );
}

function ProblemCard({ icon, title, delay, rotation, yOffset = 0 }: any) {
  return (
    <motion.div
      className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-200 flex flex-col items-center text-center gap-10 relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.8, y: 150, rotate: rotation * 3 }}
      animate={{ opacity: 1, scale: 1, y: yOffset, rotate: rotation }}
      transition={{ duration: 1, type: "spring", bounce: 0.4, delay }}
    >
      <div className="p-8 bg-slate-50 rounded-[2rem] shadow-inner border border-slate-100">
        {icon}
      </div>
      <h3 className="text-4xl font-bold text-slate-700 leading-tight">{title}</h3>
    </motion.div>
  );
}
