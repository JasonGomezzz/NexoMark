/** Visibility-aware looping playback. Animation and progress are injected for testing. */
export function createStoryPlayback({ getProgress, setProgress, animateToEnd }) {
  let status = 'ready'
  let visible = false
  let animation = null
  let generation = 0
  const listeners = new Set()

  function publish(next) {
    if (status === next) return
    status = next
    listeners.forEach(listener => listener())
  }

  function stop() {
    generation += 1
    const previous = animation
    animation = null
    previous?.stop()
  }

  function play() {
    if (!visible) {
      publish('suspended')
      return
    }
    stop()
    if (getProgress() >= 1) setProgress(0)
    const currentGeneration = generation
    publish('playing')
    animation = animateToEnd(() => {
      if (currentGeneration !== generation) return
      animation = null
      setProgress(0)
      play()
    })
  }

  return {
    getSnapshot: () => status,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setVisible(next) {
      if (visible === next) return
      visible = next
      if (!visible && status === 'playing') {
        stop()
        publish('suspended')
      } else if (visible && (status === 'ready' || status === 'suspended')) {
        play()
      }
    },
    pause() {
      stop()
      publish('paused')
    },
    play,
    seek(value) {
      stop()
      const progress = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
      setProgress(progress)
      publish('paused')
    },
  }
}
