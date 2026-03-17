import React, { useEffect, useRef, useState } from 'react';
import { NoteData } from '../utils/AudioEngine';

interface GameHighwayProps {
    notes: NoteData[];
    currentTime: number;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
    combo: number;
    onHit: (lane: number) => void;
    onMiss: (lane: number) => void;
}

// Visual Systems Interfaces
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

interface PopupText {
    x: number;
    y: number;
    text: string;
    life: number;
    color: string;
    vy: number;
}

const LANES = 5;
const LANE_COLORS = [
    '#00ff00', // Green
    '#ff0000', // Red
    '#ffff00', // Yellow
    '#0000ff', // Blue
    '#ff8800', // Orange
];

export const GameHighway: React.FC<GameHighwayProps> = ({ notes, currentTime, difficulty, combo, onHit, onMiss }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());

    // Systems Refs (Mutable state for animation loop without re-renders)
    const particlesRef = useRef<Particle[]>([]);
    const popupsRef = useRef<PopupText[]>([]);
    const lastHitTimeRef = useRef<number>(0);
    const comboRef = useRef(combo);

    // Sync combo ref
    useEffect(() => {
        comboRef.current = combo;
    }, [combo]);

    const DIFFICULTY_CONFIG = {
        'Easy': { speed: 350, lookAhead: 3.5, hitWindow: 0.3 },
        'Medium': { speed: 550, lookAhead: 2.2, hitWindow: 0.2 },
        'Hard': { speed: 850, lookAhead: 1.6, hitWindow: 0.15 },
        'Expert': { speed: 1200, lookAhead: 1.2, hitWindow: 0.1 }
    };

    const { speed: NOTE_SPEED, lookAhead: LOOK_AHEAD, hitWindow: HIT_WINDOW } = DIFFICULTY_CONFIG[difficulty];
    const HIT_ZONE_Y = 650;

    // Helper: Spawn Particles
    const spawnParticles = (x: number, y: number, color: string) => {
        for (let i = 0; i < 15; i++) {
            particlesRef.current.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 5, // Upward bias
                life: 1.0,
                color,
                size: Math.random() * 4 + 2
            });
        }
    };

    // Helper: Spawn Popup
    const spawnPopup = (x: number, y: number, text: string, color: string) => {
        popupsRef.current.push({
            x,
            y,
            text,
            life: 1.0,
            color,
            vy: -2
        });
    };

    // Validation Logic
    const attemptHit = (lane: number) => {
        const hitNote = notes.find(n => {
            if (n.lane !== lane) return false;
            const timeDiff = n.time - currentTime;
            return Math.abs(timeDiff) < HIT_WINDOW;
        });

        if (hitNote) {
            onHit(lane);
            spawnParticles(lane * (600 / LANES) + (600 / LANES / 2), HIT_ZONE_Y, LANE_COLORS[lane]);

            const diff = Math.abs(hitNote.time - currentTime);
            let text = "Good";
            if (diff < HIT_WINDOW * 0.3) text = "PERFECT!";
            else if (diff < HIT_WINDOW * 0.6) text = "Great!";

            spawnPopup(lane * (600 / LANES) + (600 / LANES / 2), HIT_ZONE_Y - 50, text, '#ffffff');

            if (Date.now() - lastHitTimeRef.current < 100) return;
            lastHitTimeRef.current = Date.now();

        } else {
            onMiss(lane);
            spawnPopup(lane * (600 / LANES) + (600 / LANES / 2), HIT_ZONE_Y - 20, "MISS", '#ff0000');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const keyMap: Record<string, number> = { 'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4 };
            if (keyMap[e.key] !== undefined) {
                const lane = keyMap[e.key];
                setActiveKeys(prev => new Set(prev).add(lane));
                attemptHit(lane);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const keyMap: Record<string, number> = { 'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4 };
            if (keyMap[e.key] !== undefined) {
                const lane = keyMap[e.key];
                setActiveKeys(prev => {
                    const next = new Set(prev);
                    next.delete(lane);
                    return next;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [notes, currentTime, difficulty]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            if (canvas.width !== 600) canvas.width = 600;
            if (canvas.height !== 800) canvas.height = 800;

            const currentCombo = comboRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const laneWidth = width / LANES;

            // ON FIRE MODE BACKGROUND
            if (currentCombo > 10) {
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#220000');
                gradient.addColorStop(1, '#000000');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);

                ctx.shadowBlur = 50 + (Math.sin(Date.now() / 100) * 20);
                ctx.shadowColor = '#ff4400';
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 4;
                ctx.strokeRect(0, 0, width, height);
                ctx.shadowBlur = 0;
            }

            // Draw Highway Lanes
            ctx.strokeStyle = currentCombo > 10 ? 'rgba(255, 100, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            for (let i = 0; i <= LANES; i++) {
                ctx.beginPath();
                ctx.moveTo(i * laneWidth, 0);
                ctx.lineTo(i * laneWidth, height);
                ctx.stroke();
            }

            // Draw Hit Zone
            ctx.fillStyle = currentCombo > 10 ? 'rgba(255, 100, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(0, HIT_ZONE_Y - 20, width, 40);
            ctx.strokeStyle = currentCombo > 20 ? '#ff8800' : 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.strokeRect(0, HIT_ZONE_Y - 20, width, 40);

            // Draw Active Key Feedback
            activeKeys.forEach(lane => {
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, LANE_COLORS[lane] + '00');
                gradient.addColorStop(1, LANE_COLORS[lane] + '66');
                ctx.fillStyle = gradient;
                ctx.fillRect(lane * laneWidth, 0, laneWidth, height);
            });

            // Draw Notes
            notes.forEach(note => {
                const timeDiff = note.time - currentTime;
                if (timeDiff > -1 && timeDiff < LOOK_AHEAD) {
                    const y = HIT_ZONE_Y - (timeDiff * NOTE_SPEED);

                    ctx.beginPath();
                    ctx.fillStyle = LANE_COLORS[note.lane];
                    ctx.shadowBlur = currentCombo > 20 ? 30 : 15;
                    ctx.shadowColor = LANE_COLORS[note.lane];
                    ctx.roundRect(note.lane * laneWidth + 10, y - 10, laneWidth - 20, 20, 10);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 0;
                    ctx.fillRect(note.lane * laneWidth + (laneWidth / 2) - 10, y - 2, 20, 4);
                }
            });

            // UPDATE & DRAW PARTICLES
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.03;

                if (p.life <= 0) {
                    particlesRef.current.splice(i, 1);
                } else {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
            }

            // UPDATE & DRAW POPUPS
            for (let i = popupsRef.current.length - 1; i >= 0; i--) {
                const p = popupsRef.current[i];
                p.y += p.vy;
                p.life -= 0.02;

                if (p.life <= 0) {
                    popupsRef.current.splice(i, 1);
                } else {
                    ctx.globalAlpha = p.life;
                    ctx.font = 'bold 24px "Russo One", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = p.color;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    ctx.strokeText(p.text, p.x, p.y);
                    ctx.fillText(p.text, p.x, p.y);
                    ctx.globalAlpha = 1.0;
                }
            }

            // ON FIRE TEXT OVERLAY
            if (currentCombo > 10) {
                ctx.font = 'bold 40px "Russo One"';
                ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`;
                ctx.textAlign = 'center';
                ctx.fillText("ON FIRE", width / 2, 200);
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [notes, currentTime, activeKeys]);

    return (
        <div className="relative w-full h-full flex justify-center items-center bg-transparent overflow-hidden">
            <div
                className={`w-[600px] h-[800px] border-x transition-all duration-500 ${combo > 10 ? 'border-orange-500 shadow-[0_0_50px_orange]' : 'border-white/10'}`}
                style={{
                    perspective: '1000px',
                    transform: 'rotateX(30deg)',
                    transformOrigin: 'bottom'
                }}
            >
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={800}
                    className="w-full h-full"
                />
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
                {['A', 'S', 'D', 'F', 'G'].map((key, i) => (
                    <div
                        key={key}
                        className={`w-12 h-12 flex items-center justify-center rounded-lg border-2 transition-all duration-100 ${activeKeys.has(i) ? 'scale-90 bg-white text-black' : 'bg-transparent text-white border-white/30'
                            }`}
                        style={{ borderColor: activeKeys.has(i) ? LANE_COLORS[i] : 'rgba(255,255,255,0.3)' }}
                    >
                        {key}
                    </div>
                ))}
            </div>
        </div>
    );
};
