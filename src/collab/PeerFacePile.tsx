/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Avatar } from "@/auth/Avatar";
import { Tooltip } from "@radix-ui/themes";
import cn from "classnames";
import styles from "./PeerFacePile.module.scss";
import { PeerList, usePresenceContext } from "./PresenceProvider";

export function PeerFacePile({
  peers,
  connected,
  className,
  clickToFollow,
}: {
  peers: PeerList;
  className?: string;
  connected?: boolean;
  clickToFollow?: boolean;
}) {
  const { followingPeer, setFollowingUid } = usePresenceContext();

  return (
    <div
      className={cn(styles.pile, className)}
      style={connected === false ? { opacity: 0.5 } : {}}
    >
      {(peers || []).map(({ uid, photoURL, displayName, color }) => (
        <Tooltip
          key={uid}
          content={
            (uid === followingPeer?.uid ? "Following " : "") +
            (displayName || "")
          }
        >
          <Avatar
            className={cn(
              styles.peer,
              uid === followingPeer?.uid && styles.isFollowing,
              clickToFollow && styles.isClickable,
            )}
            src={photoURL}
            displayName={displayName || ""}
            style={{ ["--user-color" as any]: color }}
            onClick={
              clickToFollow
                ? () =>
                    setFollowingUid(
                      uid === followingPeer?.uid ? undefined : uid,
                    )
                : undefined
            }
          />
        </Tooltip>
      ))}
    </div>
  );
}
