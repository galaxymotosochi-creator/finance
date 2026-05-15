import { useEffect } from 'react';

export default function FullSite() {
  // Get current hash to pass to iframe
  const hash = window.location.hash;
  const page = hash.split('/').pop() || 'dashboard';

  useEffect(() => {
    // Listen for messages from iframe
    const handler = (e) => {
      if (e.data && e.data.type === 'navigate') {
        window.location.hash = '#/' + e.data.page;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#fff' }}>
      <iframe
        src="/original.html"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Finance"
      />
    </div>
  );
}
