/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Node, NodeProps } from "@xyflow/react";
import styles from "./EntityInspector.module.scss";
import { ENTITY_TYPE_META, EntityNodeData } from "./EntityNode";
import { Notebook } from "@/notebook/Notebook";
import { useCanvasDataContext } from "../CanvasDataProvider";
import { InlineTextEdit } from "@/components/InlineTextEdit";
import { CodeIcon } from "lucide-react";

export function EntityInspector({ id, data }: NodeProps<Node<EntityNodeData>>) {
  const { markdownBody, type, title } = data;
  const { updateNode } = useCanvasDataContext();
  const { icon: Icon, label } = ENTITY_TYPE_META[type] || {
    icon: CodeIcon,
    label: "Unknown",
  };

  return (
    <div className={styles.inspector}>
      <div className={styles.header}>
        <Icon className={styles.icon} />
        <InlineTextEdit
          className={styles.title}
          value={title}
          placeholder="Enter a label"
          onChange={(title) => {
            updateNode(id, {
              data: { ...data, title } satisfies EntityNodeData,
            });
          }}
        />
        <div className={styles.subtitle}>
          {label}
        </div>
      </div>
      <Notebook
        className={styles.editor}
        key={id}
        entity={data}
        content={markdownBody || ""}
        onUpdate={(markdownBody) =>
          updateNode(id, {
            data: { ...data, markdownBody } satisfies EntityNodeData,
          })
        }
      />
    </div>
  );
}

EntityInspector.Label = () => "Spec editor";