
import { Blob } from '@google/genai';

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Ensure the byte length is even for 16-bit PCM
  const length = Math.floor(data.byteLength / 2) * 2;
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, length / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array, inputSampleRate: number): Blob {
  // Downsample to 16kHz if necessary
  const targetSampleRate = 16000;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.floor(data.length / ratio);
  const result = new Int16Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const offset = Math.floor(i * ratio);
    // Simple decimation/sampling (linear interpolation could be better but this is fast)
    result[i] = Math.max(-1, Math.min(1, data[offset])) * 0x7FFF;
  }

  return {
    data: encode(new Uint8Array(result.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
