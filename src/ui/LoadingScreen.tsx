import { useState, useEffect } from "react";

export default function LoadingScreen() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-stone-400">
      <p>Caricamento…</p>
      {slow && (
        <p className="text-sm mt-2">
          Il server si sta risvegliando, potrebbe volerci un minuto…
        </p>
      )}
    </div>
  );
}
