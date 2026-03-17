import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Music, Play, RefreshCw, Trophy, ChevronRight, Keyboard, Link } from 'lucide-react';
import { AudioEngine, NoteData } from './utils/AudioEngine';
import { GameHighway } from './components/GameHighway';
import confetti from 'canvas-confetti';

const TRACKS = [
    { id: '1', title: 'Moonlight Sonata', genre: 'Classical', difficulty: 'Normal', url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/Moonlight_Sonata.ogg/Moonlight_Sonata.ogg.mp3', color: 'var(--accent-primary)' },
    { id: '2', title: 'Euro Anthem', genre: 'Orchestral', difficulty: 'Hard', url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f3/Anthem_of_Europe_%28US_Navy_instrumental_short_version%29.ogg/Anthem_of_Europe_%28US_Navy_instrumental_short_version%29.ogg.mp3', color: 'var(--accent-secondary)' },
    { id: '3', title: 'Cyber T-Rex (Short)', genre: 'SFX', difficulty: 'Expert', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3', color: 'var(--accent-tertiary)' },
];

import { CobaltService } from './utils/CobaltService';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<'idle' | 'loading' | 'ready' | 'playing' | 'results'>('idle');
    const [loadingProgress, setLoadingProgress] = useState<string>('');
    const [notes, setNotes] = useState<NoteData[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [score, setScore] = useState(0);
    const [multiplier, setMultiplier] = useState(1);
    const [combo, setCombo] = useState(0);
    const [bestCombo, setBestCombo] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState<typeof TRACKS[0] | any | null>(null);
    const [currentDifficulty, setCurrentDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Expert'>('Medium');
    const [inputUrl, setInputUrl] = useState('');

    const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
    const rafRef = useRef<number>(0);

    const handleUrlSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputUrl.trim()) return;

        setGameState('loading');
        setLoadingProgress('INITIALIZING COBALT LINK...');

        try {
            let finalUrl = inputUrl;
            let title = 'Direct Stream';

            // Check if it's a YouTube URL
            if (inputUrl.includes('youtube.com') || inputUrl.includes('youtu.be')) {
                setLoadingProgress('CONVERTING VIA COBALT...');
                try {
                    finalUrl = await CobaltService.getAudioUrl(inputUrl);
                    title = 'YouTube Stream';
                    console.log('Cobalt resolved URL:', finalUrl);
                } catch (err) {
                    console.error('Cobalt failed:', err);
                    alert("Failed to convert YouTube video. Cobalt API might be busy.");
                    setGameState('idle');
                    return;
                }
            }

            const track = {
                id: 'url-stream',
                title: title,
                genre: 'Web Audio',
                difficulty: 'Auto-Gen',
                url: finalUrl,
                color: 'var(--accent-secondary)'
            };

            await handleSelectTrack(track);
        } catch (error) {
            console.error('URL Error:', error);
            setGameState('idle');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedTrack({ id: 'custom', title: file.name, genre: 'Local File', difficulty: 'Unknown', url: '', color: 'var(--accent-secondary)' });
        setGameState('loading');
        setLoadingProgress('DECODING AUDIO...');
        try {
            await audioEngineRef.current.loadFile(file);
            setLoadingProgress('SCANNIG WAVEFORM...');
            const generatedNotes = audioEngineRef.current.generateLevel(currentDifficulty);
            setLoadingProgress('SYNCING BEATMAP...');
            setNotes(generatedNotes);
            setGameState('ready');
        } catch (error) {
            console.error('Error loading file:', error);
            alert("Failed to process audio file.");
            setGameState('idle');
        }
    };

    const handleSelectTrack = async (track: any) => {
        setSelectedTrack(track);
        setGameState('loading');
        setLoadingProgress('FETCHING AUDIO STREAM...');

        try {
            await audioEngineRef.current.loadFromUrl(track.url);

            setLoadingProgress('SCANNIG WAVEFORM...');
            const generatedNotes = audioEngineRef.current.generateLevel(currentDifficulty);

            setLoadingProgress('SYNCING BEATMAP...');
            setNotes(generatedNotes);

            setGameState('ready');
        } catch (err) {
            console.error('Audio load error:', err);
            alert("Failed to load audio. Please ensure the URL is a direct link to an audio file (CORS enabled).");
            setGameState('idle');
        }
    };

    const handleDifficultyChange = (diff: 'Easy' | 'Medium' | 'Hard' | 'Expert') => {
        setCurrentDifficulty(diff);
        if (gameState === 'ready') {
            const regeneratedNotes = audioEngineRef.current.generateLevel(diff);
            setNotes(regeneratedNotes);
        }
    };

    const startGame = () => {
        if (!selectedTrack) return;
        setGameState('playing');
        setScore(0);
        setCombo(0);
        setBestCombo(0);
        setMultiplier(1);

        audioEngineRef.current.play(() => {
            setGameState('results');
            confetti({
                particleCount: 200,
                spread: 120,
                origin: { y: 0.6 },
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00']
            });
        });

        const updateTime = () => {
            setCurrentTime(audioEngineRef.current.getCurrentTime());
            rafRef.current = requestAnimationFrame(updateTime);
        };
        rafRef.current = requestAnimationFrame(updateTime);
    };

    const handleHit = useCallback((lane: number) => {
        setCombo(prev => {
            const next = prev + 1;
            setBestCombo(old => Math.max(old, next));
            return next;
        });
        setScore(prev => prev + (100 * multiplier));
        if (combo > 0 && combo % 10 === 0) {
            setMultiplier(prev => Math.min(prev + 1, 4));
        }
    }, [multiplier, combo]);

    const handleMiss = useCallback((lane: number) => {
        setCombo(0);
        setMultiplier(1);
    }, []);

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-black overflow-hidden relative">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--accent-primary)_0%,_transparent_70%)] opacity-5 pointer-events-none" />

            {gameState === 'idle' && (
                <div className="max-w-6xl w-full flex flex-col gap-8 animate-in fade-in zoom-in duration-700">
                    <header className="text-center space-y-2 relative">
                        <div className="lightning-effect" />
                        <h1 className="text-8xl font-rock metallic-text italic mb-4">SITAR HERO</h1>
                        <p className="text-accent-secondary text-lg uppercase tracking-[0.5em] font-bold">Unleash the Strings</p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* YouTube / Direct URL Input */}
                        <div className="glass-morphism p-6 flex flex-col gap-4 border-2 border-white/5">
                            <h2 className="text-xl font-rock flex items-center gap-2 mb-2 text-accent-secondary">
                                <Link className="w-5 h-5" /> WEB LINK
                            </h2>
                            <p className="text-xs text-text-dim font-rock">YouTube or Direct MP3 URL</p>
                            <form onSubmit={handleUrlSubmit} className="relative mt-2">
                                <input
                                    type="text"
                                    value={inputUrl}
                                    onChange={(e) => setInputUrl(e.target.value)}
                                    placeholder="Paste YouTube or MP3 Link..."
                                    className="w-full bg-black/40 border-b-2 border-white/20 px-4 py-3 pr-12 focus:border-accent-secondary outline-none transition-all font-rock text-xs text-white placeholder:text-white/30"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-1.5 p-2 text-white/50 hover:text-white transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </form>

                            <div className="mt-4 p-4 bg-white/5 rounded border border-white/10">
                                <p className="text-[10px] text-text-dim uppercase tracking-widest mb-2">QUICK RIFFS (CORS READY)</p>
                                <div className="space-y-2">
                                    {TRACKS.map(track => (
                                        <button
                                            key={track.id}
                                            onClick={() => handleSelectTrack(track)}
                                            className="w-full text-left font-rock text-xs hover:text-accent-primary transition-colors flex justify-between group"
                                        >
                                            <span>{track.title}</span>
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">PLAY</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Center Stage - File Upload (Primary) */}
                        <div className="lg:col-span-2 flex flex-col h-full">
                            <div className="glass-morphism p-8 flex flex-col items-center justify-center gap-6 border-2 border-white/5 h-full relative overflow-hidden group">
                                <div className="absolute inset-0 bg-accent-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <h2 className="text-2xl font-rock text-white mb-2 italic flex items-center gap-3">
                                    <Upload className="w-6 h-6 text-accent-primary" /> LOCAL ROCKET
                                </h2>
                                <label className="flex flex-col items-center justify-center w-full max-w-lg h-64 border-4 border-dashed border-white/10 rounded-2xl hover:border-accent-primary transition-all cursor-pointer hover:bg-white/5 hover:scale-[1.02] duration-300">
                                    <Music className="w-16 h-16 mb-4 text-text-dim group-hover:text-white transition-colors animate-pulse" />
                                    <span className="text-xl font-rock metallic-text mb-2">DROP YOUR TRACK HERE</span>
                                    <span className="text-xs font-rock text-text-dim tracking-widest">SUPPORTED FORMATS: MP3, WAV, OGG</span>
                                    <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <footer className="mt-8 flex justify-between items-center px-6">
                        <div className="flex gap-4">
                            {['A', 'S', 'D', 'F', 'G'].map(k => (
                                <div key={k} className="w-10 h-10 border border-white/20 rounded flex items-center justify-center font-rock text-xs text-text-dim">{k}</div>
                            ))}
                        </div>
                        <div className="text-[10px] font-rock text-text-dim uppercase tracking-[0.5em]">Antigravity Engine v2.0</div>
                    </footer>
                </div>
            )}

            {gameState === 'ready' && selectedTrack && (
                <div className="flex flex-col items-center gap-12 animate-in fade-in zoom-in duration-500 max-w-2xl w-full">
                    <div className="text-center space-y-4">
                        <div className="text-accent-tertiary font-rock text-sm tracking-[0.5em] animate-pulse">SYSTEMS READY</div>
                        <h2 className="text-7xl font-rock metallic-text">{selectedTrack.title}</h2>
                        <div className="flex justify-center gap-4">
                            <span className="px-4 py-1 border border-white/20 text-xs font-rock text-text-dim">{selectedTrack.genre}</span>
                            <span className="px-4 py-1 border border-white/20 text-xs font-rock text-accent-secondary">{notes.length} NOTES</span>
                        </div>
                    </div>

                    <div className="glass-morphism p-8 w-full border-2 border-white/10 flex flex-col items-center gap-8">
                        <div className="flex flex-col items-center gap-2">
                            <div className="text-[10px] font-rock text-text-dim uppercase tracking-widest">Select Difficulty</div>
                            <div className="flex gap-2">
                                {(['Easy', 'Medium', 'Hard', 'Expert'] as const).map(diff => (
                                    <button
                                        key={diff}
                                        onClick={() => handleDifficultyChange(diff)}
                                        className={`px-6 py-3 font-rock text-xs border transition-all ${currentDifficulty === diff
                                            ? 'hero-button border-accent-secondary metallic-text scale-110'
                                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/50'
                                            }`}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setGameState('idle')}
                                className="flex-1 px-8 py-5 bg-white/5 border-2 border-white/10 rounded-xl hover:bg-white/10 hover:text-white hover:border-white/50 transition-all font-rock uppercase tracking-widest text-sm text-white/70"
                            >
                                BACK
                            </button>
                            <button
                                onClick={startGame}
                                className="flex-[2] hero-button px-8 py-5 rounded-xl font-rock text-2xl metallic-text"
                            >
                                IGNITION
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {gameState === 'loading' && (
                <div className="flex flex-col items-center gap-8">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-t-4 border-accent-secondary animate-spin" />
                        <Music className="absolute inset-0 m-auto w-12 h-12 text-accent-secondary animate-pulse" />
                        <div className="absolute inset-0 bg-accent-secondary blur-3xl opacity-10" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-3xl font-rock metallic-text tracking-widest animate-pulse">{loadingProgress}</p>
                        <p className="text-xs font-rock text-text-dim tracking-[0.3em]">PLEASE REMAIN CALM</p>
                    </div>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="w-full h-full relative">
                    <div className="absolute top-10 left-10 space-y-1">
                        <div className="text-xs font-rock text-text-dim tracking-widest">AMPLITUDE SCORE</div>
                        <div className="text-7xl font-rock metallic-text">{score.toLocaleString()}</div>
                    </div>

                    <div className="absolute top-10 right-10 text-right space-y-4">
                        <div>
                            <div className="text-xs font-rock text-text-dim tracking-widest mb-1">STREAK MULTIPLIER</div>
                            <div className="text-8xl font-rock text-accent-tertiary italic">{multiplier}<span className="text-2xl text-white/30 ml-2">X</span></div>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="text-2xl font-rock metallic-text tracking-tighter">{combo} COMBO</div>
                            <div className="w-48 h-2 bg-white/10 mt-2 overflow-hidden rounded-full border border-white/5">
                                <div className="h-full bg-gradient-to-r from-accent-primary to-accent-tertiary transition-all" style={{ width: `${(combo % 10) * 10}%` }} />
                            </div>
                        </div>
                    </div>

                    <GameHighway
                        notes={notes}
                        currentTime={currentTime}
                        difficulty={currentDifficulty}
                        combo={combo}
                        onHit={handleHit}
                        onMiss={handleMiss}
                    />
                </div>
            )}

            {gameState === 'results' && (
                <div className="glass-morphism p-16 flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom- luxury-shadow border-4 border-white/10 relative overflow-hidden">
                    <div className="lightning-effect" />
                    <Trophy className="w-24 h-24 text-accent-tertiary animate-bounce" />

                    <div className="text-center">
                        <h2 className="text-6xl font-rock metallic-text mb-2">ROCK GOD</h2>
                        <p className="text-accent-secondary font-rock tracking-[0.5em] text-sm">SESSION COMPLETE</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 w-full">
                        <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-text-dim font-rock text-[10px] uppercase tracking-widest mb-2">Final Score</p>
                            <p className="text-5xl font-rock metallic-text">{score.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-text-dim font-rock text-[10px] uppercase tracking-widest mb-2">Best Combo</p>
                            <p className="text-5xl font-rock text-accent-tertiary">{bestCombo}</p>
                        </div>
                    </div>

                    <div className="flex gap-4 w-full">
                        <button
                            onClick={() => setGameState('idle')}
                            className="flex-1 px-8 py-5 bg-white/5 border-2 border-white/10 rounded-xl hover:bg-white/10 transition-all font-rock uppercase tracking-widest text-sm"
                        >
                            MAIN MENU
                        </button>
                        <button
                            onClick={startGame}
                            className="hero-button flex-1 px-8 py-5 rounded-xl font-rock uppercase tracking-widest text-sm"
                        >
                            RETRY SESSION
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
