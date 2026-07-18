import { motion } from 'framer-motion';

export function OpeningScene() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-slate-50 text-slate-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#e2e8f0_1px,_transparent_1px)] bg-[size:40px_40px] opacity-40 pointer-events-none"
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 7, ease: "linear" }}
      />

      <motion.div className="flex flex-col items-center z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 1.2, type: "spring", bounce: 0.3, delay: 0.2 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}logo.svg`} 
            alt="EduCore Logo" 
            className="w-48 h-48 mb-10 drop-shadow-2xl"
          />
        </motion.div>
        
        <div className="overflow-hidden">
          <motion.h1 
            className="text-[6rem] font-extrabold tracking-tight text-slate-900 leading-none pb-2"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            EduCore
          </motion.h1>
        </div>
        
        <div className="overflow-hidden mt-6">
          <motion.p
            className="text-4xl text-sky-700 font-semibold tracking-wide"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
          >
            Run your school with precision.
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}
