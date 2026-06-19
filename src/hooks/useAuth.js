import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState(null);

  // Загружаем данные сотрудника по user_id или employee_id из metadata
  const loadEmployee = async (u) => {
    if (!u) { setEmployeeData(null); return; }
    const meta = u.user_metadata || {};
    const empId = meta.employee_id;
    
    if (!empId) {
      // Владелец или пользователь без привязки к сотруднику — полный доступ
      const { data } = await supabase
        .from('employees')
        .select('permissions,position_id,name,pin,user_id')
        .eq('user_id', u.id)
        .maybeSingle();
      if (data) { setEmployeeData(data); return; }
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
    return perms.includes(perm) || perms.includes('admin');
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { user, loading, employeeData, hasPermission, signIn, signUp, signOut };
}
