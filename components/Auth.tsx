import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const handleHashChange = () => {
      setIsLogin(window.location.hash !== '#register');
    };

    // Check initial hash
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return isLogin ? <Login /> : <Register />;
};

export default Auth;

