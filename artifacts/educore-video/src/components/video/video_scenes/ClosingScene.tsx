import { motion } from 'framer-motion';

export function ClosingScene() {
  return (
    <motion.div
      className="absolute inset-0 bg-sky-950 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background depth */}
      <motion.div 
        className="absolute w-[80vw] h-[80vw] bg-sky-600 rounded-full opacity-20 blur-[150px] pointer-events-none mix-blend-screen"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.4 }}
        transition={{ duration: 4, ease: "easeOut" }}
      />

      <div className="z-10 flex flex-col items-center text-center w-full">
        <div className="flex flex-wrap justify-center gap-8 text-[6rem] md:text-[8rem] font-extrabold text-white mb-32 w-full">
          {["One platform.", "Every role.", "Total clarity."].map((text, i) => (
            <motion.div key={i} className="overflow-hidden p-4">
              <motion.div
                initial={{ y: "100%", rotate: 5 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: 1.2, delay: 0.4 + (i * 0.4), ease: [0.16, 1, 0.3, 1] }}
                className={i === 2 ? "text-sky-400" : "text-slate-50"}
              >
                {text}
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5, filter: "blur(30px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.5, delay: 2.2, type: "spring", bounce: 0.4 }}
          className="flex items-center gap-12 bg-sky-900/60 p-12 pr-16 rounded-[4rem] backdrop-blur-2xl border border-sky-700/50 shadow-2xl"
        >
          <img 
            src={`${import.meta.env.BASE_URL}logo.svg`} 
            alt="EduCore" 
            className="w-40 h-40 brightness-0 invert drop-shadow-xl"
          />
          <div className="flex flex-col items-start">
            <h1 className="text-[7rem] font-extrabold tracking-tight text-white drop-shadow-lg leading-none">
              EduCore
            </h1>
            <p className="text-4xl text-sky-300 font-bold mt-4 tracking-[0.2em] uppercase">
              educore.com
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
