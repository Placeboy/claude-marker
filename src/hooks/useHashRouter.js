import { useState, useEffect, useCallback } from 'react'

function getHashDocId() {
  const hash = window.location.hash.slice(1)
  return hash || null
}

export default function useHashRouter() {
  const [hashDocId, setHashDocId] = useState(getHashDocId)

  useEffect(() => {
    const handlePopState = () => {
      setHashDocId(getHashDocId())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setHash = useCallback((docId) => {
    window.history.pushState(null, '', '#' + docId)
    setHashDocId(docId)
  }, [])

  const replaceHash = useCallback((docId) => {
    window.history.replaceState(null, '', '#' + docId)
    setHashDocId(docId)
  }, [])

  return { hashDocId, setHash, replaceHash }
}
