/**
 * Copixi — Native TTS via Web Speech API (browser-only, §8: stays local).
 * Extracted from Mascota so ExcelChat can reuse the same queue.
 */

const STORAGE_KEY = 'copixi:tts-muted'

let muted = false
try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'
} catch {
  muted = false
}

const queue: string[] = []
let speaking = false

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang.startsWith('es')) ?? voices.find((v) => v.lang.startsWith('en')) ?? null
}

function processQueue() {
  if (speaking || queue.length === 0 || !isSupported()) return
  if (muted) {
    queue.length = 0
    return
  }
  speaking = true
  const text = queue.shift()!
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  utterance.rate = 0.95
  utterance.pitch = 1.05
  utterance.onend = () => {
    speaking = false
    processQueue()
  }
  utterance.onerror = () => {
    speaking = false
    processQueue()
  }
  window.speechSynthesis.speak(utterance)
}

export function speak(text: string): void {
  if (!isSupported() || muted || !text) return
  queue.push(text)
  processQueue()
}

export function cancel(): void {
  if (isSupported()) window.speechSynthesis.cancel()
  queue.length = 0
  speaking = false
}

export function isTtsSupported(): boolean {
  return isSupported()
}

export function getMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (value) cancel()
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { mascotaSpeak: (t: string) => void }).mascotaSpeak = speak
}
