import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onReset?: () => void;
  action?: string;
  theme?: 'light' | 'dark';
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: (err: any) => void;
          'expired-callback'?: () => void;
          theme?: string;
          action?: string;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  onVerify,
  onReset,
  action = 'submit',
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isScriptError, setIsScriptError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const activeSiteKey = siteKey || '1x00000000000000000000AA';

  useEffect(() => {
    let isMounted = true;
    setIsScriptError(false);

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;

      try {
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {}
          widgetIdRef.current = null;
        }
        containerRef.current.replaceChildren();

        const id = window.turnstile.render(containerRef.current, {
          sitekey: activeSiteKey,
          theme,
          action,
          callback: (token: string) => {
            if (isMounted) {
              setIsScriptError(false);
              onVerify(token);
            }
          },
          'error-callback': () => {
            if (isMounted) {
              setIsScriptError(true);
              if (onReset) onReset();
            }
          },
          'expired-callback': () => {
            if (isMounted) {
              if (onReset) onReset();
            }
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        if (isMounted) {
          setIsScriptError(true);
          if (onReset) onReset();
        }
      }
    };

    const loadTurnstileScript = () => {
      if (window.turnstile) {
        renderWidget();
        return;
      }

      const existingScript = document.getElementById('cf-turnstile-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          if (isMounted) {
            setIsScriptError(true);
            if (onReset) onReset();
          }
        };
        script.onload = () => {
          if (isMounted) renderWidget();
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => {
          if (isMounted) renderWidget();
        });
        if (window.turnstile) {
          renderWidget();
        }
      }
    };

    loadTurnstileScript();

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {}
        widgetIdRef.current = null;
      }
    };
  }, [activeSiteKey, theme, action, reloadNonce]);

  return (
    <div className="my-3 flex flex-col justify-center items-center min-h-[65px] gap-2">
      <div ref={containerRef} className="cf-turnstile flex justify-center" />
      {isScriptError && (
        <div className="w-full p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2">
          <span>Verifikasi Cloudflare Turnstile gagal dimuat atau kedaluwarsa.</span>
          <button
            type="button"
            onClick={() => {
              if (onReset) onReset();
              setReloadNonce((n) => n + 1);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold shrink-0 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Muat Ulang</span>
          </button>
        </div>
      )}
    </div>
  );
};
