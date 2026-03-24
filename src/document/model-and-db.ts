/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Viewport } from "@xyflow/react";

export const APP_ROOT_PATH = "canvas";
export const DOC_ROOT_PATH = `${APP_ROOT_PATH}/docs`;
export const USERINFO_ROOT_PATH = `${APP_ROOT_PATH}/userinfo`;
export const MEDIA_ROOT_PATH = `${APP_ROOT_PATH}/media`;

export type PresenceAppData = {
  canvasCursorPos?: { x: number; y: number };
  canvasViewport?: Viewport;
};

export type DocMetadata = {
  creatorUid?: string;
  title?: string;
};

export type AppUserInfo = {
  docs: Record<string, DocMetadata>;
};

export const UNTITLED_DOC_TITLE = "Untitled";
