import { API } from '../preload/index'

declare global {
  interface Window {
    api: API
  }

  // Linters prefer globalThis over window; declare api here so both work
  // eslint-disable-next-line no-var
  var api: API
}

export { }
