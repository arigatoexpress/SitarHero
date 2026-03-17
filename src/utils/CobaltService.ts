export interface CobaltResponse {
    status: 'tunnel' | 'redirect' | 'stream' | 'error' | 'picker';
    url?: string;
    text?: string;
}

export class CobaltService {
    // Community instances that have shown to work with YouTube (subject to change)
    // Sourced from cobalt.directory
    private static INSTANCES = [
        'https://api.qwkuns.me',          // Often works
        'https://api.cobalt.tools',       // Official (rarely works for YT without auth, but good backup)
        'https://cobalt.q13.io',         // Alternative
        'https://api.ams.cobalt.tools', // Alternative
    ];

    static async getAudioUrl(youtubeUrl: string): Promise<string> {
        // Try each instance
        for (const instance of this.INSTANCES) {
            try {
                const response = await fetch(`${instance}/`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: youtubeUrl,
                        downloadMode: 'audio',
                        audioFormat: 'mp3',
                        filenamePattern: 'nerdy' // Should return simple filename
                    })
                });

                if (!response.ok) continue;

                const data: CobaltResponse = await response.json();

                if (data.status === 'tunnel' || data.status === 'redirect' || data.status === 'stream') {
                    if (data.url) return data.url;
                }
            } catch (e) {
                console.warn(`Cobalt instance ${instance} failed`, e);
            }
        }
        throw new Error('All Cobalt instances failed to process the request.');
    }
}
