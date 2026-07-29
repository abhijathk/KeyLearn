import { Identicon } from "@keybr/identicon";
import { type ClassName } from "@keybr/widget";
import { clsx } from "clsx";
import { type ReactNode, useState } from "react";
import * as styles from "./Avatar.module.less";
import { type AnyUser } from "./types.ts";

export function Avatar({
  user,
  size = "normal",
  className,
}: {
  readonly user: AnyUser | null;
  readonly size?: "normal" | "medium" | "large";
  readonly className?: ClassName;
}): ReactNode {
  // If a remote avatar image fails to load (offline, blocked, 404), fall back
  // to the name-based identicon instead of a broken-image placeholder.
  const [imageFailed, setImageFailed] = useState(false);

  const sizeClassName = {
    [styles.size_normal]: size === "normal",
    [styles.size_medium]: size === "medium",
    [styles.size_large]: size === "large",
  };

  if (user == null) {
    return (
      <AnonymousImage
        className={clsx(
          styles.root,
          sizeClassName,
          styles.anonymousImage,
          className,
        )}
      />
    );
  }

  const { name, imageUrl } = user;
  if (imageUrl != null && !imageFailed) {
    return (
      <img
        className={clsx(
          styles.root,
          sizeClassName,
          styles.customImage,
          className,
        )}
        src={imageUrl}
        alt="User image"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <Identicon
      className={clsx(styles.root, sizeClassName, className)}
      name={name}
    />
  );
}

function AnonymousImage({
  className,
}: {
  readonly className?: ClassName;
}): ReactNode {
  // A person-in-a-ring drawn in the same thin-stroke style as StrokeIcon.
  return (
    <svg className={className} viewBox="0 0 24 24">
      <circle cx={12} cy={12} r={10.3} />
      <circle cx={12} cy={9.6} r={3.3} />
      <path d="M 5.9 19.9 C 6.6 16.7 9 14.9 12 14.9 C 15 14.9 17.4 16.7 18.1 19.9" />
    </svg>
  );
}
