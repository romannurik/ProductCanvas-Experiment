/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthAvatar } from "@/auth/AuthAvatar";
import { useAuthContext } from "@/auth/AuthProvider";
import { PeerFacePile } from "@/collab/PeerFacePile";
import { PeerList, usePresenceContext } from "@/collab/PresenceProvider";
import { Command } from "@/commands/CommandProvider";
import { useDocumentContext } from "@/document/DocumentProvider";
import {
  APP_ROOT_PATH,
  AppUserInfo,
  UNTITLED_DOC_TITLE,
  USERINFO_ROOT_PATH,
} from "@/document/model-and-db";
import { db } from "@/firebase";
import { useMeetingContext } from "@/meetings/MeetingProvider";
import {
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Popover,
  Separator,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import cn from "classnames";
import { onValue, ref } from "firebase/database";
import {
  ChevronDownIcon,
  CopyIcon,
  LinkIcon,
  PhoneIcon,
  PlusIcon,
  RefreshCwOffIcon,
  Share2Icon,
  TrashIcon,
  VideoIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./Header.module.scss";
import { InlineTextEdit } from "./InlineTextEdit";
import { Logo } from "./Logo";
import { SendFeedbackButton } from "./SendFeedbackButton";
import { SettingsButton } from "./SettingsButton";
import { useToast } from "./Toast";

export function Header() {
  const { user } = useAuthContext();
  const [appUserInfo, setAppUserInfo] = useState<AppUserInfo>({ docs: {} });
  const { docId, metadata, updateMetadata, fork, deleteDocument } =
    useDocumentContext();
  const { peers, connected } = usePresenceContext();
  const { toast } = useToast();

  const { title } = metadata || {};
  const meeting = useMeetingContext();

  const { peersInMeeting, peersNotInMeeting } = useMemo(() => {
    const inMeeting: PeerList = [];
    const notInMeeting: PeerList = [];
    for (let peer of peers) {
      if (
        Object.values(meeting.peerInfos || {}).find((pi) => pi.uid === peer.uid)
      ) {
        inMeeting.push(peer);
      } else {
        notInMeeting.push(peer);
      }
    }
    return { peersInMeeting: inMeeting, peersNotInMeeting: notInMeeting };
  }, [peers, meeting.peerInfos]);

  useEffect(() => {
    if (!user) return;
    let unsub = onValue(
      ref(db, `${USERINFO_ROOT_PATH}/${user.uid}`),
      (snapshot) => {
        const appUserInfo = (snapshot.val() || { docs: {} }) as AppUserInfo;
        setAppUserInfo(appUserInfo);
      },
    );
    return () => unsub();
  }, [user]);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <DropdownMenu.Root>
          <Command label="Open menu" keyName="." sendEnterKey>
            <DropdownMenu.Trigger>
              <IconButton
                className={styles.logoButton}
                variant="ghost"
                radius="full"
                color="gray"
              >
                <Logo className={styles.logo} size={28} />
                <ChevronDownIcon className={styles.logoMenuIcon} />
              </IconButton>
            </DropdownMenu.Trigger>
          </Command>
          <DropdownMenu.Content>
            <a href="/" style={{ color: "unset", textDecoration: "none" }}>
              <DropdownMenu.Item>
                <PlusIcon size={16} />
                New
              </DropdownMenu.Item>
            </a>
            {Object.entries(appUserInfo.docs).length > 0 && (
              <DropdownMenu.Separator />
            )}
            {Object.entries(appUserInfo.docs)
              .sort((a, b) =>
                (a[1].title || UNTITLED_DOC_TITLE)
                  .toLocaleLowerCase()
                  .localeCompare(
                    (b[1].title || UNTITLED_DOC_TITLE).toLocaleLowerCase(),
                  ),
              )
              .map(([id, doc]) => (
                <a
                  key={id}
                  href={`/${id}`}
                  onClick={(ev) => docId === id && void ev.preventDefault()}
                  style={{ color: "unset", textDecoration: "none" }}
                >
                  <DropdownMenu.Item disabled={docId === id}>
                    {doc.title || UNTITLED_DOC_TITLE}
                  </DropdownMenu.Item>
                </a>
              ))}
            {!!user && metadata?.creatorUid === user.uid && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item color="red" onClick={() => deleteDocument()}>
                  <TrashIcon size={16} />
                  Delete {metadata?.title || "this file"}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <InlineTextEdit
          className={styles.docTitle}
          value={title || UNTITLED_DOC_TITLE}
          onChange={(title) => updateMetadata({ title })}
        />
        {!connected && (
          <Tooltip content="Disconnected">
            <RefreshCwOffIcon size={16} color="var(--gray-9)" />
          </Tooltip>
        )}
      </div>
      <div style={{ flexGrow: 1 }} />
      {meeting.status === "started" && (
        <div className={styles.huddle}>
          <Command label="Join huddle" keyName="h">
            <Button
              variant="ghost"
              color="green"
              radius="full"
              style={{ marginLeft: "0", fontWeight: 500 }}
              onClick={() => meeting.join()}
            >
              <VideoIcon size={20} />
              Join
            </Button>
          </Command>
          <PeerFacePile
            className={styles.facePile}
            peers={peersInMeeting}
            connected={connected}
            clickToFollow
          />
        </div>
      )}
      {meeting.status === "joined" && (
        <div className={cn(styles.huddle, styles.isJoined)}>
          <Command label="Leave huddle" keyName="h">
            <Button
              variant="ghost"
              color="red"
              radius="full"
              style={{ marginLeft: "0", marginRight: 0, fontWeight: 500 }}
              onClick={() => meeting.leave()}
            >
              <PhoneIcon
                size={20}
                style={{ transform: "rotate(135deg)", marginRight: 8 }}
              />
              Leave
            </Button>
          </Command>
          {!!peersInMeeting.length && (
            <PeerFacePile
              className={styles.facePile}
              peers={peersInMeeting}
              connected={connected}
              clickToFollow
            />
          )}
        </div>
      )}
      {meeting.status === "not-started" && !!peers.length && (
        <Command label="Start huddle" keyName="h">
          <IconButton
            variant="ghost"
            color="gray"
            radius="full"
            onClick={() => meeting.join()}
          >
            <VideoIcon size={20} />
          </IconButton>
        </Command>
      )}
      {!!peersNotInMeeting.length && (
        <PeerFacePile
          peers={peersNotInMeeting}
          className={styles.facePile}
          connected={connected}
          clickToFollow
        />
      )}
      {(meeting.status !== "not-started" || !!peers.length) && <hr />}
      <div className={styles.actions}>
        <Popover.Root>
          <Command label="Share" keyName="s">
            <Popover.Trigger>
              <IconButton variant="ghost" color="gray" radius="full">
                <Share2Icon size={20} />
              </IconButton>
            </Popover.Trigger>
          </Command>
          <Popover.Content width="360px">
            <Flex direction="column" gap="2">
              <Text size="2" color="gray">
                Share to collaborate:
              </Text>
              <Flex gap="2">
                <TextField.Root
                  readOnly
                  value={window.location.href.replace(/https?:\/\//, "")}
                  style={{ flex: "1 1 0", userSelect: "all" }}
                  onFocus={(ev) => ev.currentTarget.select()}
                >
                  <TextField.Slot>
                    <LinkIcon size={16} />
                  </TextField.Slot>
                </TextField.Root>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast("Copied!", { status: "success" });
                  }}
                >
                  Copy
                </Button>
              </Flex>
            </Flex>
          </Popover.Content>
        </Popover.Root>
        <Tooltip content="Fork">
          <IconButton
            variant="ghost"
            color="gray"
            radius="full"
            onClick={() => fork()}
          >
            <CopyIcon size={20} />
          </IconButton>
        </Tooltip>
        <Separator orientation="vertical" />
        <SettingsButton />
        <SendFeedbackButton feedbackKey={APP_ROOT_PATH} />
      </div>
      <AuthAvatar />
    </header>
  );
}
