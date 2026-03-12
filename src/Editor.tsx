/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateImage, saveImage } from "@/ai/nano-banana";
import { makeTool } from "@/ai/tools";
import { Canvas, CanvasRef } from "@/canvas/Canvas";
import {
  CanvasDataProvider,
  useCanvasDataContext,
} from "@/canvas/CanvasDataProvider";
import { initialElements } from "@/canvas/initial-elements";
import {
  EntityNodeData,
  entityNodes,
  EntityType,
} from "@/canvas/nodes/EntityNode";
import { ImageGenNodeData, imageGenNodes } from "@/canvas/nodes/ImageGenNode";
import { RootNodeData } from "@/canvas/nodes/RootNode";
import { PresenceProvider } from "@/collab/PresenceProvider";
import { Command, useCommand } from "@/commands/CommandProvider";
import { Header } from "@/components/Header";
import { Loading } from "@/components/Loading";
import {
  DocumentContextConsumer,
  DocumentProvider,
  useDocumentContext,
} from "@/document/DocumentProvider";
import { UNTITLED_DOC_TITLE } from "@/document/model-and-db";
import { DEFAULT_MODEL, LiveAPI, LiveAPIContext } from "@/live/LiveAPI";
import LiveButton from "@/live/LiveButton";
import { WakeWordRecognizer } from "@/live/WakeWordRecognizer";
import { MeetingProvider } from "@/meetings/MeetingProvider";
import { usePrefsContext } from "@/util/PrefsProvider";
import { useWindowFocused } from "@/util/use-window-focused";
import { DropdownMenu, IconButton, Spinner, Tooltip } from "@radix-ui/themes";
import { Node } from "@xyflow/react";
import cn from "classnames";
import { child } from "firebase/database";
import {
  BananaIcon,
  CodeIcon,
  EllipsisVerticalIcon,
  FlagIcon,
  FullscreenIcon,
  MessageCircleIcon,
  MousePointerClickIcon,
  PlusIcon,
  UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import z from "zod";
import styles from "./Editor.module.scss";
import { useGeminiApi } from "./ai";
import { NodeInspectorPanel } from "./canvas/NodeInspectorPanel";
import { MiniAppNodeData, miniAppNodes } from "./canvas/nodes/MiniAppNode";
import { Splitter } from "./components/splitter/Splitter";
import { generateMiniApp } from "./miniapp-generator/miniapp-generator";
import { screenshotMiniApp } from "./miniapp/screenshotter";

type Props = { docId: string };

export function Editor(props: Props) {
  let { docId } = props;
  return (
    <DocumentProvider docId={docId}>
      <DocumentContextConsumer>
        {({ docRef }) => (
          <PresenceProvider presenceRef={child(docRef, "presence")}>
            <CanvasDataProvider dataRef={child(docRef, "canvas")}>
              <EditorInner {...props} />
            </CanvasDataProvider>
          </PresenceProvider>
        )}
      </DocumentContextConsumer>
    </DocumentProvider>
  );
}

function EditorInner({ docId }: Props) {
  const ai = useGeminiApi();
  const { prefs } = usePrefsContext();
  const windowFocused = useWindowFocused();
  const liveApiRef = useRef<LiveAPIContext>(null);
  const canvasRef = useRef<CanvasRef>(null);
  const { docRef, docLoading, metadata, updateMetadata } = useDocumentContext();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [splitSize, setSplitSize] = useState(70);
  const {
    dataLoading,
    nodes,
    setNodes,
    setEdges,
    getNode,
    addNodes,
    updateNode,
    addEdges,
    inspectingNode,
    commentMode,
    toggleCommentMode,
  } = useCanvasDataContext();

  useEffect(() => {
    document.title = `${metadata?.title || UNTITLED_DOC_TITLE} – Product Canvas`;
  }, [metadata?.title]);

  // initialize document with starting elements if empty
  useEffect(() => {
    if (!nodes || nodes.length || dataLoading) return;
    let ie = initialElements();
    addNodes(...ie.nodes);
    addEdges(...ie.edges);
  }, [docId, dataLoading, nodes]);

  // automatically create document title with AI
  useEffect(() => {
    if (docLoading) return;
    if (metadata?.title && metadata.title !== UNTITLED_DOC_TITLE) return;
    let { prompt } =
      (nodes.find((n) => n.id === "root")?.data as RootNodeData | undefined) ||
      {};
    if (!prompt) return;
    let abort = new AbortController();
    (async () => {
      let result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          abortSignal: abort.signal,
          systemInstruction: `
            You are great at creating short, catchy titles for app ideas based on
            a brief description of the app's purpose. Given the description below,
            respond with a short title (4 words or less) that captures the essence
            of the app idea. Do not include any additional text or explanation.`
            .replace(/\s+/g, " ")
            .trim(),
        },
        contents: `
          Here is my prompt for an app idea:
          
          ${prompt}
          
          Now give me a short, catchy title for this app idea.`,
      });
      if (!abort.signal.aborted) {
        updateMetadata({
          title: result.text?.trim() || UNTITLED_DOC_TITLE,
        });
      }
    })();
    return () => abort.abort();
  }, [ai, docLoading, nodes, metadata]);

  useCommand(
    { label: "Stop commenting", keyName: "Escape", disabled: !commentMode },
    () => toggleCommentMode(false),
    [],
  );

  function findPositionNear(
    node: Node,
    spacing = 250,
    minSpacing = 150,
  ): { x: number; y: number } {
    const angle = Math.random() * 360 * (Math.PI / 180);
    const ASPECT = 2; // how elliptical
    // propose location
    for (let iter = 0; iter < 50; iter++) {
      const x = node.position.x + spacing * Math.cos(angle);
      const y = node.position.y + (spacing / ASPECT) * Math.sin(angle);
      // check that the position is not overlapping other nodes
      let tooCloseNode = nodes.find((n) => {
        const dx = n.position.x - x;
        const dy = n.position.y - y;
        return Math.sqrt(dx * dx + dy * dy) < minSpacing;
      });
      if (!tooCloseNode) {
        return { x, y };
      }
      // keep looking
    }
    return findPositionNear(node, spacing + minSpacing, minSpacing);
  }

  async function addNanoBanana(prompt: string) {
    let nodeId = crypto.randomUUID();
    let rootNode = nodes.find((n) => n.id === "root")!;
    let newNode = imageGenNodes.make({
      id: nodeId,
      data: { prompt, state: "generating" },
      position: findPositionNear(rootNode),
    });

    addNodes(newNode);
    addEdges({
      id: crypto.randomUUID(),
      source: nodeId,
      target: "root",
    });

    // canvasRef.current?.fit();
    canvasRef.current?.panTo(newNode);
    let imageDataUrl = await generateImage(ai, {
      prompt: `
The user is working on an app idea. They've asked to generate an image with the prompt below
to help them brainstorm. Respond with a single image that adheres to the given prompt and the
given style notes below.

Image style
- Chalkboard sketch style
- White sketch / line art on a pure black background
- Avoid any extraneous details, such as phone frames, or browser UI chrome for screenshots

Image prompt:
${prompt}
`.trim(),
    });
    let imageUrl = await saveImage(imageDataUrl, `${docId}/${nodeId}`);
    updateNode(nodeId, {
      data: {
        prompt,
        state: "ready",
        imageUrl,
      } satisfies ImageGenNodeData,
    });
  }

  function addEntities(...entities: EntityNodeData[]) {
    let newNodes: Node[] = [];
    for (let entity of entities) {
      let nodeId = crypto.randomUUID();
      let rootNode = getNode("root")!;
      let newNode = entityNodes.make({
        id: nodeId,
        data: entity,
        position: findPositionNear(rootNode),
      });

      addNodes(newNode);

      addEdges({
        id: crypto.randomUUID(),
        source: nodeId,
        target: "root",
      });
    }

    // canvasRef.current?.fit();
    canvasRef.current?.panTo(...newNodes);
  }

  async function autoAddMiniApp() {
    setAiGenerating(true);
    try {
      let dataUrl = await canvasRef.current!.captureScreenshot();
      let result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `
            You are a helpful assistant that helps users brainstorm app ideas by
            suggesting relevant concepts/ideas based on a screenshot of their app
            diagram. Given the screenshot, suggest a very short prompt to a tool that
            will generate a complete HTML prototype. The prompt should be fairly
            short (2 or 3 sentences) but specific to the app's purpose.
          `
            .replace(/\s+/g, " ")
            .trim(),
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Here is a screenshot of my current diagram" },
              {
                inlineData: {
                  data: dataUrl.split(",")[1],
                  mimeType: "image/png",
                },
              },
              {
                text: `Return a prompt for an HTML prototype generator model to create a prototype for this app.`,
              },
            ],
          },
        ],
      });
      let miniAppPrompt = result.text || "";
      setAiGenerating(false);
      await addMiniApp(miniAppPrompt, { screenshotDataUrl: dataUrl });
    } catch (e) {
      console.error(e);
      setAiGenerating(false);
      return;
    }
  }

  async function addMiniApp(
    prompt: string,
    { screenshotDataUrl }: { screenshotDataUrl?: string } = {},
  ) {
    let nodeId = crypto.randomUUID();
    let rootNode = nodes.find((n) => n.id === "root")!;
    let newNode = miniAppNodes.make({
      id: nodeId,
      data: { prompt, state: "generating" },
      position: findPositionNear(rootNode),
    });

    addNodes(newNode);
    addEdges({
      id: crypto.randomUUID(),
      source: nodeId,
      target: "root",
    });

    // canvasRef.current?.fit();
    let appCode = await generateMiniApp(ai, prompt, {
      mediaDataUrl: screenshotDataUrl,
    });
    let thumbnailUrl: string | undefined = undefined;
    try {
      let screenshotDataUrl = await screenshotMiniApp(appCode || "", {
        width: 800,
        height: 600,
      });
      thumbnailUrl = await saveImage(screenshotDataUrl, `${docId}/${nodeId}`);
    } catch (e) {
      console.warn(e);
    }
    // await new Promise((resolve) => setTimeout(resolve, 2000)); // simulate delay
    // const appCode = counterExampleHtml;

    updateNode(nodeId, {
      data: {
        prompt,
        state: "ready",
        appCode,
        thumbnailUrl,
      } satisfies MiniAppNodeData,
    });
  }

  const addNodeTool = makeTool({
    name: "addNode",
    description: "Adds a node of the given type to the diagram",
    parameters: z.object({
      title: z.string(),
      type: z.enum(["tech-stack", "user-goal"] satisfies EntityType[]),
    }),
    run({ title, type }) {
      addEntities({
        title,
        type,
      });
      return "Successfully added the entity";
    },
  });

  const addImageTool = makeTool({
    name: "addImage",
    description:
      "Adds an image with the given prompt. Great for screenshots or sketches",
    parameters: z.object({
      prompt: z.string(),
    }),
    run({ prompt }) {
      addNanoBanana(prompt);
      return "Added the image... it's generating. The user may need to wait a bit for it to appear";
    },
  });

  const addMiniAppTool = makeTool({
    name: "addPrototype",
    description:
      "Generates an HTML prototype from the given prompt. Great for visualizing interactions.",
    parameters: z.object({
      prompt: z.string(),
    }),
    run({ prompt }) {
      addMiniApp(prompt);
      return "Added the prototype... it's generating. The user may need to wait a bit for it to appear";
    },
  });

  async function autoAddEntities(type: EntityType) {
    setAiGenerating(true);
    try {
      let dataUrl = await canvasRef.current!.captureScreenshot();
      let result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `
            You are a helpful assistant that helps users brainstorm app ideas by
            suggesting relevant concepts/ideas based on a screenshot of their app
            diagram. Given the screenshot, suggest a list of "${type}" entities
            that would be useful to add to the diagram. Each entity should
            have a title and a type (either "user-goal" or "tech-stack").
            Respond with a JSON array of strings. Do not include any additional
            text or explanation.
          `
            .replace(/\s+/g, " ")
            .trim(),
          responseMimeType: "application/json",
          responseSchema: z.toJSONSchema(z.array(z.string()), {
            target: "openapi-3.0",
          }),
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Here is a screenshot of my current diagram" },
              {
                inlineData: {
                  data: dataUrl.split(",")[1],
                  mimeType: "image/png",
                },
              },
              {
                text: `Return a list of up to 1 to 4 "${type}" entities that make sense.`,
              },
            ],
          },
        ],
      });
      let strings = JSON.parse(result.text || "");
      if (!Array.isArray(strings)) {
        throw new Error("AI response was not an array");
      }
      addEntities(...strings.map((s) => ({ title: String(s), type })));
      console.log(strings);
    } catch (e) {
      console.error(e);
    } finally {
      setAiGenerating(false);
    }
  }

  async function autoAddNanoBanana() {
    setAiGenerating(true);
    try {
      let dataUrl = await canvasRef.current!.captureScreenshot();
      let result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `
            You are a helpful assistant that helps users brainstorm app ideas by
            suggesting relevant concepts/ideas based on a screenshot of their app
            diagram. Given the screenshot, suggest a very short prompt to an
            image generator tool to create a design idea sketch for the app. The
            prompt should be fairly short (2 or 3 sentences) but specific to the
            app's purpose.
          `
            .replace(/\s+/g, " ")
            .trim(),
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Here is a screenshot of my current diagram" },
              {
                inlineData: {
                  data: dataUrl.split(",")[1],
                  mimeType: "image/png",
                },
              },
              {
                text: `Return a prompt for an image generator model to create design sketches for this app.`,
              },
            ],
          },
        ],
      });
      let nanoBananaPrompt = result.text || "";
      setAiGenerating(false);
      await addNanoBanana(nanoBananaPrompt);
    } catch (e) {
      console.error(e);
      setAiGenerating(false);
      return;
    }
  }

  if (docLoading) {
    return <Loading />;
  }

  return (
    <LiveAPI
      ref={liveApiRef}
      model={DEFAULT_MODEL}
      voiceName="Charon"
      systemInstruction="You are a helpful assistant that responds in a concise and friendly manner. Your name is 'Gemini'"
      tools={[addNodeTool, addImageTool, addMiniAppTool]}
      customOutputStream
      onTurnComplete={() => prefs.wakeWord && liveApiRef.current?.disconnect()}
      onSetupComplete={async () => {
        let dataUrl = await canvasRef.current!.captureScreenshot();
        liveApiRef.current?.session?.sendRealtimeInput({
          media: {
            data: dataUrl.split(",")[1],
            mimeType: "image/png",
          },
        });
      }}
    >
      <MeetingProvider meetingRef={child(docRef, "meeting")}>
        <WakeWordRecognizer
          modelUrl="path-goes-here.json"
          listening={!!prefs.wakeWord && windowFocused}
          onWake={() =>
            !liveApiRef?.current?.connected && liveApiRef?.current?.connect()
          }
        >
          <div
            className={cn(styles.editor, {
              [styles.isShowingInspector]: inspectingNode,
            })}
          >
            <Header />
            <main style={{ ["--split-size" as any]: `${splitSize}%` }}>
              <div className={styles.canvasContainer}>
                <Canvas ref={canvasRef} />
                <div className={styles.controlTray}>
                  {!aiGenerating && (
                    <DropdownMenu.Root>
                      <Command label="Add something" keyName="+" sendEnterKey>
                        <DropdownMenu.Trigger>
                          <IconButton
                            radius="full"
                            color="gray"
                            variant="ghost"
                          >
                            <PlusIcon />
                          </IconButton>
                        </DropdownMenu.Trigger>
                      </Command>
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          onClick={() => autoAddEntities("persona")}
                        >
                          <UserIcon size={16} />
                          Personas
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => autoAddEntities("user-goal")}
                        >
                          <FlagIcon size={16} />
                          User goals
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => autoAddEntities("tech-stack")}
                        >
                          <CodeIcon size={16} />
                          Tech stack
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onClick={() => autoAddNanoBanana()}>
                          <BananaIcon size={16} />
                          Design ideas
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onClick={() => autoAddMiniApp()}>
                          <MousePointerClickIcon size={16} />
                          Prototype
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  )}
                  {aiGenerating && (
                    <Tooltip content="Generating... (Click to stop)">
                      <IconButton
                        radius="full"
                        // @ts-expect-error
                        color={"accent"}
                        variant="solid"
                        style={{ marginRight: -4, marginLeft: -4 }}
                      >
                        <Spinner size="2" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Command
                    label={commentMode ? "Stop commenting" : "Add comment"}
                    keyName="c"
                  >
                    <IconButton
                      radius="full"
                      // @ts-expect-error
                      color={commentMode ? "accent" : "gray"}
                      variant={commentMode ? "solid" : "ghost"}
                      style={
                        commentMode ? { marginRight: -4, marginLeft: -4 } : {}
                      }
                      onClick={() => toggleCommentMode()}
                    >
                      <MessageCircleIcon />
                    </IconButton>
                  </Command>
                  <Command label="Ask Gemini" keyName="g">
                    <LiveButton className={styles.liveButton} />
                  </Command>
                  <Command label="Fit" keyName="f">
                    <IconButton
                      radius="full"
                      color="gray"
                      variant="ghost"
                      onClick={() => canvasRef.current?.fit()}
                    >
                      <FullscreenIcon />
                    </IconButton>
                  </Command>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <IconButton radius="full" color="gray" variant="ghost">
                        <EllipsisVerticalIcon />
                      </IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      {/* <DropdownMenu.CheckboxItem
                        onClick={() =>
                          updatePrefs({ wakeWord: !prefs.wakeWord })
                        }
                        checked={prefs.wakeWord}
                      >
                        Listen for "Hey Jules"
                      </DropdownMenu.CheckboxItem> */}
                      <DropdownMenu.Item
                        color="red"
                        onClick={() => {
                          setEdges([]);
                          setNodes([]);
                          canvasRef.current?.fit();
                        }}
                      >
                        Start over
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              </div>
              {inspectingNode && (
                <>
                  <Splitter
                    className={styles.splitter}
                    storageKey="canvas"
                    thickness={16}
                    min={30}
                    max={80}
                    onResize={(splitSize) => setSplitSize(splitSize)}
                  />
                  <NodeInspectorPanel
                    className={styles.inspectorPanel}
                    nodeId={inspectingNode}
                  />
                </>
              )}
            </main>
          </div>
        </WakeWordRecognizer>
      </MeetingProvider>
    </LiveAPI>
  );
}
