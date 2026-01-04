import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  type = 'button',
  className = '',
  icon = null
}) => {
  const baseClasses = 'font-medium rounded-lg transition-colors flex items-center justify-center space-x-2';
  
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    success: 'btn-success'
  };

  const sizeClasses = {
    small: 'py-1 px-3 text-sm',
    medium: 'py-2 px-4',
    large: 'py-3 px-6 text-lg'
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export default Button;
