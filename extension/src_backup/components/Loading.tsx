import React from 'react';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  size = 'medium'
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'loading--small';
      case 'large':
        return 'loading--large';
      default:
        return 'loading--medium';
    }
  };

  return (
    <div className={`loading ${getSizeClass()}`}>
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
      {message && <p className="loading-text">{message}</p>}
    </div>
  );
};

export default Loading;