import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Авторизация.
 *
 * ВАЖНО (шаг 1 архитектуры): `user` — СТАБИЛЬНАЯ ссылка.
 * Она меняется только при входе и выходе. Данные профиля (тип бизнеса,
 * подтверждение почты, онбординг) живут отдельным полем `profile` и НЕ
 * подмешиваются в `user` — иначе каждое обновление профиля создавало бы
 * новый объект, а страницы с зависимостью [user] перезагружали данные
 * по кругу (это и давало «моргание»).
 */
export function useAuth() {
  const storedSession = (() => {
    try { const s = localStorage.getItem('atlaspos_session'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  })();

  // user — только идентичность из сессии. Никаких примесей.
  const [user, setUser] = useState(storedSession?.user || null);
  const [profile, setProfile] = useState(null); // { business_type, onboarding_done, email_verified, ... }
  const [loading, setLoading] = useState(!storedSession);
  const [employeeData, setEmployeeData] = useState(null);

  const loadProfile = useCallback(async (session) => {
    if (!session || !session.access_token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + session.access_token },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) setProfile(data.user);
        if (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
          setEmployeeData({ permissions: data.permissions });
        } else {
          setEmployeeData(null); // владелец или полный доступ
        }
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const stored = localStorage.getItem('atlaspos_session');
      if (!stored) {
        setUser(null); setProfile(null); setEmployeeData(null); setLoading(false);
        return;
      }
      let session = null;
      try { session = JSON.parse(stored); } catch (e) { session = null; }

      if (!session) {
        localStorage.removeItem('atlaspos_session');
        setUser(null); setProfile(null); setEmployeeData(null); setLoading(false);
        return;
      }

      // user берём из сохранённой сессии — ссылка не меняется при обычных рендерах
      setUser(prev => prev || session.user || null);
      await loadProfile(session);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
        loadProfile(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setProfile(null); setEmployeeData(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, [loadProfile]);

  // Права сотрудника — отдельное поле, не часть user
  const hasPermission = useCallback((perm) => {
    if (!employeeData) return true; // владелец — полный доступ
    const perms = employeeData.permissions || [];
    if (!perms || perms.length === 0) return false;
    return perms.includes(perm) || perms.includes('admin');
  }, [employeeData]);

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
    try { await supabase.auth.signOut(); } catch (e) {}
    try {
      localStorage.removeItem('atlaspos_session');
      localStorage.removeItem('atlaspos_pending_receipts');
    } catch (e) {}
    setUser(null);
    setProfile(null);
    setEmployeeData(null);
    setLoading(false);
  };

  // Тип бизнеса: сначала из профиля (сервер), иначе retail
  const businessType = profile?.business_type || (() => {
    try { return localStorage.getItem('atlaspos_business_type') || 'retail'; } catch (e) { return 'retail'; }
  })();

  // Стабильный набор полей: user меняется только при входе/выходе
  return useMemo(() => ({
    user,
    profile,
    businessType,
    loading,
    employeeData,
    hasPermission,
    signIn,
    signUp,
    signOut,
  }), [user, profile, businessType, loading, employeeData, hasPermission]);
}
