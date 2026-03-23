/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { usePresenceContext } from "@/collab/PresenceProvider";
import {
  Background,
  Edge,
  EdgeTypes,
  FitBoundsOptions,
  FitViewOptions,
  Node,
  NodeTypes,
  ReactFlow,
  ReactFlowInstance,
  XYPosition,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import cn from "classnames";
import { toPng } from "html-to-image";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PeerCursorAnnotation,
  peerCursorAnnotations,
} from "./annotations/PeerCursorAnnotation";
import styles from "./Canvas.module.scss";
import { useCanvasDataContext } from "./CanvasDataProvider";
import { annotationFactories, nodeFactories } from "./factories";
import FloatingConnectionLine from "./FloatingConnectionLine";
import FloatingEdge from "./FloatingEdge";
import { commentNodes } from "./nodes/CommentNode";

const edgeTypes: EdgeTypes = {
  floating: FloatingEdge,
};

const nodeTypes: NodeTypes = Object.fromEntries(
  Object.values({ ...nodeFactories, ...annotationFactories }).map((n) => [
    n.type,
    n.component as React.ComponentType<any>,
  ]),
);

const fitViewOptions: FitViewOptions = {
  padding: { left: 0.1, top: 0.1, right: 0.1, bottom: 0.5 },
  duration: 400,
};

const fitBoundsOptions: FitBoundsOptions = {
  padding: 0.1,
  duration: 400,
};

export type CanvasRef = {
  fit: () => void;
  panTo: (...nodes: Node[]) => void;
  pointAtCenter: () => XYPosition;
  captureScreenshot: () => Promise<string>;
};

type Props = { className?: string };

export const Canvas = forwardRef<CanvasRef, Props>(({ className }, ref) => {
  const reactFlowNodeRef = useRef<HTMLDivElement>(null);
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance>();
  const { nodes, edges, setNodes, setEdges, commentMode, aiCursor } =
    useCanvasDataContext();
  const [paddedViewportCoords, setPaddedViewportCoords] = useState<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null>(null);
  const { peers, setAppData } = usePresenceContext();
  const [smoothedAiCursor, setSmoothedAiCursor] = useState<
    XYPosition & { hidden: boolean }
  >({ x: 0, y: 0, hidden: true });

  useEffect(() => {
    if (!aiCursor) {
      setSmoothedAiCursor((prev) => ({ ...prev, hidden: true }));
      return;
    }

    let cancel = false;
    setSmoothedAiCursor((prev) => {
      // when going from invisible to visible, teleport to the new position
      if (prev.hidden) return { ...aiCursor, hidden: false };

      // smoothly animate from previous position to another
      let nx = prev.x;
      let ny = prev.y;
      let alpha = 0.3;
      let tick = () => {
        if (cancel) return;
        nx = nx + (aiCursor.x - nx) * alpha;
        ny = ny + (aiCursor.y - ny) * alpha;
        if (Math.abs(nx - aiCursor.x) < 1 && Math.abs(ny - aiCursor.y) < 1) {
          setSmoothedAiCursor({ ...aiCursor, hidden: false });
        } else {
          setSmoothedAiCursor({ x: nx, y: ny, hidden: false });
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
      return prev;
    });
    return () => void (cancel = true);
  }, [aiCursor]);

  const annotations = useMemo<PeerCursorAnnotation[]>(() => {
    let makePeerCursor: (typeof peerCursorAnnotations)["make"] = (node) => {
      let { position } = node;
      if (!position || !paddedViewportCoords)
        return peerCursorAnnotations.make(node);
      let { left, top, right, bottom } = paddedViewportCoords;
      if (
        position.x < left ||
        position.x > right ||
        position.y < top ||
        position.y > bottom
      ) {
        let constrainedPos = {
          x: Math.max(left, Math.min(right, position.x)),
          y: Math.max(top, Math.min(bottom, position.y)),
        };
        node = {
          ...node,
          position: constrainedPos,
          data: {
            ...node.data,
            floatingAngle:
              Math.atan2(
                position.y - (bottom + top) / 2,
                position.x - (right + left) / 2,
              ) *
              (180 / Math.PI),
          },
        };
      }
      return peerCursorAnnotations.make(node);
    };

    let annotations = peers
      .filter((p) => p.appData?.canvasCursorPos)
      .map((p) =>
        makePeerCursor({
          id: `annotation:peerCursor:${p.uid}`,
          position: p.appData!.canvasCursorPos!,
          data: { name: p.displayName, color: p.color },
        }),
      );

    if (smoothedAiCursor) {
      annotations.push(
        makePeerCursor({
          id: `annotation:aiCursor`,
          position: smoothedAiCursor,
          data: {
            name: "Gemini",
            color: "#0091ff",
            aiGlow: true,
            hidden: smoothedAiCursor.hidden,
          },
        }),
      );
    }
    return annotations;
  }, [peers, smoothedAiCursor, paddedViewportCoords]);

  function updateViewportCoords() {
    if (!reactFlowNodeRef.current || !reactFlow) return;
    const PADDING_PX = 8;
    let bounds = reactFlowNodeRef.current.getBoundingClientRect();
    let tl = reactFlow.screenToFlowPosition({
      x: bounds.left + PADDING_PX,
      y: bounds.top + PADDING_PX,
    });
    let br = reactFlow.screenToFlowPosition({
      x: bounds.right - PADDING_PX,
      y: bounds.bottom - PADDING_PX,
    });
    setPaddedViewportCoords({
      left: tl?.x || 0,
      top: tl?.y || 0,
      right: br?.x || 0,
      bottom: br?.y || 0,
    });
  }

  useEffect(() => {
    updateViewportCoords();
    let abort = new AbortController();
    window.addEventListener("resize", updateViewportCoords, abort);
    return () => abort.abort();
  }, [reactFlow]);

  useImperativeHandle(
    ref,
    () => ({
      fit: () => {
        if (!reactFlow) return;
        // this stopped working for some reason
        // reactFlow.fitView(fitViewOptions);
        let bounds = reactFlow.getNodesBounds(
          reactFlow.getNodes().filter((n) => !n.hidden),
        );
        bounds.height += 100;
        reactFlow.fitBounds(bounds, fitBoundsOptions);
      },
      panTo: (...nodes: Node[]) => {
        if (nodes.length === 0 || !reactFlow) return;
        else if (nodes.length === 1) {
          let node = nodes[0];
          reactFlow.setCenter(node.position.x, node.position.y, {
            duration: 400,
            zoom: reactFlow.getZoom(),
          });
        } else {
          let bounds = reactFlow.getNodesBounds(nodes);
          reactFlow.fitBounds(bounds);
        }
      },
      pointAtCenter: () => {
        let bounds = reactFlowNodeRef.current?.getBoundingClientRect();
        if (!bounds || !reactFlow) return { x: 0, y: 0 };
        return reactFlow.screenToFlowPosition({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        });
      },
      captureScreenshot: async () => {
        if (!reactFlow) throw new Error("ReactFlow not initialized");
        let nodes = reactFlow.getNodes();
        let nodesToHide = [
          ...reactFlowNodeRef.current!.querySelectorAll(".no-screenshot"),
        ].map((n) => [n, document.createElement("span")]);
        nodesToHide.forEach(([n, s]) => n.replaceWith(s));
        let revert = () =>
          nodesToHide.forEach(([n, s]) => void s.replaceWith(n));
        let imageWidth = 800;
        let imageHeight = 800;

        // we calculate a transform for the nodes so that all nodes are visible
        // we then overwrite the transform of the `.react-flow__viewport` element
        // with the style option of the html-to-image library
        const nodesBounds = getNodesBounds(nodes);
        const viewport = getViewportForBounds(
          nodesBounds,
          imageWidth,
          imageHeight,
          0.5,
          2,
          { x: 0, y: 0 },
        );

        let png: string | null = null;
        try {
          png = await toPng(
            reactFlowNodeRef.current!.querySelector(
              ".react-flow__viewport",
            ) as HTMLElement,
            {
              backgroundColor: "#000",
              width: imageWidth,
              height: imageHeight,
              style: {
                width: `${imageWidth}px`,
                height: `${imageHeight}px`,
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              },
            },
          );
        } finally {
          revert();
        }
        return png;
      },
    }),
    [reactFlow],
  );

  function maybeCreateComment(ev: React.MouseEvent) {
    if (!commentMode) return;
    let position = reactFlow?.screenToFlowPosition({
      x: ev.clientX,
      y: ev.clientY,
    }) || { x: 0, y: 0 };
    let newNode = commentNodes.make({
      id: crypto.randomUUID(),
      selected: true,
      data: { resolved: false, messages: [] },
      position,
    });
    setNodes((n) => [...n, newNode]);
  }

  return (
    <div
      className={cn(styles.canvas, className, {
        [styles.isCommentMode]: commentMode,
      })}
    >
      <ReactFlow
        ref={reactFlowNodeRef}
        onInit={(reactFlow) =>
          setReactFlow(reactFlow as unknown as ReactFlowInstance<Node, Edge>)
        }
        deleteKeyCode={["Backspace", "Delete"]}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        nodes={annotations.length ? [...annotations, ...nodes] : nodes}
        edges={edges}
        nodeOrigin={[0.5, 0.5]}
        onNodesChange={(chg) => {
          let onlyAnnotations = !chg.find(
            (c) => "id" in c && !c.id.startsWith("annotation:"),
          );
          if (onlyAnnotations) return;
          setNodes((n) => applyNodeChanges(chg, n));
        }}
        onEdgesChange={(chg) => setEdges((e) => applyEdgeChanges(chg, e))}
        onConnect={(params) => setEdges((e) => addEdge(params, e))}
        onPaneMouseMove={(ev) => {
          let { x, y } = reactFlow?.screenToFlowPosition({
            x: ev.clientX,
            y: ev.clientY,
          }) || { x: 0, y: 0 };
          setAppData({ canvasCursorPos: { x, y } });
        }}
        onNodeClick={(ev, node) => {
          node.type !== commentNodes.type && maybeCreateComment(ev);
        }}
        onViewportChange={() => updateViewportCoords()}
        onPaneClick={(ev) => maybeCreateComment(ev)}
        onPaneMouseLeave={() => setAppData({ canvasCursorPos: null })}
        defaultEdgeOptions={{ type: "floating" }}
        colorMode="dark"
        panOnScroll={true}
        selectNodesOnDrag={true}
        connectionLineComponent={FloatingConnectionLine}
        fitView
        fitViewOptions={{ ...fitViewOptions, duration: 0 }} // no animation on first fit
      >
        <Background bgColor="var(--gray-2)" color="var(--gray-6)" size={2} />
      </ReactFlow>
    </div>
  );
});
