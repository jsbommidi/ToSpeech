export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private isPaused = false;
  private audioBitsPerSecond: number = 128000; // Default to standard quality (128kbps)
  private recordingStartTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private completedRecording: Blob | null = null;
  private finalDuration: number = 0; // Store the final duration after stopping

  constructor(quality: 'standard' | 'high' = 'standard') {
    this.audioBitsPerSecond = quality === 'high' ? 256000 : 128000;
  }

  async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100, // Higher quality for MP3
          channelCount: 1,   // Mono audio
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Use WebM with Opus codec (best browser support)
      let options: MediaRecorderOptions;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { 
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: this.audioBitsPerSecond
        };
      } else {
        options = { 
          mimeType: 'audio/webm',
          audioBitsPerSecond: this.audioBitsPerSecond
        };
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
      
      this.audioChunks = [];
      this.completedRecording = null;
      this.recordingStartTime = Date.now();
      this.pausedDuration = 0;
      this.isPaused = false;
      this.finalDuration = 0;
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  pauseRecording(): void {
    if (!this.mediaRecorder || !this.isRecording || this.isPaused) {
      throw new Error('Cannot pause: no active recording or already paused');
    }

    this.mediaRecorder.pause();
    this.isPaused = true;
    this.pauseStartTime = Date.now();
  }

  resumeRecording(): void {
    if (!this.mediaRecorder || !this.isRecording || !this.isPaused) {
      throw new Error('Cannot resume: no paused recording');
    }

    this.mediaRecorder.resume();
    this.pausedDuration += Date.now() - this.pauseStartTime;
    this.isPaused = false;
    this.pauseStartTime = 0;
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      // Capture the final duration BEFORE changing state
      const now = Date.now();
      const totalTime = now - this.recordingStartTime;
      const currentPausedTime = this.isPaused ? (now - this.pauseStartTime) : 0;
      this.finalDuration = Math.max(0, Math.floor((totalTime - this.pausedDuration - currentPausedTime) / 1000));
      
      console.log('[AudioRecorder] Stopping recording, final duration:', this.finalDuration);

      this.mediaRecorder.onstop = async () => {
        try {
          // Create blob from recorded chunks (WebM format)
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const webmBlob = new Blob(this.audioChunks, { type: mimeType });
          
          console.log('[AudioRecorder] WebM recording stopped, blob size:', webmBlob.size, 'duration:', this.finalDuration);
          
          // Convert WebM to WAV
          const wavBlob = await this.convertToWav(webmBlob);
          
          // Store completed recording for playback
          this.completedRecording = wavBlob;
          
          console.log('[AudioRecorder] Converted to WAV, blob size:', wavBlob.size);
          
          // Clean up recording state but keep the completed recording and final duration
          this.cleanupRecording();
          
          resolve(wavBlob);
        } catch (error) {
          console.error('[AudioRecorder] Error converting to WAV:', error);
          reject(error);
        }
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
      this.isPaused = false;
    });
  }

  private async convertToWav(webmBlob: Blob): Promise<Blob> {
    // Create an audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Convert blob to array buffer
    const arrayBuffer = await webmBlob.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to WAV format (16-bit PCM, mono, 16kHz for Whisper compatibility)
    const wavBuffer = this.audioBufferToWav(audioBuffer);
    
    // Create WAV blob
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    // Close audio context to free resources
    await audioContext.close();
    
    return wavBlob;
  }

  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    // Resample to 16kHz mono for Whisper compatibility
    const targetSampleRate = 16000;
    const numberOfChannels = 1; // Mono
    
    // Get audio data from first channel (or mix if stereo)
    let audioData: Float32Array;
    if (audioBuffer.numberOfChannels === 1) {
      audioData = audioBuffer.getChannelData(0);
    } else {
      // Mix stereo to mono
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      audioData = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        audioData[i] = (left[i] + right[i]) / 2;
      }
    }
    
    // Resample if needed
    let resampledData: Float32Array;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const ratio = audioBuffer.sampleRate / targetSampleRate;
      const newLength = Math.round(audioData.length / ratio);
      resampledData = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
        const t = srcIndex - srcIndexFloor;
        
        // Linear interpolation
        resampledData[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
      }
    } else {
      resampledData = audioData;
    }
    
    // Convert float samples to 16-bit PCM
    const pcmData = new Int16Array(resampledData.length);
    for (let i = 0; i < resampledData.length; i++) {
      const s = Math.max(-1, Math.min(1, resampledData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Create WAV file
    const wavHeader = this.createWavHeader(pcmData.length * 2, targetSampleRate, numberOfChannels);
    const wavBuffer = new ArrayBuffer(wavHeader.byteLength + pcmData.byteLength);
    const view = new Uint8Array(wavBuffer);
    
    view.set(new Uint8Array(wavHeader), 0);
    view.set(new Uint8Array(pcmData.buffer), wavHeader.byteLength);
    
    return wavBuffer;
  }

  private createWavHeader(dataLength: number, sampleRate: number, numberOfChannels: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    // File length minus RIFF identifier length and file description length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    this.writeString(view, 8, 'WAVE');
    // Format chunk identifier
    this.writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (PCM)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, numberOfChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, numberOfChannels * 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    this.writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, dataLength, true);
    
    return buffer;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Get the URL for playback of the completed recording
  getPlaybackUrl(): string | null {
    if (!this.completedRecording) {
      return null;
    }
    return URL.createObjectURL(this.completedRecording);
  }

  // Get the completed recording blob
  getCompletedRecording(): Blob | null {
    return this.completedRecording;
  }

  // Clear the completed recording and free memory
  clearCompletedRecording(): void {
    this.completedRecording = null;
    this.finalDuration = 0;
  }

  // Get recording duration excluding paused time
  getRecordingDuration(): number {
    // If recording is complete, return the stored final duration
    if (!this.isRecording && this.completedRecording) {
      return this.finalDuration;
    }

    // If not recording and no completed recording, return 0
    if (!this.isRecording) {
      return 0;
    }

    // Calculate current duration while recording
    const now = Date.now();
    const totalTime = now - this.recordingStartTime;
    const currentPausedTime = this.isPaused ? (now - this.pauseStartTime) : 0;
    return Math.max(0, Math.floor((totalTime - this.pausedDuration - currentPausedTime) / 1000));
  }

  setQuality(quality: 'standard' | 'high'): void {
    this.audioBitsPerSecond = quality === 'high' ? 256000 : 128000;
  }

  getQuality(): 'standard' | 'high' {
    return this.audioBitsPerSecond === 256000 ? 'high' : 'standard';
  }

  private cleanupRecording(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
  }

  // Cleanup method - currently unused but kept for potential future use
  // private cleanup(): void {
  //   this.cleanupRecording();
  //   this.completedRecording = null;
  // }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  async checkMicrophonePermission(): Promise<boolean> {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state === 'granted';
    } catch {
      // Fallback: try to access microphone directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }

  // Get the current audio stream for monitoring purposes
  getAudioStream(): MediaStream | null {
    return this.audioStream;
  }
} 