import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const storedSession = (() => { try { const s = localStorage.getItem('atlaspos_session'); return s ? JSON.parse(s) : null; } catch(e) { return null; } })();
  const [user, setUser] = useState(storedSession?.user || null);
  const [loading, setLoading] = useState(!storedSession);
  const [employeeData, setEmployeeData] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const stored = localStorage.getItem('atlaspos_session');
      if (!stored) {
        setUser(null); setEmployeeData(null); setLoading(false);
        return;
      }
      const session = JSON.parse(stored);
      setUser(session.user);

      // Загружаем права доступа через API
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + (session.access_token || '') }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
            setEmployeeData({ permissions: data.permissions });
          } else {
            setEmployeeData(null); // владелец или полный доступ
          }
        } else {
          // Токен протух
          localStorage.removeItem('atlaspos_session');
          setUser(null); setEmployeeData(null);
        }
      } catch(e) {
        console.error('Auth check failed:', e);
        // При ошибке сети — всё равно пускаем, но без ограничений
        setEmployeeData(null);
      }
      setLoading(false);
    };

    checkAuth();

    // Слушаем изменения аутентификации (через supabase client)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
        // После входа перезагрузим права
        fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + (session?.access_token || '') }
        }).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
            setEmployeeData({ permissions: data.permissions });
          } else {
            setEmployeeData(null);
          }
        }).catch(() => setEmployeeData(null));
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setEmployeeData(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const hasPermission = (perm) => {
    if (!employeeData) return true; // владелец — полный доступ
    const perms = employeeData.permissions || [];
    if (!perms || perms.length === 0) return false; // сотрудник без прав = нет доступа
    return perms.includes(perm) || perms.includes('admin');
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password) => {
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) throw result.error;
    return result;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { user, loading, employeeData, hasPermission, signIn, signUp, signOut };
}
