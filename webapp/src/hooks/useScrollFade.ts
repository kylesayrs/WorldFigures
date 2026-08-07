import { useRef, type RefObject } from 'react';
import { useScroll, useTransform, type MotionValue } from 'framer-motion';

/**
 * Ties opacity (and a small rise/fall) to the element's own position as it
 * travels through the viewport: fades in as it enters from the bottom,
 * holds while it's comfortably on screen, fades out as it exits the top.
 */
export function useScrollFade<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
} {
  const ref = useRef<T>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [14, 0, 0, -14]);
  return { ref, opacity, y };
}
