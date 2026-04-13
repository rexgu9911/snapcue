import { useEffect, useRef, type RefObject } from 'react'

/** Observe an element's height and report it to the main process for window resizing. */
export function useAutoHeight<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const report = () => {
      const height = el.scrollHeight
      if (height > 0) {
        window.snapcue.reportHeight(height)
      }
    }

    const observer = new ResizeObserver(report)
    observer.observe(el)
    // Initial report
    report()

    return () => observer.disconnect()
  }, [])

  return ref
}
