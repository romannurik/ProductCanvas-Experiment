/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineTextEdit } from "@/components/InlineTextEdit";
import { NodeProps } from "@xyflow/react";
import { CodeIcon, FlagIcon, LucideIcon, UserIcon } from "lucide-react";
import { useCanvasDataContext } from "../CanvasDataProvider";
import { BaseNode } from "./BaseNode";
import { EntityInspector } from "./EntityInspector";
import styles from "./EntityNode.module.scss";
import { nodeFactory } from "./node-factory";

export const entityNodes = nodeFactory<EntityNodeData>("entity", EntityNode, {
  Inspector: EntityInspector,
});

export type EntityType = "user-goal" | "tech-stack" | "persona";

export const ENTITY_TYPE_META: Record<
  EntityType,
  { label: string; icon: LucideIcon }
> = {
  persona: { label: "Persona", icon: UserIcon },
  "user-goal": { label: "User Goal", icon: FlagIcon },
  "tech-stack": { label: "Tech Stack", icon: CodeIcon },
};

export type EntityNodeData = {
  title: string;
  type: EntityType;
  markdownBody?: string;
};

function EntityNode(props: NodeProps) {
  const { type, title } = props.data as EntityNodeData;
  const { icon: Icon, label } = ENTITY_TYPE_META[type] || {
    icon: CodeIcon,
    label: "Unknown",
  };
  const { updateNode, inspectNode } = useCanvasDataContext();

  return (
    <BaseNode
      className={styles.node}
      onDoubleClick={() => inspectNode(props.id)}
      {...props}
    >
      <Icon className={styles.icon} size={16} />
      <div className={styles.content}>
        <InlineTextEdit
          className={styles.title}
          value={title}
          placeholder="Enter a label"
          onChange={(title) => {
            updateNode(props.id, { data: { title } });
          }}
        />
        <div className={styles.label}>{label}</div>
      </div>
    </BaseNode>
  );
}
