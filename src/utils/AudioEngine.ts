export interface NoteData {
    time: number;
    lane: number;
    duration?: number;
}

export class AudioEngine {
    private context: AudioContext;
    private analyser: AnalyserNode;
    private source: AudioBufferSourceNode | null = null;
    private audioBuffer: AudioBuffer | null = null;

    constructor() {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
    }

    async loadFile(file: File): Promise<void> {
        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    }

    async loadFromUrl(url: string): Promise<void> {
        console.log(`Loading audio from: ${url}`);
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        console.log(`Audio loaded. Duration: ${this.audioBuffer.duration}s, SampleRate: ${this.audioBuffer.sampleRate}`);
    }

    generateLevel(difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' = 'Medium'): NoteData[] {
        if (!this.audioBuffer) return [];

        const notes: NoteData[] = [];
        const rawData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;

        // Difficulty mapping
        const difficultyConfig = {
            'Easy': { threshold: 0.25, minGap: 0.3, energyMult: 1.8 },
            'Medium': { threshold: 0.18, minGap: 0.15, energyMult: 1.5 },
            'Hard': { threshold: 0.12, minGap: 0.08, energyMult: 1.3 },
            'Expert': { threshold: 0.08, minGap: 0.04, energyMult: 1.1 }
        };

        const config = difficultyConfig[difficulty];

        const windowSize = 1024;
        const stepSize = 512;
        let lastEnergy = 0;

        // 1. Calculate Average Energy (RMS) of the track to adapt thresholds
        let totalEnergy = 0;
        let count = 0;
        for (let i = 0; i < rawData.length - windowSize; i += 4096) { // Sampling every ~4000 samples for speed
            let e = 0;
            for (let j = 0; j < windowSize; j++) {
                e += rawData[i + j] * rawData[i + j];
            }
            totalEnergy += Math.sqrt(e / windowSize);
            count++;
        }
        const avgEnergy = count > 0 ? totalEnergy / count : 0.1;
        console.log(`Track Avg Energy: ${avgEnergy}`);

        // Adapt thresholds relative to average energy
        // INVERTED LOGIC: 
        // Easy = High multiplier (only loud beats) -> Sparse
        // Expert = Low multiplier (sensitive to everything) -> Dense

        let multiplier = 1.2;
        switch (difficulty) {
            case 'Easy': multiplier = 1.5; break;
            case 'Medium': multiplier = 1.2; break;
            case 'Hard': multiplier = 0.9; break;
            case 'Expert': multiplier = 0.6; break;
        }

        const adaptiveThreshold = Math.max(0.02, avgEnergy * multiplier);
        const diffConfig = difficultyConfig[difficulty];

        console.log(`Using Adaptive Threshold: ${adaptiveThreshold} for Difficulty: ${difficulty}`);

        for (let i = 0; i < rawData.length - windowSize; i += stepSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += rawData[i + j] * rawData[i + j];
            }
            energy = Math.sqrt(energy / windowSize);

            // Use adaptive threshold instead of hardcoded config.threshold
            if (energy > adaptiveThreshold && energy > lastEnergy * diffConfig.energyMult) {
                const time = i / sampleRate;
                const lane = Math.floor((energy * 10) % 5);
                notes.push({ time, lane });
            }
            lastEnergy = energy;
        }

        // Post-processing: remove notes that are too close based on difficulty
        return notes.filter((note, index) => {
            if (index === 0) return true;
            return note.time - notes[index - 1].time > config.minGap;
        });
    }

    play(onEnded: () => void) {
        if (!this.audioBuffer) return;

        this.source = this.context.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.analyser);
        this.analyser.connect(this.context.destination);

        this.source.onended = onEnded;
        this.source.start(0);
    }

    stop() {
        if (this.source) {
            this.source.stop();
            this.source = null;
        }
    }

    getCurrentTime(): number {
        return this.context.currentTime;
    }
}
