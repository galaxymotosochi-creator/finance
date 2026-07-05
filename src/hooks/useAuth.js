import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  // Синхронно читаем сессию из localStorage, чтобы user был сразу
  const storedSession = (() => { try { const s = localStorage.getItem('atlaspos_session'); return s ? JSON.parse(s) : null; } catch(e) { return null; } })();
  const [user, setUser] = useState(storedSession?.user || null);
  const [loading, setLoading] = useState(!storedSession);
  const [employeeData, setEmployeeData] = useState(null);

  // Загружаем данные сотрудника по user_id или employee_id из metadata
  const loadEmployee = async (u) => {
    if (!u) { setEmployeeData(null); return; }
    const meta = u.user_metadata || {};
    const empId = meta.employee_id;
    
    if (!empId) {
      // Владелец — полный доступ, игнорируем любые записи в employees
      setEmployeeData(null);
      return;
    }
    
    const { data } = await supabase
      .from('employees')
      .select('permissions,position_id,name,pin')
      .eq('id', empId)
      .maybeSingle();
    
    if (data) { setEmployeeData(data); }
    else { setEmployeeData(null); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      loadEmployee(u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        loadEmployee(u);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const hasPermission = (perm) => {
    if (!employeeData) return true; // владелец — полный доступ
    const perms = employeeData.permissions || [];
    if (!perms || perms.length === 0) return true; // пустые права = полный доступ
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
