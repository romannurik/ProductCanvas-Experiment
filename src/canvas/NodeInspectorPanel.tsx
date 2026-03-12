/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IconButton, Text } from "@radix-ui/themes";
import styles from "./NodeInspectorPanel.module.scss";
import cn from "classnames";
import { useCanvasDataContext } from "./CanvasDataProvider";
import { XIcon } from "lucide-react";
import { nodeFactories } from "./factories";
import { useMemo } from "react";
import { NodeProps } from "@xyflow/react";

export function NodeInspectorPanel({
  className,
  nodeId,
}: {
  className?: string;
  nodeId: string;
}) {
  const { nodes, closeInspector } = useCanvasDataContext();

  const { Inspector, node } = useMemo(() => {
    const node = nodeId ? nodes.find((n) => n.id === nodeId) : undefined;
    if (!node) return { Inspector: undefined, node: undefined };
    const Inspector = nodeFactories[node.type || ""]?.Inspector;
    return { node, Inspector };
  }, [nodeId, nodes]);

  const nodeProps: NodeProps<any> | undefined = node
    ? {
        type: node.type || "",
        selectable: node.selectable || false,
        selected: node.selected || false,
        dragging: node.dragging || false,
        draggable: node.draggable || false,
        deletable: node.deletable || false,
        zIndex: node.zIndex || 0,
        isConnectable: false,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
        ...(node as any),
      }
    : undefined;

  return (
    <div className={cn(styles.panel, className)}>
      <header className={styles.header}>
        <Text className={styles.label} size="3" color="gray">
          {!!nodeProps && !!Inspector?.Label ? (
            <Inspector.Label {...nodeProps} />
          ) : (
            <>Inspector</>
          )}
        </Text>
        <IconButton
          onClick={() => closeInspector()}
          className={styles.closeButton}
          size="1"
          color="gray"
          variant="ghost"
          radius="full"
        >
          <XIcon size={20} />
        </IconButton>
      </header>
      <div className={styles.body}>
        {!!node && !!nodeProps && !!Inspector ? (
          <Inspector {...nodeProps} />
        ) : (
          <>No inspector for this node</>
        )}
      </div>
    </div>
  );
}
