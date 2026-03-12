let audioCtx: AudioContext | null = null

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new AudioContext()
    }
    return audioCtx
}

/** 成功音: ピコン（高い音2つ） */
export function playSuccess() {
    try {
        const ctx = getAudioContext()
        // 1音目
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.frequency.value = 880  // A5
        osc1.type = 'sine'
        gain1.gain.setValueAtTime(0.3, ctx.currentTime)
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(ctx.currentTime)
        osc1.stop(ctx.currentTime + 0.15)

        // 2音目（少し高く）
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.frequency.value = 1175  // D6
        osc2.type = 'sine'
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12)
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(ctx.currentTime + 0.12)
        osc2.stop(ctx.currentTime + 0.3)
    } catch { /* 音声再生の失敗で処理を止めない */ }
}

/** エラー音: ブッ（低い短い音） */
export function playError() {
    try {
        const ctx = getAudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 200  // 低い音
        osc.type = 'square'
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.2)
    } catch { /* 音声再生の失敗で処理を止めない */ }
}
