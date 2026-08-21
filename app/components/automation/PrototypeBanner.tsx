"use client"

import { Info } from "lucide-react"
import styles from "./automation.module.css"

/** Standing disclaimer, kept at the top of the page so it's always in view. */
export function PrototypeBanner() {
  return (
    <div className={styles.prototypeBanner} role="note">
      <Info size={14} aria-hidden="true" className={styles.prototypeBannerIcon} />
      This is a prototype only, it is not using any real data and is not built
    </div>
  )
}
