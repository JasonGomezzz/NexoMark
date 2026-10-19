let sdkPromise

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const timer = setTimeout(() => { script.remove(); reject(new Error('Google tardó demasiado en responder.')) }, 15000)
    script.onload = () => {
      clearTimeout(timer)
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('No se pudo cargar el acceso de Google.'))
    }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('No se pudo cargar Google. Revisa tu conexión o los bloqueadores del navegador.')) }
    document.head.appendChild(script)
  }).catch(error => { sdkPromise = undefined; throw error })
  return sdkPromise
}
