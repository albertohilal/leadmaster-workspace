import React from 'react';

const Card = ({ title, children, className = '', icon = null, action = null }) => {
  return (
    <div className={`card ${className}`}>
      {(title || icon || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {icon && <span className="text-2xl">{icon}</span>}
            {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Card;
