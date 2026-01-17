import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function EnvironmentBanner() {
  const [environment, setEnvironment] = useState(null);

  useEffect(() => {
    // Detect environment from URL or query param
    const url = window.location.href;
    const hostname = window.location.hostname;

    // Base44 typically uses: 
    // - appname.preview.base44.io (preview)
    // - appname.base44.io (published)
    // OR query param: ?_env=preview or ?_env=published
    
    const params = new URLSearchParams(window.location.search);
    const envParam = params.get('_env');

    let env = 'unknown';
    if (envParam) {
      env = envParam.toLowerCase();
    } else if (hostname.includes('.preview.')) {
      env = 'preview';
    } else if (hostname.includes('base44')) {
      env = 'published';
    }

    setEnvironment(env);
  }, []);

  if (!environment || environment === 'unknown') {
    return null;
  }

  const isPreview = environment === 'preview';
  const bgColor = isPreview ? 'bg-orange-100' : 'bg-green-100';
  const textColor = isPreview ? 'text-orange-900' : 'text-green-900';
  const borderColor = isPreview ? 'border-orange-300' : 'border-green-300';
  const badgeColor = isPreview ? 'bg-orange-500' : 'bg-green-500';

  return (
    <div className={`fixed top-0 left-0 right-0 ${bgColor} border-b-2 ${borderColor} px-4 py-2 flex items-center justify-center gap-2 z-40 safe-area-top`}>
      <AlertCircle className={`w-4 h-4 ${textColor}`} />
      <span className={`text-sm font-semibold ${textColor}`}>
        <span className={`inline-block ${badgeColor} text-white px-2.5 py-0.5 rounded-full text-xs font-bold mr-2`}>
          {isPreview ? 'PREVIEW' : 'PUBLISHED'}
        </span>
        {isPreview
          ? 'Testing Preview Data'
          : 'Using Published Data'
        }
      </span>
    </div>
  );
}