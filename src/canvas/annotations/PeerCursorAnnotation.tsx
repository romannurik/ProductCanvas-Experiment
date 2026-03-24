/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeProps, useStore } from "@xyflow/react";
import cn from "classnames";
import { useMemo } from "react";
import tinycolor from "tinycolor2";
import { annotationFactory } from "./annotation-factory";
import styles from "./PeerCursorAnnotation.module.scss";

export const peerCursorAnnotations =
  annotationFactory<PeerCursorAnnotationData>(
    "annotation:peerCursor",
    PeerCursorAnnotation,
    { forceProps: { selectable: false, draggable: false, zIndex: 9999 } },
  );

export type PeerCursorAnnotation = ReturnType<
  (typeof peerCursorAnnotations)["make"]
>;

type PeerCursorAnnotationData = {
  name: string;
  color: string;
  floatingAngle?: number;
  aiGlow?: boolean;
  hidden?: boolean; // for animating gemini visible/invisible
};

function PeerCursorAnnotation(props: NodeProps) {
  const zoom = useStore((s) => s.transform[2]);
  const { color, name, hidden, aiGlow, floatingAngle } =
    props.data as PeerCursorAnnotationData;
  const dark = useMemo(() => tinycolor(color).isDark(), [color]);

  return (
    <div
      className={cn(styles.peerCursorAnnotation, {
        [styles.isHidden]: hidden,
        [styles.isDark]: dark,
        [styles.isAiGlow]: aiGlow,
        [styles.isFloating]: floatingAngle !== undefined,
      })}
      style={{
        ["--color" as any]: color,
        transform: [
          `rotate(${floatingAngle ? floatingAngle + 135 : 0}deg)`,
          `scale(${1 / zoom})`,
          `translate(8px, 8px)`,
        ].join(" "),
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={`var(--color)`}
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {floatingAngle === undefined ? (
          <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />
        ) : (
          <path d="M4.037 4.688a.495.495 0 01.65-.651l13.207 5.365a2 2 0 01.662 3.267l-5.887 5.887a2 2 0 01-3.267-.662L4.037 4.688z" />
        )}
      </svg>
      {name && floatingAngle === undefined && (
        <div className={styles.label}>{name}</div>
      )}
    </div>
  );
}
