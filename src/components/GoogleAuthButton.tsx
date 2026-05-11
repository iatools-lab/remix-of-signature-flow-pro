import { useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      locale?: string;
    },
  ) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google auth is only available in the browser"));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]',
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google auth failed to load")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google auth failed to load"));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

export function GoogleAuthButton({
  mode,
  disabled,
  locale,
  onCredential,
}: {
  mode: "login" | "signup";
  disabled?: boolean;
  locale?: string;
  onCredential: (credential: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const disabledRef = useRef(Boolean(disabled));
  const [isReady, setIsReady] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
  }, [disabled]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    if (!googleClientId?.trim() || !container) {
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !containerRef.current) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId.trim(),
          ux_mode: "popup",
          callback: (response) => {
            if (disabledRef.current || !response.credential) {
              return;
            }
            onCredential(response.credential);
          },
        });

        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          width: Math.min(containerRef.current.offsetWidth || 320, 400),
          locale: locale?.startsWith("fr") ? "fr" : "en",
        });
        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsReady(false);
        }
      });

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [googleClientId, locale, mode, onCredential]);

  if (!googleClientId?.trim()) {
    return null;
  }

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="flex min-h-11 w-full justify-center" />
      {(disabled || !isReady) && <div className="absolute inset-0 cursor-not-allowed rounded bg-background/50" />}
    </div>
  );
}
