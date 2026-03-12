/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spinner, Text, Tooltip } from "@radix-ui/themes";
import { NodeProps } from "@xyflow/react";
import { MousePointerClickIcon, PlayIcon } from "lucide-react";
import { useCanvasDataContext } from "../CanvasDataProvider";
import { BaseNode } from "./BaseNode";
import { MiniAppInspector } from "./MiniAppInspector";
import styles from "./MiniAppNode.module.scss";
import { nodeFactory } from "./node-factory";

export const miniAppNodes = nodeFactory<MiniAppNodeData>("miniApp", MiniAppNode, {
  Inspector: MiniAppInspector,
});

export type EntityType = "user-goal" | "tech-stack";

export type MiniAppNodeData = {
  prompt: string;
  state: "generating" | "ready" | "error";
  thumbnailUrl?: string;
  appCode?: string;
};

function MiniAppNode(props: NodeProps) {
  const { prompt, thumbnailUrl, state } = props.data as MiniAppNodeData;
  const { inspectNode } = useCanvasDataContext();

  return (
    <BaseNode
      className={styles.node}
      onDoubleClick={() => inspectNode(props.id)}
      {...props}
    >
      <div className={styles.header}>
        <MousePointerClickIcon size={16} />
        <span>Prototype</span>
      </div>
      <div className={styles.content}>
        {state === "generating" && (
          <>
            <Spinner />
            <Text className={styles.subtitle} color="gray">
              Generating
            </Text>
          </>
        )}
        {state === "ready" && (
          <>
            <div
              className={styles.theImage}
              style={{
                backgroundImage: `url(${thumbnailUrl})`,
              }}
            />
            <Button
              className={styles.playButton}
              size="3"
              variant="solid"
              color={props.selected ? "amber" : "gray"}
              onClick={() => inspectNode(props.id)}
            >
              <PlayIcon size={16} />
              Run
            </Button>
          </>
        )}
      </div>
      <Tooltip content={prompt} delayDuration={500}>
        <div className={styles.prompt}>{prompt}</div>
      </Tooltip>
    </BaseNode>
  );
}
