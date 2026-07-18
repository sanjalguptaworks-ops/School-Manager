import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { OpeningScene } from './video_scenes/OpeningScene';
import { ProblemScene } from './video_scenes/ProblemScene';
import { RolesScene } from './video_scenes/RolesScene';
import { FeaturesScene } from './video_scenes/FeaturesScene';
import { ClosingScene } from './video_scenes/ClosingScene';

const SCENE_DURATIONS = [7000, 8000, 9000, 12000, 9000];

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative font-sans"
      style={{ backgroundColor: 'hsl(var(--color-bg-light))' }}
    >
      {/* Persistent Top Left Logo (Appears after Scene 0, hides on Closing Scene) */}
      <motion.div
        className="absolute top-16 left-16 z-50 flex items-center gap-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ 
          opacity: currentScene > 0 && currentScene < 4 ? 1 : 0,
          y: currentScene > 0 && currentScene < 4 ? 0 : -20
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="EduCore" className="w-16 h-16" />
        <span className="text-4xl font-extrabold text-slate-800 tracking-tight">EduCore</span>
      </motion.div>

      {/* Cross-scene persistent background element */}
      <motion.div
        className="absolute w-[150vw] h-[150vw] rounded-full blur-[120px] pointer-events-none mix-blend-multiply z-0"
        animate={{
          x: currentScene === 0 ? '-50vw' : currentScene === 1 ? '-20vw' : currentScene === 2 ? '50vw' : currentScene === 3 ? '-10vw' : '50vw',
          y: currentScene === 0 ? '50vh' : currentScene === 1 ? '-20vh' : currentScene === 2 ? '80vh' : currentScene === 3 ? '10vh' : '-50vh',
          backgroundColor: currentScene === 0 ? '#0284c7' : currentScene === 1 ? '#e11d48' : currentScene === 2 ? '#0284c7' : currentScene === 3 ? '#0ea5e9' : '#0284c7',
          opacity: currentScene === 0 ? 0.08 : currentScene === 1 ? 0.04 : currentScene === 2 ? 0.12 : currentScene === 3 ? 0.06 : 0.15,
          scale: currentScene === 4 ? 2 : 1,
        }}
        transition={{ duration: 3, ease: 'easeInOut' }}
      />
      
      {/* Persistent noise texture for cinematic depth */}
      <div 
        className="absolute inset-0 z-50 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <OpeningScene key="scene-0" />}
        {currentScene === 1 && <ProblemScene key="scene-1" />}
        {currentScene === 2 && <RolesScene key="scene-2" />}
        {currentScene === 3 && <FeaturesScene key="scene-3" />}
        {currentScene === 4 && <ClosingScene key="scene-4" />}
      </AnimatePresence>
    </div>
  );
}
