import { motion } from 'framer-motion';
import { CalendarCheck, FileBadge, CreditCard, BellRing } from 'lucide-react';

export function FeaturesScene() {
  return (
    <motion.div
      className="absolute inset-0 bg-slate-100 flex items-center justify-center p-20 overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-[110rem] mx-auto flex gap-24 h-[85vh] items-center">
        {/* Left side text */}
        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="inline-block px-8 py-4 rounded-full bg-sky-100 text-sky-700 font-bold text-2xl mb-10 w-max uppercase tracking-wider"
          >
            Core Features
          </motion.div>
          <div className="overflow-hidden mb-10 pb-4">
            <motion.h2 
              className="text-[6.5rem] font-extrabold text-slate-900 leading-[1.05]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              Everything you need.<br/>
              <span className="text-sky-600">Nothing you don't.</span>
            </motion.h2>
          </div>
          <motion.p
            className="text-4xl text-slate-500 max-w-3xl leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.9 }}
          >
            A powerful suite of tools designed to streamline daily operations and give you total clarity.
          </motion.p>
        </div>

        {/* Right side bento grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-10 relative h-[700px]">
          <FeatureCard 
            icon={<CalendarCheck size={56} className="text-emerald-600" />}
            title="Attendance"
            desc="One-click check-ins"
            bg="bg-emerald-50"
            delay={1.2}
          />
          <FeatureCard 
            icon={<FileBadge size={56} className="text-purple-600" />}
            title="Exam Marks"
            desc="Automated grading"
            bg="bg-purple-50"
            delay={1.4}
            yOffset={60}
          />
          <FeatureCard 
            icon={<CreditCard size={56} className="text-amber-600" />}
            title="Fee Tracking"
            desc="Seamless digital collections"
            bg="bg-amber-50"
            delay={1.6}
            yOffset={-40}
          />
          <FeatureCard 
            icon={<BellRing size={56} className="text-rose-600" />}
            title="Notice Board"
            desc="Instant campus alerts"
            bg="bg-rose-50"
            delay={1.8}
            yOffset={20}
          />
        </div>
      </div>
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc, bg, delay, yOffset = 0 }: any) {
  return (
    <motion.div
      className={`p-12 rounded-[3rem] bg-white border border-slate-200 flex flex-col justify-center shadow-2xl relative overflow-hidden`}
      style={{ top: yOffset }}
      initial={{ opacity: 0, scale: 0.8, y: 60 + yOffset }}
      animate={{ opacity: 1, scale: 1, y: yOffset }}
      transition={{ duration: 1, type: "spring", bounce: 0.4, delay }}
    >
      <div className={`w-28 h-28 rounded-[2rem] ${bg} flex items-center justify-center mb-10 z-10`}>
        {icon}
      </div>
      <h3 className="text-4xl font-bold text-slate-800 mb-4 z-10">{title}</h3>
      <p className="text-2xl text-slate-500 font-medium z-10">{desc}</p>
    </motion.div>
  );
}
