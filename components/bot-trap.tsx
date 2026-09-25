"use client";

import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { FORM_STARTED_FIELD, HONEYPOT_FIELD } from "@/lib/bot-check";

const offScreen: CSSProperties = {
  position: "absolute",
  left: "-10000px",
  top: "-10000px",
  width: "1px",
  height: "1px",
  overflow: "hidden",
};

/**
 * Hidden honeypot plus the time this form rendered. Spread `payload()` into the
 * JSON body. The server, not this component, decides whether to keep the lead.
 */
export function useBotTrap(): {
  field: ReactNode;
  payload: () => Record<string, string | number>;
} {
  const id = useId();
  const startedAt = useRef(Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);

  const field = (
    <div aria-hidden="true" style={offScreen}>
      <label htmlFor={id}>Company website</label>
      <input
        ref={honeypotRef}
        id={id}
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        defaultValue=""
        aria-hidden="true"
      />
    </div>
  );

  function payload() {
    return {
      [HONEYPOT_FIELD]: honeypotRef.current?.value ?? "",
      [FORM_STARTED_FIELD]: startedAt.current,
    };
  }

  return { field, payload };
}
