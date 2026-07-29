import { type ReactNode } from "react";
import { presetById } from "./avatars.ts";
import * as styles from "./Profiles.module.less";
import { type Avatar, type Profile } from "./store.ts";

export function ProfileAvatar({
  avatar,
  name,
  size = 64,
}: {
  readonly avatar: Avatar | null;
  readonly name: string;
  readonly size?: number;
}): ReactNode {
  if (avatar != null && avatar.type === "photo") {
    return (
      <img
        className={styles.avatar}
        style={{ inlineSize: size, blockSize: size }}
        src={avatar.dataUrl}
        alt={name}
      />
    );
  }
  const preset = presetById(avatar != null ? avatar.id : "");
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
