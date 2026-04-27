import { useEffect, useRef, type RefObject } from 'react'

const THRESHOLD_PX = 2
const DEBOUNCE_MS = 30

/** Observe an element's height and report it to the main process for window resizing. */
export function useAutoHeight<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null)
  const lastHeight = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const report = () => {
      const height = Math.ceil(el.scrollHeight)
      if (height > 0 && Math.abs(height - lastHeight.current) > THRESHOLD_PX) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          lastHeight.current = height
          window.snapcue.reportHeight(height)
        }, DEBOUNCE_MS)
      }
    }

    const observer = new ResizeObserver(report)
    observer.observe(el)
    // Initial report
    report()

    return () => {
      clearTimeout(timer.current)
      observer.disconnect()
    }
  }, [])

  return ref
}
