import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AudioMessagePlayerProps {
  src: string;
  isMe?: boolean;
  durationHint?: number;
}

export function AudioMessagePlayer({ src, isMe = false, durationHint }: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate pseudorandom static wave bars based on src hash
  const waveBars = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < src.length; i++) {
      hash = (hash << 5) - hash + src.charCodeAt(i);
      hash |= 0;
    }
    const heights = [28, 45, 75, 55, 90, 65, 40, 80, 100, 70, 50, 85, 60, 45, 90, 65, 35, 75, 95, 55, 40, 60];
    return heights.map((h, i) => {
      const pseudo = Math.abs((hash + i * 17) % 60) + 25;
      return Math.min(100, pseudo);
    });
  }, [src]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex flex-col gap-1.5 p-2 rounded-xl min-w-[210px] max-w-[280px] sm:min-w-[240px] select-none ${
        isMe ? 'text-white' : 'text-foreground'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95 cursor-pointer shrink-0 ${
            isMe
              ? 'bg-white text-emerald-800 hover:bg-emerald-50'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
          title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform & Scrubber */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="relative h-6 flex items-center gap-0.5 cursor-pointer">
            {waveBars.map((height, idx) => {
              const barPercent = (idx / waveBars.length) * 100;
              const isPassed = barPercent <= progressPercent;
              return (
                <div
                  key={idx}
                  style={{ height: `${height}%` }}
                  className={`flex-1 min-w-[2px] rounded-full transition-all duration-150 ${
                    isPassed
                      ? isMe
                        ? 'bg-white'
                        : 'bg-emerald-600 dark:bg-emerald-400'
                      : isMe
                      ? 'bg-white/40'
                      : 'bg-muted-foreground/30'
                  } ${isPlaying && isPassed ? 'scale-y-110' : ''}`}
                />
              );
            })}
            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] opacity-85 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed Rate Switcher */}
        <button
          type="button"
          onClick={cyclePlaybackRate}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors shrink-0 ${
            isMe
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
          title="Alterar velocidade de reprodução"
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
}
