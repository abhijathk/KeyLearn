import { type ReactNode } from "react";
import { presetById } from "./avatars.ts";
import * as styles from "./Profiles.module.less";
import { type Avatar, type Profile } from "./store.ts";

const INLINE_IMAGE =
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isInlineImage(value: unknown): value is string {
  return typeof value === "string" && INLINE_IMAGE.test(value);
}

export function ProfileAvatar({
  avatar,
  name,
  size = 64,
}: {
  readonly avatar: Avatar | null;
  readonly name: string;
  readonly size?: number;
}): ReactNode {
  // The server validates this on write, but rows predating that validation may
  // still hold anything, so re-check before handing it to an <img src>: only an
  // inline image is ever rendered, never a remote or scheme-bearing URL.
  if (
    avatar != null &&
    avatar.type === "photo" &&
    isInlineImage(avatar.dataUrl)
  ) {
    return (
      <img
        className={styles.avatar}
        style={{ inlineSize: size, blockSize: size }}
        src={avatar.dataUrl}
        alt={name}
      />
    );
  }
  // Falls through to the lettered preset for an icon avatar, for no avatar, and
  // for a photo whose data URL was rejected above.
  const preset = presetById(avatar?.type === "icon" ? avatar.id : "");
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={styles.avatar}
      style={{
        inlineSize: size,
        blockSize: size,
        background: preset.bg,
        color: preset.fg,
        fontSize: size * 0.44,
      }}
      aria-hidden={true}
    >
      {initial}
    </span>
  );
}

export function avatarOf(profile: Profile): Avatar | null {
  return profile.avatar;
}
