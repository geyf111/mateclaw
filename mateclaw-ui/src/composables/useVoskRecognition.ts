import { ref, readonly } from 'vue'
import { mcToast } from '@/composables/useMcToast'
import { useI18n } from 'vue-i18n'

let _modelPromise: Promise<any> | null = null
let _model: any = null

const MODEL_URL = '/model.tar.gz'

async function loadModel(): Promise<any> {
  if (_model) return _model
  if (_modelPromise) return _modelPromise

  _modelPromise = (async () => {
    const { createModel } = await import('vosk-browser')
    const model = await createModel(MODEL_URL)
    model.setLogLevel(-1)
    _model = model
    return model
  })()

  return _modelPromise
}

export function useVoskRecognition(options?: {
  onResult?: (text: string, isFinal: boolean) => void
}) {
  const { t } = useI18n()
  
  const isRecording = ref(false)
  const isLoading = ref(false)
  const partialText = ref('')
  const finalText = ref('')
  const errorMsg = ref('')

  let recognizer: any = null
  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let processorNode: ScriptProcessorNode | null = null

  async function start() {
    if (isRecording.value || isLoading.value) return
    try {
      isLoading.value = true
      errorMsg.value = ''
      partialText.value = ''
      finalText.value = ''

      const model = await loadModel()

      recognizer = new model.KaldiRecognizer(16000)
      recognizer.setWords(true)

      recognizer.on("result", (msg: any) => {
        finalText.value = msg.result.text
        options?.onResult?.(msg.result.text, true)
      })

      recognizer.on("partialresult", (msg: any) => {
        partialText.value = msg.result.partial ?? ''
        options?.onResult?.(msg.result.partial ?? '', false)
      })

      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      })

      audioContext = new AudioContext({ sampleRate: 16000 })
      processorNode = audioContext.createScriptProcessor(4096, 1, 1)
      processorNode.onaudioprocess = (e) => {
        try {
          recognizer?.acceptWaveform(e.inputBuffer)
        } catch (err) {
          console.error('[Vosk] acceptWaveform error:', err)
        }
      }

      const source = audioContext.createMediaStreamSource(mediaStream)
      source.connect(processorNode)
      processorNode.connect(audioContext.destination)

      isLoading.value = false
      isRecording.value = true
    } catch (err: any) {
      console.error('[Vosk] start failed:', err)
      errorMsg.value = err.message || "start failed"
      isLoading.value = false
      mcToast.error(t('talk.micError'))
    }
  }

  async function stop() {
    mediaStream?.getTracks().forEach((t) => t.stop())
    mediaStream = null

    if (audioContext) {
      await audioContext.close()
      audioContext = null
    }

    recognizer?.remove()
    recognizer = null
    processorNode = null

    isRecording.value = false
    partialText.value = ''
  }

  async function dispose() {
    await stop()
    _model?.terminate()
    _model = null
    _modelPromise = null
  }

  return {
    isRecording: readonly(isRecording),
    isLoading: readonly(isLoading),
    partialText: readonly(partialText),
    finalText: readonly(finalText),
    errorMsg: readonly(errorMsg),
    start,
    stop,
    dispose,
  }
}